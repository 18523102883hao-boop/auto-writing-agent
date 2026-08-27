# Harness工程知识库

## 信息收集时间
2026-04-23

## 核心概念来源
B站视频《关于Harness工程，你可能错过的一个视角》
UP主视频转录内容

## Harness定义
Harness直译是"马具"——让马更好完成工作的工具（胸带、鞍具等）。

在AI领域：
**AI Agent = 模型 + Harness**

Harness是除模型外的一切，让AI正常工作的软件环境或基础设施：
- Cloud Code
- OpenClaw
- 各种工具链

## Harness核心原理
通过**反馈循环**解决大模型输出的概率性问题：
1. AI调用工具
2. 出错/结果不对
3. 反馈纠正
4. 再次尝试
5. 直到正确

有效的Harness = 能通过反馈循环提供约束，限制AI输出的随机性

## 被忽略的独特视角
**大家都在讨论用Harness解决软件工程问题，但Harness还可以控制多模态输出质量（图片、视频、音频）**

### 实际案例
作者自己做Bio生成器的经历：
- 问题：大模型生成的提示词不可靠，生成内容无法检查好坏
- 解决方案：用视觉多模态模型作为"裁判"给图片打分
- 方法：将提示词和用户需求分解成多个客观维度的判断问题（如"猫咪是否是黑白相间"、"当前是否是中午"）
- 效果：通过不断调整提示词、重复打分、记录历史轨迹，AI从失败中学习，找到控制图片效果的关键词

### 前沿案例：CardClaw论文
- 6个组件 + 4种模型组合编排
- Whisper识别字幕 → 算法镜头切割 → Gemini Pro编辑 → 千问理解音乐 → Minimax精准裁切 → 千问VL三维度审查
- 用多模态模型审查生成内容，实现对抗网络思路

## 业界讨论维度（来自Anthropic/OpenAI/Cursor）
从Harness效果来分：
1. 让人类更少介入
2. 让AI Agent运行更久
3. 让更多AI Agent协作解决复杂问题
4. 用更少token完成任务（Andrej Karpathy观点）

## Anthropic官方观点
来自《Building Effective Agents》：
- Workflow：LLM和工具通过预定义代码路径编排
- Agent：LLM动态指导自己的过程和工具使用
- 核心模式：Prompt Chaining、Routing、Parallelization、Orchestrator-workers、Evaluator-optimizer
- Evaluator-optimizer模式与Harness反馈循环原理一致

## 关键结论
1. MLM（多模态模型）的Harness是下一个重要方向
2. 内容生产不应该仅限于文本
3. 可以用算法+多模态模型检查视频、图像、音频甚至情绪
4. 复杂的多模态模型编排可实现更复杂内容（如短剧生产）

## 与目标读者关联
- 一人公司/超级个体：Harness可自动化内容生产的质量控制
- 创作者：多模态Harness让AI生成更可控
- 技术爱好者：理解AI Agent的底层逻辑

## 参考资料
- https://www.bilibili.com/video/BV1jRD6BvEAS/
- https://www.anthropic.com/engineering/building-effective-agents
- https://github.com/anthropics/claude-cookbooks
