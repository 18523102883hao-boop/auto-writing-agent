#!/usr/bin/env node
/**
 * Step 10: 封面图生成
 * 调用 DashScope 通义万相 API 生成封面图
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
 * 生成封面图
 * @param {Object} options - 配置选项
 * @param {string} options.title - 文章标题
 * @param {string} options.subtitle - 副标题（可选）
 * @param {string} options.style - 风格（tech/health/family/sport/business）
 * @param {string} options.ratio - 比例（16:9 或 2.35:1）
 * @param {string} options.output - 输出路径
 */
async function generateCover(options) {
  const {
    title,
    subtitle = '',
    style = 'tech',
    ratio = '16:9',
    output = 'cover.png'
  } = options;

  console.log('🎨 开始生成封面图...');
  console.log(`   标题: ${title}`);
  console.log(`   副标题: ${subtitle || '无'}`);
  console.log(`   风格: ${style}`);
  console.log(`   比例: ${ratio}`);
  console.log(`   输出: ${output}`);

  // 构建提示词
  const stylePrompts = {
    tech: '科技感，现代，简洁，蓝色调，专业',
    health: '健康，活力，自然，绿色调，清新',
    family: '温馨，亲子，家庭，暖色调，柔和',
    sport: '运动，活力，动感，橙色调，激情',
    business: '商务，专业，稳重，灰色调，大气'
  };

  const sizeConfig = ratio === '2.35:1' ? { width: 940, height: 400 } : { width: 1024, height: 576 };

  const prompt = `公众号封面图，${stylePrompts[style] || stylePrompts.tech}，标题："${title}"${subtitle ? '，副标题："' + subtitle + '"' : ''}，高清，专业设计，适合微信公众号封面`;

  console.log('📝 提示词:', prompt.substring(0, 100) + '...');

  // 准备请求数据
  const requestData = JSON.stringify({
    model: 'wanx2.1-t2i-turbo',
    input: {
      prompt: prompt
    },
    parameters: {
      size: `${sizeConfig.width}*${sizeConfig.height}`,
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
          console.log('📡 API 响应:', JSON.stringify(response, null, 2).substring(0, 500));

          if (response.output && response.output.task_id) {
            console.log('⏳ 任务已提交，等待生成...');
            const taskId = response.output.task_id;

            // 轮询获取结果
            const imageUrl = await pollTaskResult(taskId);

            if (imageUrl) {
              // 下载图片
              await downloadImage(imageUrl, output);
              console.log(`✅ 封面图已保存: ${output}`);
              resolve({ success: true, outputPath: output, imageUrl });
            } else {
              reject(new Error('获取图片 URL 失败'));
            }
          } else if (response.output && response.output.results) {
            // 直接返回结果
            const imageUrl = response.output.results[0]?.url;
            if (imageUrl) {
              await downloadImage(imageUrl, output);
              console.log(`✅ 封面图已保存: ${output}`);
              resolve({ success: true, outputPath: output, imageUrl });
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
    console.log(`   轮询 ${i + 1}/${maxAttempts}...`);

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
      console.log(`   轮询错误: ${error.message}`);
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

// 命令行入口
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.title) {
    console.log('使用方法:');
    console.log('  node baoyu-cover-image.js --title "文章标题" [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --title         文章标题（必填）');
    console.log('  --subtitle      副标题（可选）');
    console.log('  --style         风格（tech/health/family/sport/business，默认 tech）');
    console.log('  --ratio         比例（16:9 或 2.35:1，默认 16:9）');
    console.log('  --output        输出路径（默认 cover.png）');
    console.log('');
    console.log('示例:');
    console.log('  node baoyu-cover-image.js --title "儿童游泳的最佳年龄" --style family');
    process.exit(1);
  }

  generateCover({
    title: args.title,
    subtitle: args.subtitle,
    style: args.style || 'tech',
    ratio: args.ratio || '16:9',
    output: args.output || 'cover.png'
  })
    .then(result => {
      console.log('\n✅ 成功:', result.outputPath);
      process.exit(0);
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
  generateCover
};
