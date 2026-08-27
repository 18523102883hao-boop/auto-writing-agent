# Dev Learnings - 公众号写作Agent

## 2026-04-30: Harness工程文章写作复盘

### 发现的有效方法
1. **两阶段翻译法**：从英文视频/论文转化为中文公众号文章时，先"逐节翻译"保证内容完整性，再"整体润色"保证风格一致性。这比单轮翻译更容易达到高质量。

2. **口语化检查清单**（必须执行）：
   - 是否有英文单词未翻译（ChatGPT、Claude、Runway等产品名除外）
   - 是否有英文副词/连接词：ultimately, unprecedented, emerge, genuinely, conversely, notably, significantly...
   - 是否有"翻译腔"长句（英文复杂句式直译后的中文长句）
   - 是否有"而更重要的是"、"值得注意的是"等翻译套路

### 发现的坑
1. **批量替换英文的风险**："钩子"会被错误匹配为需要处理的英文。批量替换前必须先保护行业内通用行话（钩子、gou子、ROI、GMV、CPC、ROI、DAU等）。

2. **回滚的代价**：如果Step 6-8没做好口语化，Step 9可能需要回滚到整个章节重写，代价很大。

### 改进动作
- [待执行] 在 wechat-writing-workflow skill 的 Step 6 中增加"口语化检查"子步骤
- [待执行] 在 wechat-writing-workflow skill 的 Step 9 增加"行话保护"提示
