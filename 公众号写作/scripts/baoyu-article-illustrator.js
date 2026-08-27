#!/usr/bin/env node
/**
 * Step 9: 文章配图
 * 调用 DashScope 通义万相 API 根据文章内容生成配图
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 轻量 .env 加载（无第三方依赖），读取 公众号写作/.env
(() => {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* 无 .env 时静默跳过，回退到系统环境变量 */ }
})();

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
if (!DASHSCOPE_API_KEY) {
  console.error('错误：未配置 DASHSCOPE_API_KEY 环境变量。请在 公众号写作/.env 中设置（参考 .env.example），切勿把 key 写进代码。');
  process.exit(1);
}
const API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';

/**
 * 分析文章内容，提取配图需求
 * @param {string} articlePath - 文章文件路径
 * @returns {Array} 配图需求列表
 */
function analyzeArticle(articlePath) {
  console.log('📖 分析文章内容...');

  if (!fs.existsSync(articlePath)) {
    throw new Error(`文章文件不存在: ${articlePath}`);
  }

  const content = fs.readFileSync(articlePath, 'utf-8');

  // 提取标题
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : '文章配图';

  // 提取关键段落（用于生成配图提示词）
  const paragraphs = content
    .split('\n')
    .filter(line => line.trim().length > 50 && !line.startsWith('#') && !line.startsWith('!['))
    .slice(0, 5);

  // 根据内容生成配图需求
  const illustrations = [];

  // 封面配图
  illustrations.push({
    type: 'cover',
    description: `文章主题配图：${title}`,
    prompt: `专业公众号配图，${title}，高清，现代设计，适合文章配图，无文字`
  });

  // 根据段落生成配图
  paragraphs.forEach((para, index) => {
    const keywords = extractKeywords(para);
    if (keywords.length > 0) {
      illustrations.push({
        type: 'content',
        description: `段落配图 ${index + 1}：${keywords.join('，')}`,
        prompt: `公众号文章配图，${keywords.join('，')}，高清，现代设计，适合文章配图，无文字`
      });
    }
  });

  console.log(`   找到 ${illustrations.length} 个配图需求:`);
  illustrations.forEach((ill, i) => {
    console.log(`   ${i + 1}. ${ill.description}`);
  });

  return { title, illustrations };
}

/**
 * 提取关键词
 */
function extractKeywords(text) {
  // 简单的关键词提取（实际可以用 NLP 库）
  const commonWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];

  const words = text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !commonWords.includes(w));

  // 返回前 3-5 个关键词
  return words.slice(0, 5);
}

/**
 * 生成单张图片
 */
async function generateImage(prompt, outputPath, options = {}) {
  const { width = 1024, height = 576 } = options;

  const requestData = JSON.stringify({
    model: 'wanx2.1-t2i-turbo',
    input: {
      prompt: prompt
    },
    parameters: {
      size: `${width}*${height}`,
      n: 1,
      seed: Math.floor(Math.random() * 1000000)
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'X-DashScope-Async': 'enable'
      }
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', async () => {
        try {
          const response = JSON.parse(data);

          if (response.output && response.output.task_id) {
            const taskId = response.output.task_id;
            const imageUrl = await pollTaskResult(taskId);

            if (imageUrl) {
              await downloadImage(imageUrl, outputPath);
              resolve({ success: true, outputPath, imageUrl });
            } else {
              reject(new Error('获取图片 URL 失败'));
            }
          } else if (response.output && response.output.results) {
            const imageUrl = response.output.results[0]?.url;
            if (imageUrl) {
              await downloadImage(imageUrl, outputPath);
              resolve({ success: true, outputPath, imageUrl });
            } else {
              reject(new Error('未找到图片 URL'));
            }
          } else {
            reject(new Error(`API 错误: ${response.message || JSON.stringify(response)}`));
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`请求失败: ${error.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * 轮询获取任务结果
 */
async function pollTaskResult(taskId) {
  const maxAttempts = 30;
  const interval = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, interval));

    try {
      const result = await new Promise((resolve, reject) => {
        const req = https.request(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.end();
      });

      if (result.output && result.output.results && result.output.results.length > 0) {
        return result.output.results[0].url;
      }

      if (result.output && result.output.task_status === 'FAILED') {
        throw new Error(`任务失败: ${result.message}`);
      }
    } catch (error) {
      // 继续轮询
    }
  }

  throw new Error('轮询超时');
}

/**
 * 下载图片
 */
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (error) => {
      fs.unlink(outputPath, () => {});
      reject(error);
    });
  });
}

/**
 * 主函数：为文章生成配图
 */
async function illustrateArticle(articlePath, outputDir = 'images') {
  console.log('🎨 开始为文章生成配图...');
  console.log(`   文章: ${articlePath}`);
  console.log(`   输出目录: ${outputDir}`);

  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 分析文章
  const { title, illustrations } = analyzeArticle(articlePath);

  if (illustrations.length === 0) {
    console.log('⚠️ 未找到配图需求');
    return { success: false, images: [] };
  }

  // 生成配图
  const generatedImages = [];
  const totalCost = illustrations.length * 0.12;

  console.log(`\n💰 预估费用: ¥${totalCost.toFixed(2)} (${illustrations.length} 张)`);

  for (let i = 0; i < illustrations.length; i++) {
    const ill = illustrations[i];
    const outputPath = path.join(outputDir, `illustration-${i + 1}.png`);

    console.log(`\n🖼️  生成配图 ${i + 1}/${illustrations.length}`);
    console.log(`   描述: ${ill.description}`);
    console.log(`   提示词: ${ill.prompt.substring(0, 80)}...`);

    try {
      const result = await generateImage(ill.prompt, outputPath);
      generatedImages.push({
        index: i + 1,
        type: ill.type,
        description: ill.description,
        path: outputPath,
        url: result.imageUrl
      });
      console.log(`   ✅ 已保存: ${outputPath}`);
    } catch (error) {
      console.error(`   ❌ 生成失败: ${error.message}`);
    }
  }

  console.log(`\n✅ 配图生成完成！`);
  console.log(`   成功: ${generatedImages.length}/${illustrations.length}`);
  console.log(`   总费用: ¥${(generatedImages.length * 0.12).toFixed(2)}`);

  return {
    success: generatedImages.length > 0,
    images: generatedImages,
    title
  };
}

// 命令行入口
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.article) {
    console.log('使用方法:');
    console.log('  node baoyu-article-illustrator.js --article <文章路径> [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --article       文章文件路径（必填）');
    console.log('  --output        输出目录（默认 images）');
    console.log('');
    console.log('示例:');
    console.log('  node baoyu-article-illustrator.js --article article.md');
    process.exit(1);
  }

  illustrateArticle(args.article, args.output || 'images')
    .then(result => {
      if (result.success) {
        console.log('\n✅ 全部完成！');
        process.exit(0);
      } else {
        console.log('\n⚠️ 部分完成');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ 失败:', error.message);
      process.exit(1);
    });
}

/**
 * 简单的参数解析
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = value;
    }
  }
  return args;
}

module.exports = {
  illustrateArticle
};