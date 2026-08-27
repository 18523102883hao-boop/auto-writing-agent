#!/usr/bin/env bun
/**
 * Format article using editor.huasheng.ai
 * Browser automation with Playwright
 */

import { chromium, type Browser, type Page } from "playwright";
import { readFile } from "node:fs/promises";
import process from "node:process";

interface CliArgs {
  input: string;
  output?: string;
  style?: string;
  headless: boolean;
  help: boolean;
}

function printUsage(): void {
  console.log(`Usage:
  bun scripts/format-huasheng.ts --input <path> [选项]

Options:
  --input <path>    Markdown 文件路径（必填）
  --output <path>   输出 HTML 文件路径（默认 input.html）
  --style <name>    排版风格: default, simple, elegant, tech（默认 default）
  --headless        使用无头模式（不显示浏览器）
  -h, --help        显示帮助

Examples:
  bun scripts/format-huasheng.ts --input article.md
  bun scripts/format-huasheng.ts --input article.md --style tech --output formatted.html
`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false, headless: false, input: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--input" && argv[i + 1]) args.input = argv[++i];
    else if (arg === "--output" && argv[i + 1]) args.output = argv[++i];
    else if (arg === "--style" && argv[i + 1]) args.style = argv[++i];
    else if (arg === "--headless") args.headless = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

async function formatWithHuasheng(
  markdownContent: string,
  style: string,
  headless: boolean
): Promise<string> {
  console.log("🚀 Launching browser...");
  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 500,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    console.log("🌐 Opening editor.huasheng.ai...");
    await page.goto("https://editor.huasheng.ai/", { waitUntil: "networkidle" });

    // Wait for editor to load
    await page.waitForSelector(".editor-content, [contenteditable]", { timeout: 10000 });
    console.log("✅ Editor loaded");

    // Clear existing content
    console.log("🧹 Clearing existing content...");
    await page.click(".editor-content, [contenteditable]");
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");

    // Paste markdown content
    console.log("📝 Pasting content...");
    await page.fill(".editor-content, [contenteditable]", markdownContent);

    // Wait for auto-format
    await page.waitForTimeout(2000);

    // Apply style if specified
    if (style && style !== "default") {
      console.log(`🎨 Applying style: ${style}...`);
      // Look for style/theme selector
      const styleButton = await page.$(`[data-style="${style}"], .style-${style}, button:has-text("${style}")`);
      if (styleButton) {
        await styleButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Get formatted HTML
    console.log("📋 Getting formatted HTML...");
    const html = await page.evaluate(() => {
      const editor = document.querySelector(".editor-content, [contenteditable]");
      return editor?.innerHTML || "";
    });

    console.log("✅ Formatting complete!");
    return html;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.input) {
    console.error("Error: --input is required");
    printUsage();
    process.exit(1);
  }

  const outputPath = args.output || args.input.replace(/\.md$/, ".html");
  const style = args.style || "default";

  console.log("📖 Reading markdown file...");
  const markdownContent = await readFile(args.input, "utf-8");
  console.log(`   Input: ${args.input}`);
  console.log(`   Style: ${style}`);
  console.log(`   Headless: ${args.headless}`);

  try {
    const html = await formatWithHuasheng(markdownContent, style, args.headless);

    // Save HTML
    const fs = await import("node:fs/promises");
    await fs.writeFile(outputPath, html, "utf-8");

    console.log(`\n✅ Formatted HTML saved: ${outputPath}`);
    console.log(`   Length: ${html.length} characters`);
  } catch (err) {
    console.error("\n❌ Formatting failed:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
