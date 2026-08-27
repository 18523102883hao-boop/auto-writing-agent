---
name: knowledge-kb
description: 管理个人 Knowledge 知识库。适用于检索知识索引、打开既有条目、整理标签、维护索引，以及把新的链接/文章/视频交给 knowledge-ingest 入库。用户提到“知识库”“knowledge”“索引”“入库”“Obsidian 知识库”时使用。
---

# Knowledge KB

Knowledge 模块的权威入口不是全库扫描，而是索引优先、按需展开。

## 权威路径

- 主知识库：`/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/AI日报开发dify/knowledge`
- 兼容备选：`/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/我的知识库（基于obsidian）`

## 默认工作方式

1. 检索时先读取 `_index.md`
2. 按标签、标题、摘要定位候选条目
3. 只按需打开目标文件，不做全库遍历
4. 用户要求“收录/入库/处理链接”时，调用：

```bash
python3 ~/.openclaw/skills/knowledge-ingest/scripts/ingest.py "<URL>"
```

5. 入库完成后，确认 `_index.md` 已更新，并返回生成文件路径

## 推荐触发语句

- “帮我查一下知识库里有没有这个主题”
- “把这篇内容放入知识库”
- “更新一下知识库索引”
- “看看这个主题之前有没有整理过”

## 注意事项

- 不要默认扫描整个知识库目录
- 如果存在多个候选条目，先给用户候选列表再展开全文
- 知识库入库优先使用 `knowledge-ingest`
- B 站视频和公众号文章分别由 `bilibili-transcriber`、`wechat-article-to-md` 提供底层能力
