#!/usr/bin/env node
/**
 * Step 12: 发布到公众号
 * 将文章保存为适合公众号发布的格式
 * 注：实际发布需要通过公众号后台或第三方工具完成
 */

const fs = require('fs');
const path = require('path');

/**
 * 准备公众号发布格式
 * @param {Object} options - 配置选项
 * @param {string} options.title - 文章标题
 * @param {string} options.content - HTML 内容或 Markdown 文件路径
 * @param {string} options.cover - 封面图路径
 * @param {string} options.digest - 摘要（可选）
 * @param {string} options.output - 输出目录
 * @param {string} options.mode - 模式（draft/export）
 */
async function prepareForWechat(options) {
  const {
    title,
    content,
    cover,
    digest = '',
    output = './_output',
    mode = 'draft'
  } = options;

  console.log('📤 准备公众号发布...');
  console.log(`   标题: ${title}`);
  console.log(`   模式: ${mode}`);
  console.log(`   输出: ${output}`);

  // 创建输出目录
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output, { recursive: true });
  }

  // 读取内容
  let htmlContent;
  if (content.endsWith('.html')) {
    htmlContent = fs.readFileSync(content, 'utf-8');
  } else if (content.endsWith('.md')) {
    // 简单 Markdown 转 HTML（实际应该用 marked 等库）
    const mdContent = fs.readFileSync(content, 'utf-8');
    htmlContent = simpleMarkdownToHtml(mdContent);
  } else {
    htmlContent = content;
  }

  // 生成公众号格式的 HTML
  const wechatHtml = generateWechatHtml(title, htmlContent, cover);

  // 保存文件
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(output, `${timestamp}-${sanitizeFilename(title)}.html`);

  fs.writeFileSync(outputPath, wechatHtml, 'utf-8');

  // 生成发布清单
  const manifest = {
    title,
    digest: digest || generateDigest(htmlContent),
    cover: cover || null,
    htmlFile: outputPath,
    mode,
    createdAt: new Date().toISOString(),
    nextSteps: mode === 'draft' ? [
      '1. 登录 mp.weixin.qq.com',
      '2. 新建图文消息',
      '3. 粘贴 HTML 内容',
      '4. 上传封面图',
      '5. 保存草稿或发布'
    ] : []
  };

  const manifestPath = path.join(output, `${timestamp}-${sanitizeFilename(title)}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\n✅ 准备完成！`);
  console.log(`   HTML 文件: ${outputPath}`);
  console.log(`   清单文件: ${manifestPath}`);

  if (mode === 'draft') {
    console.log('\n📋 下一步操作:');
    console.log('   1. 打开 mp.weixin.qq.com');
    console.log('   2. 新建图文消息');
    console.log('   3. 复制 HTML 文件内容到编辑器');
    console.log('   4. 上传封面图');
    console.log('   5. 保存草稿');
  }

  return {
    success: true,
    outputPath,
    manifestPath,
    manifest
  };
}

/**
 * 简单的 Markdown 转 HTML
 */
function simpleMarkdownToHtml(markdown) {
  return markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;">')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

/**
 * 生成公众号 HTML
 */
function generateWechatHtml(title, content, coverPath) {
  const coverHtml = coverPath ? `<img src="${coverPath}" style="width:100%;max-width:600px;margin-bottom:20px;">` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: #fff;
    }
    h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #000;
    }
    h2 {
      font-size: 20px;
      font-weight: bold;
      margin-top: 30px;
      margin-bottom: 15px;
      color: #000;
    }
    h3 {
      font-size: 18px;
      font-weight: bold;
      margin-top: 25px;
      margin-bottom: 10px;
      color: #333;
    }
    p {
      margin-bottom: 15px;
      text-align: justify;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 20px auto;
    }
    ul, ol {
      margin-bottom: 15px;
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    strong {
      font-weight: bold;
      color: #000;
    }
    a {
      color: #576b95;
      text-decoration: none;
    }
    blockquote {
      border-left: 4px solid #576b95;
      padding-left: 15px;
      margin: 20px 0;
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
${coverHtml}
${content}
</body>
</html>`;
}

/**
 * 生成摘要
 */
function generateDigest(htmlContent) {
  // 去除 HTML 标签
  const text = htmlContent.replace(/<[^>]+>/g, '');
  // 取前 100 字
  return text.substring(0, 100).replace(/\s+/g, ' ') + '...';
}

/**
 * 清理文件名
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

// 命令行入口
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.title || !args.content) {
    console.log('使用方法:');
    console.log('  node baoyu-post-to-wechat.js --title "标题" --content <文件路径> [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --title         文章标题（必填）');
    console.log('  --content       内容文件路径（HTML 或 Markdown）（必填）');
    console.log('  --cover         封面图路径（可选）');
    console.log('  --digest        摘要（可选，默认自动生成）');
    console.log('  --output        输出目录（默认 ./_output）');
    console.log('  --mode          模式（draft/export，默认 draft）');
    console.log('');
    console.log('示例:');
    console.log('  node baoyu-post-to-wechat.js --title "文章标题" --content article.md --cover cover.png');
    process.exit(1);
  }

  prepareForWechat({
    title: args.title,
    content: args.content,
    cover: args.cover,
    digest: args.digest,
    output: args.output || './_output',
    mode: args.mode || 'draft'
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
  prepareForWechat
};
