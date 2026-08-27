#!/usr/bin/env node
/**
 * 定期知识库更新
 * 自动搜索 AI 行业热点、GitHub 高星项目、OpenClaw/Claude 相关动态
 */

const fs = require('fs');
const path = require('path');
const { tavilySearch } = require('./tavily-search');

// Obsidian 知识库路径
const KNOWLEDGE_BASE_DIR = path.join('/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/我的知识库（基于obsidian）', 'AI知识库', '自动更新');
const UPDATE_LOG_FILE = path.join(KNOWLEDGE_BASE_DIR, '.update_log.json');

// 确保目录存在
if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
}

/**
 * 搜索主题配置（周一到周五，每天一个）
 */
const SEARCH_TOPICS = {
  // 周一：AI 行业热点
  ai_trends: {
    name: 'AI 行业热点',
    queries: [
      'AI artificial intelligence latest trends 2026',
      'AI agent framework latest developments',
      '大模型最新进展 2026',
      'AI 应用落地案例 2026'
    ],
    day: 1, // 周一
    priority: 'high'
  },
  
  // 周二：OpenClaw & Claude 生态
  openclaw_claude: {
    name: 'OpenClaw & Claude 生态',
    queries: [
      'OpenClaw AI agent framework new features',
      'Claude AI latest updates 2026',
      'Claude Code new capabilities',
      'OpenClaw GitHub repository updates'
    ],
    day: 2, // 周二
    priority: 'high'
  },
  
  // 周三：GitHub 高星开源项目
  github_trending: {
    name: 'GitHub AI 高星项目',
    queries: [
      'GitHub trending AI projects 2026',
      'GitHub stars AI agent open source',
      'GitHub trending LLM tools',
      'GitHub popular AI developer tools'
    ],
    day: 3, // 周三
    priority: 'medium'
  },
  
  // 周四：X 平台 AI 科技动态
  x_ai_influencers: {
    name: 'X 平台 AI 科技动态',
    queries: [
      'Twitter X AI influencers latest posts',
      'AI thought leaders X platform 2026',
      '科技博主 AI 观点 2026',
      'AI industry leaders tweets insights'
    ],
    day: 4, // 周四
    priority: 'medium'
  },
  
  // 周五：YouTube AI 科技视频
  youtube_ai: {
    name: 'YouTube AI 科技视频',
    queries: [
      'YouTube AI technology latest videos 2026',
      'AI tutorial YouTube trending',
      '科技博主 YouTube AI 内容',
      'OpenClaw Claude tutorial YouTube'
    ],
    day: 5, // 周五
    priority: 'low'
  }
};

/**
 * 读取更新日志
 */
function readUpdateLog() {
  if (fs.existsSync(UPDATE_LOG_FILE)) {
    return JSON.parse(fs.readFileSync(UPDATE_LOG_FILE, 'utf-8'));
  }
  return { lastUpdate: {}, history: [] };
}

/**
 * 保存更新日志
 */
function saveUpdateLog(log) {
  fs.writeFileSync(UPDATE_LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
}

/**
 * 检查是否需要更新（按星期几分发）
 */
function shouldUpdate(topicKey, topicConfig) {
  const now = new Date();
  const currentDay = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
  
  // 如果不是周一到周五，跳过
  if (currentDay === 0 || currentDay === 6) {
    return false;
  }
  
  // 检查是否是该主题的更新日
  if (topicConfig.day !== currentDay) {
    return false;
  }
  
  // 检查今天是否已经更新过
  const log = readUpdateLog();
  const lastUpdate = log.lastUpdate[topicKey];
  
  if (!lastUpdate) return true;
  
  const lastDate = new Date(lastUpdate);
  const today = new Date();
  
  // 如果上次更新是今天，跳过
  return lastDate.toDateString() !== today.toDateString();
}

/**
 * 执行知识库更新
 */
async function updateKnowledgeBase(topicKey, topicConfig) {
  console.log(`\n📚 更新: ${topicConfig.name}`);
  console.log(`   优先级: ${topicConfig.priority}`);
  console.log(`   查询数: ${topicConfig.queries.length}`);
  
  const allResults = [];
  
  for (const query of topicConfig.queries) {
    try {
      console.log(`   🔍 ${query}`);
      const result = await tavilySearch(query, {
        searchDepth: 'basic',
        includeAnswer: true,
        maxResults: 3 // 每个查询最多3条，避免过多
      });
      
      if (result.results) {
        allResults.push(...result.results);
      }
      
      // 延迟避免 rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ 搜索失败: ${error.message}`);
    }
  }
  
  // 去重（按 URL）
  const uniqueResults = [];
  const seenUrls = new Set();
  for (const result of allResults) {
    if (!seenUrls.has(result.url)) {
      seenUrls.add(result.url);
      uniqueResults.push(result);
    }
  }
  
  // 保存到知识库
  const date = new Date().toISOString().split('T')[0];
  const filename = `${topicKey}-${date}.md`;
  const filepath = path.join(KNOWLEDGE_BASE_DIR, filename);
  
  const content = generateKnowledgeBaseContent(topicConfig.name, uniqueResults, date);
  fs.writeFileSync(filepath, content, 'utf-8');
  
  console.log(`   ✅ 保存 ${uniqueResults.length} 条结果到 ${filename}`);
  
  return {
    topic: topicConfig.name,
    resultCount: uniqueResults.length,
    filepath
  };
}

/**
 * 生成知识库内容
 */
function generateKnowledgeBaseContent(topicName, results, date) {
  let content = `# ${topicName} - 自动更新

## 元数据
- **更新日期**: ${date}
- **来源**: Tavily 自动搜索
- **结果数量**: ${results.length}

## 关键发现

`;
  
  results.forEach((result, index) => {
    content += `### ${index + 1}. ${result.title}
- **来源**: ${result.url}
- **相关性**: ${result.score?.toFixed(2) || 'N/A'}
- **摘要**: ${result.content?.substring(0, 200) || '无'}...

`;
  });
  
  content += `---
*自动生成于 ${new Date().toLocaleString('zh-CN')}*
`;
  
  return content;
}

/**
 * 主函数：执行所有需要更新的主题
 */
async function runKnowledgeUpdate(options = {}) {
  const { 
    force = false, // 强制更新所有
    topics = [],   // 指定更新特定主题
    dryRun = false // 仅检查，不执行
  } = options;
  
  console.log('🔄 知识库自动更新任务');
  console.log(`   时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`   模式: ${dryRun ? '检查模式' : '更新模式'}`);
  
  const log = readUpdateLog();
  const results = [];
  
  for (const [key, config] of Object.entries(SEARCH_TOPICS)) {
    // 如果指定了 topics，只更新指定的
    if (topics.length > 0 && !topics.includes(key)) {
      continue;
    }
    
    // 检查是否需要更新（按星期几分发）
    if (!force && !shouldUpdate(key, config)) {
      const lastUpdate = log.lastUpdate[key];
      if (lastUpdate) {
        console.log(`\n⏭️  ${config.name} - 跳过（上次更新: ${lastUpdate.split('T')[0]}）`);
      } else {
        console.log(`\n⏭️  ${config.name} - 跳过（非更新日，该主题在周${config.day}更新）`);
      }
      continue;
    }
    
    if (dryRun) {
      console.log(`\n📋 ${config.name} - 需要更新`);
      continue;
    }
    
    // 执行更新
    try {
      const result = await updateKnowledgeBase(key, config);
      results.push(result);
      
      // 更新日志
      log.lastUpdate[key] = new Date().toISOString();
      log.history.push({
        topic: key,
        date: new Date().toISOString(),
        resultCount: result.resultCount
      });
    } catch (error) {
      console.error(`   ❌ 更新失败: ${error.message}`);
    }
  }
  
  if (!dryRun) {
    saveUpdateLog(log);
  }
  
  // 生成飞书报告
  const report = generateFeishuReport(results);
  
  // 输出报告（用于飞书通知）
  console.log('\n' + '='.repeat(50));
  console.log('FEISHU_REPORT_START');
  console.log(report);
  console.log('FEISHU_REPORT_END');
  console.log('='.repeat(50));
  
  console.log('\n✅ 知识库更新完成！');
  console.log(`   更新主题数: ${results.length}`);
  
  return results;
}

/**
 * 生成飞书通知报告
 */
function generateFeishuReport(results) {
  const date = new Date().toLocaleDateString('zh-CN');
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()];
  
  let report = `📚 知识库自动更新报告 - ${date}（周${weekday}）\n\n`;
  
  if (results.length === 0) {
    report += '今日无更新任务\n';
    return report;
  }
  
  report += `今日更新 ${results.length} 个主题：\n\n`;
  
  results.forEach((r, i) => {
    report += `${i + 1}. **${r.topic}**\n`;
    report += `   - 结果数: ${r.resultCount} 条\n`;
    report += `   - 文件: ${path.basename(r.filepath)}\n`;
    report += `   - 路径: ${r.filepath}\n\n`;
  });
  
  report += `---\n`;
  report += `📁 知识库位置: ${KNOWLEDGE_BASE_DIR}\n`;
  report += `⏰ 下次更新时间: 明天 9:00\n`;
  
  // 保存报告到文件
  const reportPath = path.join(KNOWLEDGE_BASE_DIR, `report-${new Date().toISOString().split('T')[0]}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`\n📊 报告已生成: ${reportPath}`);
  
  return report;
}

// 命令行入口
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  
  const options = {
    force: args.force || false,
    topics: args.topics ? args.topics.split(',') : [],
    dryRun: args['dry-run'] || false
  };
  
  runKnowledgeUpdate(options)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 失败:', error.message);
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
  runKnowledgeUpdate,
  SEARCH_TOPICS
};