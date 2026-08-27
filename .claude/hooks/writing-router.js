#!/usr/bin/env node
/**
 * UserPromptSubmit hook：写作工作流自动激活路由器
 *
 * 你每发一条消息，Claude Code 在模型读到之前先跑这个脚本。
 * 命中写作意图 → 把对应工作流的激活指令注入上下文，模型无法"忘记"走流程。
 *
 * 设计原则：
 * - 只「提醒」，不阻断、不强制 —— 保留 修改/审校/快速咨询 等轻流程的灵活性。
 * - 解析失败一律静默放行（exit 0），绝不卡住用户输入。
 */

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let prompt = '';
  try {
    prompt = (JSON.parse(input).prompt || '').toString();
  } catch (_) {
    process.exit(0); // 解析失败不阻断
  }
  if (!prompt.trim()) process.exit(0);

  const routes = [
    {
      name: '公众号写作',
      test: /公众号|长文|推文|深度文|爆款|写[\s\S]{0,12}?(文章|稿|推文|长文)/,
      msg: [
        '[写作路由器] 检测到「公众号写作」意图。',
        '若用户要写新文章 / 长文（任务类型 A 或 B），必须按 9 步流程执行：',
        '  1. 先读 公众号写作/写作流程检查清单.md 与 公众号写作/CLAUDE.md',
        '  2. 开场白明确说「现在开始执行公众号写作流程，共9步」',
        '  3. 在 Step 3(选题) / Step 5(风格) / Step 8(三遍审校) 必须停下等用户确认',
        '  4. 调用 个人素材库/ 和 _published/ 里的真实素材压制 AI 腔',
        '若只是修改(C) / 审校降AI味(D) / 快速咨询(E)，走对应轻流程，不必强制 9 步。',
      ].join('\n'),
    },
    {
      name: '抖音脚本',
      test: /抖音|短视频脚本|口播脚本|投流|带货(脚本|话术)/,
      msg: '[写作路由器] 检测到「抖音脚本」意图。请先读 抖音脚本/CLAUDE.md，并明确说「现在开始进入抖音脚本工作流」。',
    },
    {
      name: '小红书内容',
      test: /小红书|种草|图文笔记|小红书文案|xhs/i,
      msg: '[写作路由器] 检测到「小红书内容」意图。请先读 小红书内容/CLAUDE.md，并明确说「现在开始进入小红书内容工作流」。',
    },
    {
      name: '视频号内容',
      test: /视频号/,
      msg: '[写作路由器] 检测到「视频号内容」意图。请先读 视频号内容/CLAUDE.md，并明确说「现在开始进入视频号内容工作流」。',
    },
  ];

  const hits = routes.filter((r) => r.test.test(prompt));
  if (hits.length === 0) process.exit(0);

  // 命中多个（罕见）时全部提醒，交给模型按内容形式判断进哪个工作区。
  process.stdout.write(hits.map((h) => h.msg).join('\n\n') + '\n');
  process.exit(0);
});
