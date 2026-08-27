#!/usr/bin/env bun
/**
 * Insert generated images into article markdown
 */

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

interface CliArgs {
  article: string;
  imagesDir: string;
  output?: string;
  help: boolean;
}

function printUsage(): void {
  console.log(`Usage:
  bun scripts/insert-images.ts --article <path> --images-dir <dir> [选项]

Options:
  --article <path>    文章 Markdown 文件路径（必填）
  --images-dir <dir>  图片目录路径（必填）
  --output <path>     输出文件路径（默认覆盖原文件）
  -h, --help          显示帮助

Examples:
  bun scripts/insert-images.ts --article article.md --images-dir ./imgs
  bun scripts/insert-images.ts --article article.md --images-dir ./imgs --output article-with-images.md
`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false, article: "", imagesDir: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--article" && argv[i + 1]) args.article = argv[++i];
    else if (arg === "--images-dir" && argv[i + 1]) args.imagesDir = argv[++i];
    else if (arg === "--output" && argv[i + 1]) args.output = argv[++i];
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function findInsertPositions(content: string): number[] {
  const positions: number[] = [];
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterEnd = -1;

  // Find frontmatter end
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.startsWith("---")) {
      if (i === 0) inFrontmatter = true;
      else if (inFrontmatter) {
        frontmatterEnd = i;
        break;
      }
    }
  }

  // Find h2 headings after frontmatter
  for (let i = frontmatterEnd + 1; i < lines.length; i++) {
    if (lines[i]!.startsWith("## ")) {
      positions.push(i);
    }
  }

  return positions;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.article || !args.imagesDir) {
    console.error("Error: --article and --images-dir are required");
    printUsage();
    process.exit(1);
  }

  console.log("📝 Reading article...");
  const content = await readFile(args.article, "utf-8");

  console.log("🔍 Finding insert positions...");
  const positions = findInsertPositions(content);
  console.log(`   Found ${positions.length} sections`);

  const lines = content.split("\n");
  const imageFiles = [
    "illustration-01.png",
    "illustration-02.png",
    "illustration-03.png",
    "illustration-04.png",
    "illustration-05.png",
    "illustration-06.png",
  ];

  console.log("🖼️ Inserting images...");
  let inserted = 0;
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    resultLines.push(lines[i]!);

    // Insert image after h2 heading (if we have images left)
    if (positions.includes(i) && inserted < imageFiles.length) {
      const imageFile = imageFiles[inserted];
      const imagePath = `${args.imagesDir}/${imageFile}`;
      resultLines.push("");
      resultLines.push(`![配图 ${inserted + 1}](${imagePath})`);
      resultLines.push("");
      inserted++;
      console.log(`   Inserted ${imageFile} after line ${i + 1}`);
    }
  }

  const outputPath = args.output || args.article;
  await writeFile(outputPath, resultLines.join("\n"), "utf-8");

  console.log(`\n✅ Done! Inserted ${inserted} images.`);
  console.log(`   Output: ${outputPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
