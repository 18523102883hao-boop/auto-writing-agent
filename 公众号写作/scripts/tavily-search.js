#!/usr/bin/env node
/**
 * Step 2: 主动搜索 - Tavily Search 集成
 * 根据文章主题自动搜索相关信息，保存到知识库
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 轻量 .env 加载（无第三方依赖），读取 公众号写作/.env
(() => {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* 无 .env 时静默跳过，回退到系统环境变量 */ }
})();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
if (!TAVILY_API_KEY) {
  console.error('错误：未配置 TAVILY_API_KEY 环境变量。请在 .env 中设置（参考 .env.example），切勿把 key 写进代码。');
  process.exit(1);
}
const TAVILY_API_URL = 'https://api.tavily.com/search';
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '..', '_knowledge_base');

/**
 * 执行 Tavily 搜索
 * @param {string} query - 搜索查询
 * @param {Object} options - 搜索选项
 * @returns {Promise<Object>} 搜索结果
 */
async function tavilySearch(query, options = {}) {
  const {
    searchDepth = 'basic',      // 'basic' 或 'advanced'
    includeAnswer = true,       // 是否包含 AI 生成的答案
    maxResults = 5,             // 返回结果数量
    includeDomains = [],        // 限制搜索的域名
    excludeDomains = []         // 排除的域名
  } = options;

  console.log(`🔍 Tavily 搜索: ${query}`);

  const requestData = JSON.stringify({
    query,
    search_depth: searchDepth,
    include_answer: includeAnswer,
    max_results: maxResults,
    include_domains: includeDomains.length > 0 ? includeDomains : undefined,
    exclude_domains: excludeDomains.length > 0 ? excludeDomains : undefined
  });

  return new Promise((resolve, reject) => {
    const req = https.request(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`
      }
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`Tavily API 错误: ${response.error}`));
          } else {
            console.log(`   ✅ 找到 ${response.results?.length || 0} 条结果`);
            console.log(`   ⏱️  响应时间: ${response.response_time || '?'}s`);
            resolve(response);
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`请求失败: ${error.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * 生成搜索查询（基于主题和角度）
 * @param {string} topic - 文章主题
 * @param {string} angle - 切入角度（可选）
 * @returns {string} 优化后的搜索查询
 */
function generateSearchQuery(topic, angle = '') {
  // 根据主题类型优化查询
  const query = angle ? `${topic} ${angle}` : topic;
  
  // 添加时间限制（获取最新信息）
  const currentYear = new Date().getFullYear();
  const enhancedQuery = `${query} ${currentYear}`;
  
  return enhancedQuery;
}

/**
 * 保存搜索结果到知识库
 * @param {string} topic - 文章主题
 * @param {Object} searchResult - Tavily 搜索结果
 * @param {string} angle - 切入角度
 */
function saveToKnowledgeBase(topic, searchResult, angle = '') {
  // 确保知识库目录存在
  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const topicSlug = topic.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-').substring(0, 30);
  const filename = `${topicSlug}-${date}.md`;
  const filepath = path.join(KNOWLEDGE_BASE_DIR, filename);

  // 生成 Markdown 内容
  const content = generateKnowledgeBaseMarkdown(topic, searchResult, angle, date);

  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`   💾 已保存到: ${filepath}`);

  return filepath;
}

/**
 * 生成知识库 Markdown 格式
 */
function generateKnowledgeBaseMarkdown(topic, result, angle, date) {
  const { query, answer, results, response_time } = result;

  let markdown = `# ${topic} - 信息收集

## 元数据
- **信息收集时间**: ${date}
- **搜索查询**: ${query}
- **切入角度**: ${angle || '未指定'}
- **响应时间**: ${response_time}s
- **结果数量**: ${results?.length || 0}

## AI 生成摘要
${answer || '无'}

## 关键发现

`;

  // 添加搜索结果
  if (results && results.length > 0) {
    results.forEach((item, index) => {
      markdown += `### ${index + 1}. ${item.title}
- **来源**: ${item.url}
- **相关性评分**: ${item.score?.toFixed(2) || 'N/A'}
- **内容摘要**:
${item.content}

`;
    });
  }

  markdown += `## 与28度活水馆的关联点
（待补充：根据文章主题分析如何与品牌结合）

## 下次更新建议
- 关注该主题的最新动态
- 补充一手数据或案例
- 验证关键数据的准确性

---
*自动生成于 ${new Date().toLocaleString('zh-CN')}*
`;

  return markdown;
}

/**
 * 主函数：执行搜索并保存
 * @param {string} topic - 文章主题
 * @param {Object} options - 搜索选项
 */
async function searchForArticle(topic, options = {}) {
  console.log('📚 开始为文章搜索资料...');
  console.log(`   主题: ${topic}`);

  const { angle = '', queries = [], ...searchOptions } = options;

  // 生成搜索查询列表
  const searchQueries = queries.length > 0 
    ? queries 
    : [generateSearchQuery(topic, angle)];

  console.log(`   搜索查询 (${searchQueries.length} 个):`);
  searchQueries.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));

  const allResults = [];

  // 执行多个搜索
  for (const query of searchQueries) {
    try {
      const result = await tavilySearch(query, searchOptions);
      allResults.push({ query, result });
    } catch (error) {
      console.error(`   ❌ 搜索失败 "${query}": ${error.message}`);
    }
  }

  // 保存结果
  if (allResults.length > 0) {
    // 合并所有结果
    const combinedResult = {
      query: searchQueries.join(' | '),
      answer: allResults.map(r => r.result.answer).filter(Boolean).join('\n\n'),
      results: allResults.flatMap(r => r.result.results || []),
      response_time: Math.max(...allResults.map(r => r.result.response_time || 0))
    };

    const savedPath = saveToKnowledgeBase(topic, combinedResult, angle);
    
    console.log('\n✅ 搜索完成！');
    console.log(`   总结果数: ${combinedResult.results.length}`);
    console.log(`   知识库文件: ${savedPath}`);

    return {
      success: true,
      filepath: savedPath,
      results: combinedResult
    };
  } else {
    console.log('\n⚠️ 未获取到任何搜索结果');
    return { success: false, results: null };
  }
}

/**
 * 针对公众号文章的专用搜索策略
 * @param {string} topic - 文章主题
 * @param {string} targetReader - 目标读者
 */
async function searchForWechatArticle(topic, targetReader = '') {
  console.log('📝 公众号文章专用搜索策略');

  // 根据目标读者优化搜索角度
  const searchStrategies = {
    '家长': [
      `${topic} 家长关注`,
      `${topic} 对孩子影响`,
      `${topic} 教育意义`
    ],
    '健身爱好者': [
      `${topic} 健身效果`,
      `${topic} 训练方法`,
      `${topic} 专业分析`
    ],
    '健康养生人群': [
      `${topic} 健康益处`,
      `${topic} 养生方法`,
      `${topic} 科学研究`
    ],
    '泳训家长': [
      `${topic} 游泳训练`,
      `${topic} 青少年体育`,
      `${topic} 体教融合`
    ]
  };

  const queries = searchStrategies[targetReader] || [topic];

  return searchForArticle(topic, {
    queries,
    searchDepth: 'advanced',  // 深度搜索
    includeAnswer: true,
    maxResults: 5
  });
}

// 命令行入口
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));

  if (!args.topic && !args.article) {
    console.log('使用方法:');
    console.log('  node tavily-search.js --topic <主题> [选项]');
    console.log('  node tavily-search.js --article <文章路径> [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --topic         文章主题（必填，除非指定 --article）');
    console.log('  --article       从文章文件提取主题');
    console.log('  --angle         切入角度');
    console.log('  --reader        目标读者（家长/健身爱好者/健康养生人群/泳训家长）');
    console.log('  --depth         搜索深度: basic 或 advanced（默认 basic）');
    console.log('  --max-results   最大结果数（默认 5）');
    console.log('');
    console.log('示例:');
    console.log('  node tavily-search.js --topic "青少年游泳训练" --reader "泳训家长"');
    console.log('  node tavily-search.js --topic "AI在体育培训的应用" --depth advanced');
    process.exit(1);
  }

  // 从文章文件提取主题
  let topic = args.topic;
  if (args.article && fs.existsSync(args.article)) {
    const content = fs.readFileSync(args.article, 'utf-8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      topic = titleMatch[1];
      console.log(`   从文章提取主题: ${topic}`);
    }
  }

  const searchOptions = {
    angle: args.angle || '',
    searchDepth: args.depth || 'basic',
    maxResults: parseInt(args.maxResults) || 5
  };

  if (args.reader) {
    searchForWechatArticle(topic, args.reader)
      .then(result => {
        if (result.success) {
          console.log('\n✅ 全部完成！');
          process.exit(0);
        } else {
          console.log('\n⚠️ 搜索未完成');
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('\n❌ 失败:', error.message);
        process.exit(1);
      });
  } else {
    searchForArticle(topic, searchOptions)
      .then(result => {
        if (result.success) {
          console.log('\n✅ 全部完成！');
          process.exit(0);
        } else {
          console.log('\n⚠️ 搜索未完成');
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('\n❌ 失败:', error.message);
        process.exit(1);
      });
  }
}

/**
 * 简单的参数解析
 */
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
  tavilySearch,
  searchForArticle,
  searchForWechatArticle
};