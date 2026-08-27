#!/usr/bin/env node
/**
 * Step 11: 排版自动化脚本
 * 使用 Playwright 浏览器自动化操作 editor.huasheng.ai
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 使用浏览器自动化排版文章
 * @param {string} markdownPath - Markdown 文件路径
 * @param {string} outputPath - 输出 HTML 文件路径
 * @param {Object} options - 配置选项
 */
async function formatArticleWithBrowser(markdownPath, outputPath, options = {}) {
  const {
    style = '简约',
    headless = false,
    timeout = 60000
  } = options;

  console.log('🚀 启动浏览器自动化排版...');
  console.log(`   输入: ${markdownPath}`);
  console.log(`   输出: ${outputPath}`);
  console.log(`   风格: ${style}`);

  // 读取 Markdown 内容
  if (!fs.existsSync(markdownPath)) {
    throw new Error(`文件不存在: ${markdownPath}`);
  }
  const markdownContent = fs.readFileSync(markdownPath, 'utf-8');

  // 启动浏览器
  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 500 // 非 headless 模式放慢操作以便观察
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    // 1. 打开排版编辑器
    console.log('📄 打开 editor.huasheng.ai...');
    await page.goto('https://editor.huasheng.ai/', {
      waitUntil: 'networkidle',
      timeout
    });

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 2. 查找编辑器输入区域
    // 注：具体选择器需要根据实际页面结构调整
    console.log('📝 查找编辑器...');

    // 尝试多种可能的选择器
    const editorSelectors = [
      '[contenteditable="true"]',
      '.editor',
      '#editor',
      'textarea',
      '[data-placeholder]'
    ];

    let editorFound = false;
    for (const selector of editorSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`   找到编辑器: ${selector}`);
        editorFound = true;

        // 清空并输入内容
        await page.click(selector);
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
        await page.fill(selector, markdownContent);
        break;
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }

    if (!editorFound) {
      throw new Error('无法找到编辑器输入区域，请检查页面结构');
    }

    // 3. 选择排版风格（如果有选项）
    console.log('🎨 选择排版风格...');
    try {
      // 尝试点击风格选择按钮
      const styleButtons = await page.$$('[class*="style"], [class*="theme"], button');
      for (const button of styleButtons) {
        const text = await button.textContent();
        if (text && text.includes(style)) {
          await button.click();
          console.log(`   已选择风格: ${style}`);
          break;
        }
      }
    } catch (e) {
      console.log('   风格选择跳过（可能不需要）');
    }

    // 4. 等待排版完成
    console.log('⏳ 等待排版处理...');
    await page.waitForTimeout(3000);

    // 5. 获取排版后的 HTML
    console.log('📋 获取排版结果...');

    // 尝试获取 HTML 内容
    const htmlContent = await page.evaluate(() => {
      // 尝试多种可能的内容区域
      const selectors = [
        '.preview',
        '#preview',
        '[class*="preview"]',
        '[class*="output"]',
        '.content',
        '#content'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.innerHTML;
        }
      }

      // 如果找不到特定区域，返回 body 内容
      return document.body.innerHTML;
    });

    // 6. 保存 HTML 文件
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>排版后的文章</title>
  <style>
    /* 基础样式 */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

    fs.writeFileSync(outputPath, fullHtml, 'utf-8');
    console.log(`✅ 排版完成，已保存: ${outputPath}`);

    // 7. 如果不使用 headless 模式，等待用户确认
    if (!headless) {
      console.log('\n👀 请检查排版效果，按回车键关闭浏览器...');
      process.stdin.once('data', () => {});
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return {
      success: true,
      outputPath,
      htmlContent
    };

  } catch (error) {
    console.error('❌ 排版失败:', error.message);
    throw error;
  } finally {
    await browser.close();
    console.log('🔒 浏览器已关闭');
  }
}

// 命令行入口
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('使用方法:');
    console.log('  node format-to-wechat.js <markdown文件> <输出html文件> [风格]');
    console.log('');
    console.log('示例:');
    console.log('  node format-to-wechat.js article.md output.html 简约');
    console.log('  node format-to-wechat.js article.md output.html 商务');
    process.exit(1);
  }

  const [markdownPath, outputPath, style = '简约'] = args;

  formatArticleWithBrowser(markdownPath, outputPath, { style })
    .then(result => {
      console.log('\n✅ 成功:', result.outputPath);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 失败:', error.message);
      process.exit(1);
    });
}

module.exports = {
  formatArticleWithBrowser
};
