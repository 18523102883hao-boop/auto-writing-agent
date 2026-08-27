---
name: wechat-writing-workflow
description: 公众号写作 9 步工作流。用于公众号长文、深度内容、brief 梳理、选题讨论、风格学习、三遍审校和配图。用户提到"公众号文章""写一篇长文""帮我做公众号写作流程""按 9 步写作流程来"时使用。
---

# 公众号写作 9 步工作流

这是整套写作流程，不是单个发布 skill。

## 步数口径（统一标准）

- **主流程 = 9 步**：1 理解需求&Brief → 2 搜索 → 3 选题讨论 → 4 协作文档 → 5 学风格 → 6 等数据 → 7 初稿 → 8 三遍审校 → 9 配图
- **发布附录 = 封面 / 排版 / 发布**，可选、可手动可自动化，**不计入 9 步**

## 必读文件顺序

1. `/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/开发文件集/自动化写作Agent/CLAUDE.md`
2. `/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/开发文件集/自动化写作Agent/公众号写作/写作流程检查清单.md`
3. `/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/开发文件集/自动化写作Agent/公众号写作/CLAUDE.md`

## 开始方式

开始执行时，先明确说：

`现在开始执行公众号写作流程，共9步`

## 执行纪律

- Step 1-9 是写作核心（含配图），不能被自动化工具替代
- Step 3 选题讨论后必须停下来等用户确认
- Step 5 风格理解后必须停下来等用户确认
- Step 8 三遍审校完成后必须停下来等用户确认终稿
- 只有用户明确要求或流程推进到后半段时，才进入发布附录（封面/排版/发布）

## 发布附录的增强工具（可选，不计入 9 步）

- Step 9 配图：`baoyu-article-illustrator`
- 封面：`baoyu-cover-image`
- 排版：项目内排版脚本或浏览器自动化
- 发布：`baoyu-post-to-wechat`

## 不可混淆规则

- `baoyu-post-to-wechat` 只是发布附录的一个工具，不等于公众号写作流程
- 如果用户只是要"写一篇公众号文章"，默认先走 9 步流程，而不是直接进入发布环节
- 如果用户说"按我之前的 9 步流程来"，必须优先命中这个 workflow skill
