#!/bin/bash
# 使用 agent-browser 自动发布文章到公众号
# 用法: ./publish-to-wechat-agent-browser.sh <标题> <HTML文件路径> [封面图路径]

set -e

TITLE="$1"
HTML_FILE="$2"
COVER_FILE="$3"

if [ -z "$TITLE" ] || [ -z "$HTML_FILE" ]; then
  echo "使用方法:"
  echo "  $0 <标题> <HTML文件路径> [封面图路径]"
  echo ""
  echo "示例:"
  echo "  $0 '文章标题' article.html cover.png"
  exit 1
fi

if [ ! -f "$HTML_FILE" ]; then
  echo "❌ 文件不存在: $HTML_FILE"
  exit 1
fi

echo "🚀 开始自动发布流程..."
echo "   标题: $TITLE"
echo "   文件: $HTML_FILE"
echo "   封面: ${COVER_FILE:-无}"

# 1. 打开公众号后台
echo ""
echo "📄 步骤 1: 打开公众号后台..."
agent-browser open https://mp.weixin.qq.com

# 2. 等待页面加载
echo "⏳ 步骤 2: 等待页面加载..."
agent-browser wait --load networkidle

# 3. 获取页面状态
echo "📸 步骤 3: 获取页面元素..."
agent-browser snapshot -i

# 注：以下步骤需要根据实际页面结构调整
# 因为公众号后台页面结构可能变化，这里提供参考命令

echo ""
echo "⚠️ 注意: 以下步骤需要根据实际页面结构调整"
echo ""
echo "建议的手动操作："
echo "   1. 如果未登录，先扫码登录"
echo "   2. 点击'新的创作' -> '图文消息'"
echo "   3. 在标题框输入: $TITLE"
echo "   4. 在正文区域粘贴 HTML 内容"
echo "   5. 上传封面图: ${COVER_FILE:-（使用默认）}"
echo "   6. 保存草稿或发布"
echo ""
echo "💡 可以使用以下 agent-browser 命令辅助操作:"
echo ""
echo "# 获取当前页面元素"
echo "agent-browser snapshot -i"
echo ""
echo "# 点击元素（使用 @eN 引用）"
echo "agent-browser click @e1"
echo ""
echo "# 填写标题"
echo "agent-browser fill @e1 '$TITLE'"
echo ""
echo "# 上传封面（如果需要）"
echo "agent-browser click @e2  # 上传按钮"
echo ""
echo "# 保存草稿"
echo "agent-browser click @e3  # 保存按钮"
echo ""
echo "✅ 发布流程准备完成"
