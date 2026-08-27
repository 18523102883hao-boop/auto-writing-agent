#!/usr/bin/env node
/**
 * 自动发布脚本
 * 监控指定目录，自动获取排版好的文章并发布到公众号
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const WATCH_DIR = '/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/开发文件集/自动化写作Agent/公众号写作/_ready_to_publish';
const PROCESSED_DIR = '/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/开发文件集/自动化写作Agent/公众号写作/_published';

/**
 * 确保目录存在
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 检查是否有待发布的文件
 */
function checkForNewFiles() {
  ensureDir(WATCH_DIR);
  ensureDir(PROCESSED_DIR);

  const files = fs.readdirSync(WATCH_DIR);
  const htmlFiles = files.filter(f => f.endsWith('.html') || f.endsWith('.md'));

  return htmlFiles.map(f => ({
    name: f,
    path: path.join(WATCH_DIR, f),
    stat: fs.statSync(path.join(WATCH_DIR, f))
  }));
}

/**
 * 读取文章信息
 */
function readArticleInfo(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 尝试提取标题
  const titleMatch = content.match(/<title>(.+?)<\/title>/) ||
                     content.match(/^#\s+(.+)$/m) ||
                     content.match(/<h1[^>]*>(.+?)<\/h1>/);
  const title = titleMatch ? titleMatch[1] : path.basename(filePath, path.extname(filePath));

  // 尝试提取封面图路径
  const coverMatch = content.match(/cover["']?\s*[=:]\s*["'](.+?)["']/);
  const cover = coverMatch ? coverMatch[1] : null;

  return { title, content, cover };
}

/**
 * 使用 agent-browser 自动发布
 */
async function publishWithAgentBrowser(articlePath, title, coverPath) {
  console.log('🚀 开始自动发布流程...');
  console.log(`   文章: ${articlePath}`);
  console.log(`   标题: ${title}`);
  console.log(`   封面: ${coverPath || '无'}`);

  // 这里使用 agent-browser 命令
  // 由于 agent-browser 正在安装，先输出命令供手动执行
  const commands = `
# 1. 打开公众号后台
agent-browser open https://mp.weixin.qq.com

# 2. 等待登录（如果是首次）
agent-browser wait --load networkidle

# 3. 点击"新的创作" -> "图文消息"
# 注：需要根据实际页面结构调整选择器
agent-browser snapshot -i

# 4. 填写标题
# agent-browser fill @e1 "${title}"

# 5. 粘贴内容
# 需要将 HTML 内容复制到剪贴板，然后粘贴

# 6. 上传封面图
# agent-browser click @e2  # 上传封面按钮

# 7. 保存草稿
# agent-browser click @e3  # 保存按钮
`;

  console.log('\n📋 agent-browser 命令（供参考）：');
  console.log(commands);

  return {
    success: true,
    message: 'agent-browser 命令已生成，请手动执行或等待 agent-browser 安装完成',
    commands
  };
}

/**
 * 处理单个文件
 */
async function processFile(file) {
  console.log(`\n📄 处理文件: ${file.name}`);

  const { title, content, cover } = readArticleInfo(file.path);

  // 移动文件到处理目录
  const processedPath = path.join(PROCESSED_DIR, file.name);
  fs.renameSync(file.path, processedPath);

  // 保存元数据
  const metaPath = processedPath + '.json';
  fs.writeFileSync(metaPath, JSON.stringify({
    title,
    cover,
    originalPath: file.path,
    processedPath,
    processedAt: new Date().toISOString()
  }, null, 2));

  // 尝试自动发布
  const result = await publishWithAgentBrowser(processedPath, title, cover);

  return result;
}

/**
 * 主函数
 */
async function main() {
  console.log('👀 开始监控发布目录...');
  console.log(`   监控路径: ${WATCH_DIR}`);

  ensureDir(WATCH_DIR);
  ensureDir(PROCESSED_DIR);

  const files = checkForNewFiles();

  if (files.length === 0) {
    console.log('⏳ 没有待发布的文件');
    console.log(`\n💡 请将排版好的文章放入: ${WATCH_DIR}`);
    return;
  }

  console.log(`\n📦 发现 ${files.length} 个待发布文件`);

  for (const file of files) {
    try {
      await processFile(file);
    } catch (error) {
      console.error(`❌ 处理失败: ${file.name}`, error.message);
    }
  }

  console.log('\n✅ 处理完成');
}

// 命令行入口
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ 失败:', error.message);
      process.exit(1);
    });
}

module.exports = {
  checkForNewFiles,
  processFile,
  publishWithAgentBrowser
};
