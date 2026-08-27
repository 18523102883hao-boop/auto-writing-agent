#!/usr/bin/env bun
/**
 * baoyu-cover-image wrapper script
 * Calls baoyu-image-gen with cover-optimized prompts
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

interface CliArgs {
  title?: string;
  subtitle?: string;
  type?: string;
  palette?: string;
  rendering?: string;
  aspect?: string;
  output?: string;
  help: boolean;
}

function printUsage(): void {
  console.log(`Usage:
  bun scripts/generate.ts --title "文章标题" [选项]

Options:
  --title <text>      文章主标题（必填）
  --subtitle <text>   副标题（可选）
  --type <name>       封面类型: hero, conceptual, typography, metaphor, scene, minimal
  --palette <name>    配色: warm, elegant, cool, dark, earth, vivid, pastel, mono, retro, duotone
  --rendering <name>  渲染风格: flat-vector, hand-drawn, painterly, digital, pixel, chalk, screen-print
  --aspect <ratio>    比例: 16:9, 2.35:1, 4:3, 1:1 (默认 16:9)
  --output <path>     输出路径 (默认 cover.png)
  -h, --help          显示帮助

Examples:
  bun scripts/generate.ts --title "AI时代" --subtitle "谁先用谁先赢" --palette cool
  bun scripts/generate.ts --title "儿童游泳" --type family --aspect 16:9
`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--title" && argv[i + 1]) args.title = argv[++i];
    else if (arg === "--subtitle" && argv[i + 1]) args.subtitle = argv[++i];
    else if (arg === "--type" && argv[i + 1]) args.type = argv[++i];
    else if (arg === "--palette" && argv[i + 1]) args.palette = argv[++i];
    else if (arg === "--rendering" && argv[i + 1]) args.rendering = argv[++i];
    else if (arg === "--aspect" && argv[i + 1]) args.aspect = argv[++i];
    else if (arg === "--output" && argv[i + 1]) args.output = argv[++i];
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function buildPrompt(args: CliArgs): string {
  const paletteMap: Record<string, string> = {
    warm: "warm oranges and yellows, inviting atmosphere",
    elegant: "elegant purples and golds, sophisticated style",
    cool: "cool blues and cyans, tech-forward feeling",
    dark: "dark moody tones, dramatic lighting",
    earth: "earthy browns and greens, natural organic",
    vivid: "vibrant saturated colors, energetic pop",
    pastel: "soft pastels, gentle calming",
    mono: "monochrome black and white, minimalist",
    retro: "retro vintage colors, nostalgic feeling",
    duotone: "duotone contrast, modern graphic",
  };

  const typeMap: Record<string, string> = {
    hero: "hero shot, bold impactful visual, centerpiece focus",
    conceptual: "conceptual illustration, abstract ideas visualized",
    typography: "typography-focused, text as design element",
    metaphor: "visual metaphor, symbolic representation",
    scene: "scene setting, environmental storytelling",
    minimal: "minimalist clean design, negative space",
  };

  const renderingMap: Record<string, string> = {
    "flat-vector": "flat vector illustration, clean geometric shapes",
    "hand-drawn": "hand-drawn sketch style, organic lines",
    painterly: "painterly artistic style, brush strokes visible",
    digital: "digital art style, modern crisp rendering",
    pixel: "pixel art retro style, 8-bit aesthetic",
    chalk: "chalkboard hand-drawn style, educational feel",
    "screen-print": "screen print poster style, bold limited colors",
  };

  const palette = paletteMap[args.palette || "cool"] || paletteMap.cool;
  const type = typeMap[args.type || "conceptual"] || typeMap.conceptual;
  const rendering = renderingMap[args.rendering || "digital"] || renderingMap.digital;

  let prompt = `Article cover image for WeChat Official Account. `;
  prompt += `${type}. ${rendering}. ${palette}. `;
  prompt += `Main title: "${args.title}". `;
  if (args.subtitle) {
    prompt += `Subtitle: "${args.subtitle}". `;
  }
  prompt += `Professional editorial design, high quality, suitable for social media header. `;
  prompt += `No text in image, visual only.`;

  return prompt;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.title) {
    console.error("Error: --title is required");
    printUsage();
    process.exit(1);
  }

  const outputPath = args.output || "cover.png";
  const aspectRatio = args.aspect || "16:9";

  console.log("🎨 Generating cover image...");
  console.log(`   Title: ${args.title}`);
  if (args.subtitle) console.log(`   Subtitle: ${args.subtitle}`);
  console.log(`   Type: ${args.type || "conceptual"}`);
  console.log(`   Palette: ${args.palette || "cool"}`);
  console.log(`   Rendering: ${args.rendering || "digital"}`);
  console.log(`   Aspect: ${aspectRatio}`);
  console.log(`   Output: ${outputPath}`);

  // Build prompt
  const prompt = buildPrompt(args);
  console.log("\n📝 Prompt:");
  console.log(prompt.substring(0, 100) + "...");

  // Create temp prompt file
  const tempDir = `/tmp/baoyu-cover-${Date.now()}`;
  await mkdir(tempDir, { recursive: true });
  const promptFile = join(tempDir, "prompt.md");
  await writeFile(promptFile, prompt, "utf-8");

  // Call baoyu-image-gen with DashScope provider
  const skillDir = dirname(dirname(process.argv[1]));
  const imageGenScript = join(skillDir, "../baoyu-image-gen/scripts/main.ts");

  console.log("\n🚀 Calling baoyu-image-gen (DashScope)...");
  const result = spawnSync(
    "bun",
    [
      imageGenScript,
      "--promptfiles",
      promptFile,
      "--image",
      outputPath,
      "--ar",
      aspectRatio,
      "--quality",
      "2k",
      "--provider",
      "dashscope",
      "--model",
      "qwen-image-2.0-pro",
    ],
    {
      stdio: "inherit",
      env: { ...process.env },
    }
  );

  if (result.status !== 0) {
    console.error("\n❌ Cover generation failed");
    process.exit(1);
  }

  console.log(`\n✅ Cover image saved: ${outputPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
