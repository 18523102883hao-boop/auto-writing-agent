#!/usr/bin/env node
/**
 * Tavily 搜索与配图生成联动
 * 从搜索结果提取关键词，生成精准的配图提示词
 */

const fs = require('fs');
const path = require('path');
const { tavilySearch } = require('./tavily-search');

const KNOWLEDGE_BASE_DIR = path.join(__dirname, '..', '_knowledge_base');
const ILLUSTRATION_PROMPTS_DIR = path.join(__dirname, '..', 'illustration_prompts');

/**
 * 从搜索结果提取视觉关键词
 * @param {Object} searchResult - Tavily 搜索结果
 * @returns {Array} 视觉关键词列表
 */
function extractVisualKeywords(searchResult) {
  const keywords = new Set();
  
  if (searchResult.results) {
    searchResult.results.forEach(result => {
      // 从标题提取
      if (result.title) {
        const titleKeywords = extractNouns(result.title);
        titleKeywords.forEach(k => keywords.add(k));
      }
      
      // 从内容提取（取前100字）
      if (result.content) {
        const contentKeywords = extractNouns(result.content.substring(0, 200));
        contentKeywords.forEach(k => keywords.add(k));
      }
    });
  }
  
  // 从 AI 摘要提取
  if (searchResult.answer) {
    const answerKeywords = extractNouns(searchResult.answer);
    answerKeywords.forEach(k => keywords.add(k));
  }
  
  return Array.from(keywords).slice(0, 10); // 取前10个
}

/**
 * 简单名词提取（中文）
 */
function extractNouns(text) {
  // 常见的视觉相关词汇
  const visualPatterns = [
    /游泳/g, /训练/g, /泳池/g, /健身/g, /运动/g,
    /青少年/g, /儿童/g, /孩子/g, /家长/g,
    /科技/g, /AI/g, /智能/g, /数字化/g,
    /健康/g, /养生/g, /康复/g, /体能/g,
    /比赛/g, /竞技/g, /金牌/g, /冠军/g,
    /教学/g, /课程/g, /培训/g, /学习/g,
    /水/g, /蓝色/g, /阳光/g, /室内/g, /户外/g
  ];
  
  const found = [];
  visualPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      found.push(pattern.source.replace(/\\/g, '').replace(/\//g, ''));
    }
  });
  
  return [...new Set(found)];
}

/**
 * 根据内容自动检测配图风格
 * @param {string} topic - 文章主题
 * @param {Array} keywords - 视觉关键词
 * @returns {string} 风格类型
 */
function detectStyleFromContent(topic, keywords) {
  const content = (topic + ' ' + keywords.join(' ')).toLowerCase();
  
  // 风格关键词映射（按优先级排序）
  const stylePatterns = {
    // 科技类优先级最高（因为通常包含"智能"等词）
    tech: {
      keywords: ['ai', '人工智能', '科技', '数字化', '算法', '代码', '编程', '大模型', 'openclaw', 'claude', 'claude code', 'llm', 'agent', '自动化', 'github', '开源'],
      weight: 2 // 科技类权重更高
    },
    health: {
      keywords: ['健康', '养生', '康复', '康养', '中医', '药汤', '治疗', '调理', '免疫力', '亚健康', '体医融合'],
      weight: 1
    },
    family: {
      keywords: ['亲子', '家庭', '孩子', '家长', '陪伴', '成长', '教育', '儿童', '宝贝', '妈妈', '爸爸', '少儿'],
      weight: 1
    },
    sport: {
      keywords: ['游泳', '训练', '健身', '运动', '体能', '竞技', '比赛', '锻炼', '泳池', '运动员', '泳训'],
      weight: 1
    },
    business: {
      keywords: ['商业', '品牌', '市场', '营销', '管理', '战略', '投资', '创业', '企业', '行业分析', '业绩'],
      weight: 1
    }
  };
  
  // 计算每种风格的匹配度（加权）
  const scores = {};
  for (const [style, config] of Object.entries(stylePatterns)) {
    const matches = config.keywords.filter(p => content.includes(p.toLowerCase())).length;
    scores[style] = matches * config.weight;
  }
  
  // 返回得分最高的风格
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const bestStyle = sorted[0];
  
  // 如果有匹配，返回最高分的风格；否则默认 sport
  if (bestStyle && bestStyle[1] > 0) {
    return bestStyle[0];
  }
  
  // 默认：如果包含"智能"但不匹配其他特定类别，归为 tech
  if (content.includes('智能') || content.includes('openclaw') || content.includes('claude')) {
    return 'tech';
  }
  
  return 'sport';
}

/**
 * 生成配图提示词
 * @param {string} topic - 文章主题
 * @param {Array} keywords - 视觉关键词
 * @param {string} style - 风格（可选，不传则自动检测）
 */
function generateIllustrationPrompts(topic, keywords, style = null) {
  // 如果没有指定风格，自动检测
  const detectedStyle = style || detectStyleFromContent(topic, keywords);
  
  const stylePresets = {
    tech: {
      adjective: '科技感、未来感、数字化',
      color: '蓝色、紫色、霓虹光效',
      mood: '创新、前沿、智能',
      scene: '现代办公环境、数字化界面、科技元素'
    },
    health: {
      adjective: '健康、活力、自然',
      color: '绿色、蓝色、白色',
      mood: '舒适、放松、治愈',
      scene: '自然环境、康养场景、健康生活方式'
    },
    family: {
      adjective: '温馨、亲子、欢乐',
      color: '暖色调、柔和、明亮',
      mood: '幸福、陪伴、成长',
      scene: '家庭场景、亲子互动、温暖氛围'
    },
    sport: {
      adjective: '动感、活力、专业',
      color: '蓝色、白色、阳光',
      mood: '激情、健康、向上',
      scene: '运动场馆、训练场景、活力瞬间'
    },
    business: {
      adjective: '专业、现代、简洁',
      color: '深蓝、灰色、金色',
      mood: '可信、稳重、高端',
      scene: '商务场景、现代办公、专业氛围'
    }
  };
  
  const preset = stylePresets[detectedStyle] || stylePresets.sport;
  const keywordStr = keywords.slice(0, 5).join('、');
  
  return [
    {
      type: 'cover',
      description: `封面图：${topic}`,
      style: detectedStyle,
      prompt: `专业公众号封面配图，${topic}，${keywordStr}，${preset.adjective}，${preset.color}，${preset.mood}，${preset.scene}，高清，现代设计，适合文章封面，无文字，16:9比例`
    },
    {
      type: 'content_1',
      description: `内容配图1：${keywords[0] || '主题'}相关`,
      style: detectedStyle,
      prompt: `公众号文章配图，${keywords[0] || topic}，${preset.adjective}，${preset.color}，${preset.scene}，场景化，高清，现代设计，适合文章配图，无文字`
    },
    {
      type: 'content_2',
      description: `内容配图2：${keywords[1] || '主题'}相关`,
      style: detectedStyle,
      prompt: `公众号文章配图，${keywords[1] || topic}，${preset.adjective}，${preset.color}，${preset.scene}，场景化，高清，现代设计，适合文章配图，无文字`
    },
    {
      type: 'content_3',
      description: `内容配图3：${keywords[2] || '主题'}相关`,
      style: detectedStyle,
      prompt: `公众号文章配图，${keywords[2] || topic}，${preset.adjective}，${preset.color}，${preset.scene}，场景化，高清，现代设计，适合文章配图，无文字`
    }
  ];
}

/**
 * 保存配图提示词
 */
function saveIllustrationPrompts(topic, prompts) {
  if (!fs.existsSync(ILLUSTRATION_PROMPTS_DIR)) {
    fs.mkdirSync(ILLUSTRATION_PROMPTS_DIR, { recursive: true });
  }
  
  const date = new Date().toISOString().split('T')[0];
  const topicSlug = topic.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-').substring(0, 30);
  const filename = `${topicSlug}-prompts-${date}.json`;
  const filepath = path.join(ILLUSTRATION_PROMPTS_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify({
    topic,
    created_at: new Date().toISOString(),
    prompts
  }, null, 2), 'utf-8');
  
  return filepath;
}

/**
 * 主函数：搜索 + 生成配图提示词
 */
async function searchAndGeneratePrompts(topic, options = {}) {
  const { style: userStyle, ...searchOptions } = options;
  
  console.log('🔗 Tavily 搜索 + 配图提示词生成');
  console.log(`   主题: ${topic}`);
  
  // 1. 执行 Tavily 搜索（先搜索获取关键词）
  console.log('\n📚 步骤1: 执行 Tavily 搜索...');
  const searchResult = await tavilySearch(topic, {
    searchDepth: 'basic',
    includeAnswer: true,
    maxResults: 5,
    ...searchOptions
  });
  
  // 2. 提取视觉关键词
  console.log('\n🎨 步骤2: 提取视觉关键词...');
  const keywords = extractVisualKeywords(searchResult);
  console.log(`   提取到 ${keywords.length} 个关键词:`);
  keywords.forEach((k, i) => console.log(`   ${i + 1}. ${k}`));
  
  // 3. 自动检测风格（如果用户没指定）
  const detectedStyle = detectStyleFromContent(topic, keywords);
  const style = userStyle || detectedStyle;
  console.log(`   自动检测: ${detectedStyle}, 最终使用: ${style}`);
  
  // 4. 生成配图提示词
  console.log('\n✨ 步骤3: 生成配图提示词...');
  const prompts = generateIllustrationPrompts(topic, keywords, style);
  
  prompts.forEach((p, i) => {
    console.log(`\n   ${i + 1}. ${p.type}: ${p.description}`);
    console.log(`      提示词: ${p.prompt.substring(0, 80)}...`);
  });
  
  // 4. 保存提示词
  const savedPath = saveIllustrationPrompts(topic, prompts);
  console.log(`\n💾 已保存到: ${savedPath}`);
  
  return {
    success: true,
    keywords,
    prompts,
    savedPath,
    searchResult
  };
}

// 命令行入口
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  
  if (!args.topic) {
    console.log('使用方法:');
    console.log('  node tavily-to-illustration.js --topic <主题> [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --topic    文章主题（必填）');
    console.log('  --style    配图风格: tech/health/family/sport/business（默认 sport）');
    console.log('  --depth    搜索深度: basic 或 advanced（默认 basic）');
    console.log('');
    console.log('示例:');
    console.log('  node tavily-to-illustration.js --topic "青少年游泳训练" --style sport');
    console.log('  node tavily-to-illustration.js --topic "AI在体育培训的应用" --style tech');
    process.exit(1);
  }
  
  searchAndGeneratePrompts(args.topic, {
    style: args.style || undefined,  // 不指定时让自动检测生效
    searchDepth: args.depth || 'basic'
  })
    .then(result => {
      if (result.success) {
        console.log('\n✅ 全部完成！');
        console.log(`   关键词: ${result.keywords.join(', ')}`);
        console.log(`   提示词文件: ${result.savedPath}`);
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('\n❌ 失败:', error.message);
      process.exit(1);
    });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = value;
    }
  }
  return args;
}

module.exports = {
  extractVisualKeywords,
  generateIllustrationPrompts,
  searchAndGeneratePrompts
};
