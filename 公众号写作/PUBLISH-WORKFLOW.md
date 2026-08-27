# 公众号文章自动发布流程

## 流程概述

```
浩哥手动排版 → 放入指定目录 → 默存自动发布
```

---

## 步骤 1: 浩哥手动排版

1. 使用 https://editor.huasheng.ai/ 进行排版
2. 导出排版后的 HTML 文件
3. 准备封面图（可选）

---

## 步骤 2: 放入指定目录

将排版好的文件放入以下目录：

```
/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/开发文件集/自动化写作Agent/公众号写作/_ready_to_publish/
```

**文件命名规范**：
- 文章 HTML: `文章标题.html`
- 封面图: `cover.png` 或 `封面图.png`
- 元数据（可选）: `文章标题.json`

**示例**：
```
_ready_to_publish/
├── 自动化写作 Agent 构建实战.html
├── cover.png
└── 自动化写作 Agent 构建实战.json
```

**元数据格式**（可选，用于自动提取信息）：
```json
{
  "title": "自动化写作 Agent 构建实战",
  "author": "28度活水馆",
  "cover": "cover.png",
  "digest": "文章摘要（可选）",
  "tags": ["AI", "自动化"]
}
```

---

## 步骤 3: 通知默存

放入文件后，通知默存：
- "文章已放入发布目录"
- 或发送文件路径

---

## 步骤 4: 默存自动发布

默存会执行以下操作：

### 4.1 检查文件
```bash
ls -la "_ready_to_publish/"
```

### 4.2 使用 agent-browser 自动发布

```bash
# 1. 打开公众号后台
agent-browser open https://mp.weixin.qq.com

# 2. 等待登录（如果是首次）
agent-browser wait --load networkidle

# 3. 获取页面元素
agent-browser snapshot -i

# 4. 点击"新的创作" -> "图文消息"
# （根据实际页面结构调整）

# 5. 填写标题
agent-browser fill @e1 "文章标题"

# 6. 粘贴内容
# 需要先将 HTML 内容复制到剪贴板

# 7. 上传封面图
# agent-browser click @e2

# 8. 保存草稿
# agent-browser click @e3
```

---

## 快捷命令

### 一键检查待发布文件
```bash
node scripts/auto-publish.js
```

### 手动发布（指定文件）
```bash
./scripts/publish-to-wechat-agent-browser.sh "文章标题" "_ready_to_publish/文章.html" "_ready_to_publish/cover.png"
```

---

## 注意事项

1. **首次登录**：如果 agent-browser 未登录公众号，需要扫码登录
2. **页面结构**：公众号后台页面结构可能变化，需要根据实际调整选择器
3. **安全**：agent-browser 会保存登录状态，下次自动复用
4. **备份**：发布前会备份文件到 `_published/` 目录

---

## 当前状态

**已准备好**：
- ✅ agent-browser 已安装 (v0.20.13)
- ✅ 自动发布脚本已创建
- ✅ 监控脚本已创建
- ✅ 测试文章已生成（自动化写作 Agent 构建实战）

**等待浩哥**：
- ⏳ 手动排版测试文章
- ⏳ 放入 `_ready_to_publish/` 目录
- ⏳ 通知默存执行自动发布

---

## 文件位置

| 文件 | 路径 |
|------|------|
| 待发布目录 | `公众号写作/_ready_to_publish/` |
| 已发布备份 | `公众号写作/_published/` |
| 自动发布脚本 | `公众号写作/scripts/auto-publish.js` |
| agent-browser 脚本 | `公众号写作/scripts/publish-to-wechat-agent-browser.sh` |
| 测试文章 | `公众号写作/_test_run/` |

---

**最后更新**: 2026-03-17
