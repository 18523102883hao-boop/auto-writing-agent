# 自动化写作 Agent 流程恢复与工程化优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让公众号自动化写作 Agent 的 9 步主流程能够被预检、离线演练、断点恢复和安全验证，并修复当前会导致流程中断或误报成功的工程问题。

**Architecture:** 以 `公众号写作/` 作为唯一运行时项目；保留 9 步写作规范和人工确认闸门，把外部服务封装成可替换适配器；用一个可恢复的流程编排器连接研究、草稿、审查、配图、排版和发布；所有真实网络调用和发布动作都必须显式启用。

**Tech Stack:** Node.js、Node 内置 `node:test`、现有 Playwright、Tavily、DashScope、微信公众号 API/浏览器发布脚本、Markdown/HTML 文件工作流。

---

## 现状与约束

- `公众号写作/` 是当前应保留的运行时入口；旧版 `_rollback_backup_2026-03-16-codex-v2/` 已证明不能直接运行，不得重新作为默认入口。
- 9 步流程中的选题确认、风格确认和三轮审查确认必须保留，不能因为自动化而静默跳过。
- 当前项目的密钥只能来自环境变量或本机未纳入版本控制的配置；仓库中不得出现真实 token、AppSecret 或 cookie。
- 发布必须是显式动作。失败、超时或无法验证发布结果时，不得把文件移动到 `_published/`。
- 测试默认离线，禁止在测试中消耗 Tavily、DashScope 或公众号接口额度。

## 实施任务

### 1. 建立运行时配置和预检层

**先写测试：**

- 新增 `公众号写作/tests/config.test.js`，覆盖项目根目录解析、相对目录解析、`.env` 缺失、必需变量缺失和敏感值不出现在错误信息中。
- 新增 `公众号写作/tests/preflight.test.js`，覆盖依赖、目录、Node 版本和配置检查；预检失败必须返回非零状态码。

**实现：**

- 新增集中配置模块，例如 `公众号写作/scripts/lib/config.js`，从当前脚本目录反推出项目根目录，不再依赖 `/Users/Zhuanz` 或 `.openclaw` 绝对路径。
- 新增 `公众号写作/scripts/preflight.js`，提供机器可读结果和人类可读摘要。
- 更新 `.env.example`、README 和 CLAUDE 文档，明确 `TAVILY_API_KEY`、`DASHSCOPE_API_KEY`、公众号账号配置及可选的 Playwright/CDP 配置。
- 配置加载只返回是否存在、来源和校验结果；日志中不得打印密钥值。

**验证：** `npm test -- --runInBand`（或项目实际测试命令）和 `node scripts/preflight.js --json` 在无真实密钥环境下给出明确、可诊断的失败结果。

### 2. 修复并统一研究、图像和排版适配器

**先写测试：**

- 为 Tavily 客户端增加 mock `fetch` 测试：成功响应、HTTP 错误、无效 JSON、超时和有限重试。
- 为 DashScope 图像任务增加 mock 测试：提交失败、轮询成功、轮询失败、超时和下载响应类型错误。
- 为排版脚本增加选择器失败和页面加载超时测试，确保错误不会被吞掉。

**实现：**

- 把 `tavily-search.js`、`baoyu-article-illustrator.js`、`baoyu-cover-image.js` 中的网络调用抽成可注入客户端。
- 所有 HTTP 调用检查状态码、响应类型、超时和可重试条件；错误包含阶段、目标服务和下一步建议，但不包含凭据。
- 保留现有命令行用法，新增 `--dry-run`/mock 入口，便于离线验证。
- 统一 `.agents/skills` 与 `skills` 的来源说明，避免两份代码继续无声漂移；只有在验证引用关系后才做删除或替换。

### 3. 建立可恢复的 9 步流程编排器

**先写测试：**

- 新增 `公众号写作/tests/workflow.test.js`，使用 fixture 验证从 brief 到 research、draft、review、illustration、format 的顺序。
- 覆盖中断后从指定阶段恢复、重复执行幂等、阶段失败保留现场和人工确认闸门。
- 覆盖旧版错误路径不会被调用，且没有将对象错误地传给文章生成函数的问题。

**实现：**

- 新增一个清晰的入口（建议 `公众号写作/scripts/run-workflow.js`），支持 `--dry-run`、`--from <stage>`、`--to <stage>`、`--fixture` 和 `--json`。
- 每个阶段写入阶段状态、输入输出文件和错误摘要，使用原子写入，避免半成品覆盖正式文件。
- 阶段名称与 `写作流程检查清单.md` 保持一致，并将发布作为附加阶段而不是隐式步骤。
- 需要用户确认的阶段必须暂停并返回可恢复状态；不得用默认答案自动通过。
- 旧版 runner 仅作为历史参考，不能再被 npm script 或文档作为启动入口。

### 4. 修复发布安全性

**先写测试：**

- 新增 `公众号写作/tests/publish.test.js`，验证：发布失败时文件仍在 `_ready_to_publish/`；真实成功且可验证时才进入 `_published/`；重复运行不会重复发布。
- 覆盖 API 返回错误、浏览器登录失效、超时和“脚本退出但结果未知”。

**实现：**

- 重构 `auto-publish.js` 和相关发布脚本，让“上传/提交成功”和“可验证的发布结果”成为移动文件的必要条件。
- 默认只执行预览或 dry-run；真实发布必须使用显式 `--publish`，并在日志中显示目标账号和文件摘要，不显示凭据。
- 发布过程使用临时状态文件或 manifest，支持失败恢复和人工复核。

### 5. 文档、命令和依赖收口

- 更新根目录 `CLAUDE.md`、`公众号写作/CLAUDE.md`、`PUBLISH-WORKFLOW.md` 和流程清单，删除失效的 `.openclaw` 路径、过时命令和“已完成但实际未验证”的表述。
- 在 `公众号写作/package.json` 中提供统一的 `test`、`preflight`、`workflow:dry-run` 和语法检查命令；不要在根目录重复安装另一套依赖。
- 增加从新机器开始的安装与恢复说明，包括 Playwright 浏览器安装、环境变量、目录结构和安全发布流程。
- 对历史备份和生成物做明确归档说明；不要把敏感旧历史重新加入公开仓库。

## 完成标准

- `npm test` 全部通过，测试不访问真实外部 API。
- 全部现行 JavaScript 通过 `node --check`，Shell/Python 辅助脚本通过各自语法检查。
- `preflight` 能在“配置完整”和“配置缺失”两种环境下给出正确状态码。
- `workflow --dry-run --fixture` 能完整走通 9 步流程，且会在人工确认点暂停或明确报告待确认状态。
- 发布失败不会污染 `_published/`，发布成功的判断有可验证证据。
- 仓库扫描不到真实密钥，Git diff 中不出现本机绝对路径或用户隐私配置。
- OpenCode 完成后由 Claude 做一次只读代码审查；审查发现的问题必须修复并重新运行验证。
- 最终只把经过验证的开发分支合并到 `main`，并推送到 `origin/main`。

## 回滚方案

- 完整原始本地基线：`backup/original-main-2026-08-27`。
- 原始提交标签：`backup/pre-optimization-2026-08-27`。
- 公开 GitHub 基线不包含旧版敏感备份目录和生成报告；如需恢复旧版，使用本地回滚分支，不将其推入 public 仓库。

