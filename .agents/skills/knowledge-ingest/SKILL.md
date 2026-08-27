---
name: knowledge-ingest
description: 自动将文章、视频、飞书文档和网页内容收录到 Knowledge 知识库。用户提到“放入知识库”“收录这个视频”“保存到知识库”“知识入库”“处理这个链接”时使用。
argument-hint: <URL> [--dry-run]
---

# Knowledge Ingest Skill

自动将文章、视频等内容收录到 Knowledge 知识库。

## 执行入口

**主脚本**: `scripts/ingest.py`

当用户触发知识入库时，执行：
```bash
python3 ~/.openclaw/workspace/skills/knowledge-ingest/scripts/ingest.py "<URL>"
```

或使用试运行模式（不保存文件）：
```bash
python3 ~/.openclaw/workspace/skills/knowledge-ingest/scripts/ingest.py "<URL>" --dry-run
```

## 触发方式

用户说以下任意一种表达时自动触发：
- "把这篇文章放入知识库"
- "收录这个视频"
- "保存到知识库"
- "知识库入库"
- "添加到知识库"
- "处理这个链接"

## 支持的来源

1. **微信公众号文章** - 自动抓取 + 图片下载 + Markdown 转换
2. **B站视频** - 自动下载 + Whisper 转录
3. **飞书文档** - 自动读取内容
4. **网页文章** - 自动抓取正文
5. **YouTube** - 自动下载 + 转录（未来扩展）

## 执行流程

### 1. 识别来源类型
```
微信公众号: mp.weixin.qq.com
B站: b23.tv, bilibili.com, BV号
飞书: feishu.cn/wiki, feishu.cn/docx
网页: http://, https://
```

### 2. 自动选择处理方式

**微信公众号文章:**
1. 使用 wechat-article-to-md 抓取文章
2. 自动下载图片到 attachments/img/
3. 生成知识条目（metadata + 摘要 + 全文）
4. 保存到 `knowledge/YYYY-MM-DD-标题.md`
5. 更新 `_index.md`

**B站视频:**
1. 使用 bilibili-transcriber 下载视频
2. 使用 Whisper base 转录
3. 生成知识条目（metadata + 摘要 + 全文）
4. 保存到 `knowledge/YYYY-MM-DD-标题.md`
5. 更新 `_index.md`

**飞书文档:**
1. 使用 feishu_doc 读取内容
2. 生成知识条目
3. 保存到 `knowledge/YYYY-MM-DD-标题.md`
4. 更新 `_index.md`

**网页文章:**
1. 使用 web_fetch 抓取正文
2. 生成知识条目
3. 保存到 `knowledge/YYYY-MM-DD-标题.md`
4. 更新 `_index.md`

### 3. 生成知识条目格式

```markdown
---
date: YYYY-MM-DD
source: 来源名称
source_type: article/video/wiki
source_url: "原始链接"
tags:
  - 自动提取标签
confidence: processed
---

# 标题

## 核心观点
[AI 生成的 3-5 句摘要]

## 我的思考
[可选：用户后续补充]

## 原始内容
[完整正文/转录内容]
```

## 使用示例

### 示例 1: 微信公众号文章
**用户**: "把这篇文章放入知识库 https://mp.weixin.qq.com/s/xxxxx" 或转发公众号文章

**AI 执行**:
```bash
python3 ~/.openclaw/workspace/skills/knowledge-ingest/scripts/ingest.py "https://mp.weixin.qq.com/s/xxxxx"
```

或分步执行：
1. 识别为微信公众号链接
2. 调用 `scripts/ingest.py` 处理
3. 脚本自动调用 wechat-article-to-md 抓取
4. 生成条目: `2026-03-15-文章标题.md`
5. 更新索引
6. 回复: "✅ 已收录，生成知识条目，图片已下载"

### 示例 2: B站视频
**用户**: "把这个视频放入知识库 https://b23.tv/XSYa1zi"

**AI 执行**:
```bash
python3 ~/.openclaw/workspace/skills/knowledge-ingest/scripts/ingest.py "https://b23.tv/XSYa1zi"
```

或分步执行：
1. 识别为 B站链接
2. 调用 `scripts/ingest.py` 处理
3. 脚本自动调用 bilibili-transcriber 下载 + Whisper 转录
4. 生成条目: `2026-03-15-Claude官方揭秘为啥不需要多Agent架构.md`
5. 更新索引
6. 回复: "✅ 已收录，生成知识条目，转录内容约 5000 字"

### 示例 3: 飞书文档
**用户**: "保存这篇文档到知识库 https://mcndg9yue1j0.feishu.cn/wiki/xxx"

**AI 执行**:
1. 识别为飞书 Wiki
2. 调用 feishu_doc 读取
3. 生成条目: `2026-03-15-文档标题.md`
4. 更新索引
5. 回复: "✅ 已收录，生成知识条目，内容约 3000 字"

### 示例 4: 网页文章
**用户**: "把这篇文章放入知识库 https://example.com/article"

**AI 执行**:
1. 识别为网页链接
2. 调用 web_fetch 抓取
3. 生成条目
4. 更新索引
5. 回复: "✅ 已收录"

## 路径配置

```json
{
  "knowledge_base_path": "/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/AI日报开发dify/knowledge/",
  "index_file": "_index.md",
  "inbox_manual": "inbox/manual/pending/",
  "inbox_video": "inbox/video/raw/"
}
```

## 依赖

- wechat-article-to-md skill（微信公众号）
- bilibili-transcriber skill（B站视频）
- feishu_doc tool（飞书文档）
- web_fetch tool（网页文章）
- Whisper (本地)
- ffmpeg
- BBDown

## 输出

成功后会返回：
- 生成的知识条目路径
- 内容字数统计
- 提取的标签
- 索引更新状态

## 故障处理

| 问题 | 处理方式 |
|------|---------|
| 链接无法访问 | 告知用户检查链接有效性 |
| 视频下载失败 | 检查 BBDown 配置，或建议手动下载 |
| 转录失败 | 检查 Whisper 安装，或改用在线转录服务 |
| 权限不足 | 提示用户开通相应权限（如飞书 doc:read） |
| 重复内容 | 检查是否已存在相同 URL 的条目，询问是否覆盖 |

## 注意事项

1. 自动提取 3-5 个标签，基于内容主题
2. 生成核心观点摘要，3-5 句话
3. 保留完整原始内容，方便追溯
4. 每次入库后必须更新 _index.md
5. 遇到不确定的情况，询问用户而不是猜测
