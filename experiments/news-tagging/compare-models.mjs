import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodeCsv } from '../news-screening/audit.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baselinePath = new URL('baselines/qwen2.5-1.5b-run-42169329227.json', import.meta.url);

function eventTypes(article) {
  return [...new Set((article.events || []).map(event => event.type))].sort();
}

function eventDetails(article) {
  return (article.events || []).map(({ type, status, subject, change_quote, evidence_id, chunk }) => ({ type, status, subject, change_quote, evidence_id, chunk }));
}

export function compareModels(baseline, current) {
  if (baseline.model === current.model) throw new Error('Model comparison requires two different models');
  const prior = new Map(baseline.results.map(article => [article.id, article]));
  const latest = new Map(current.results.map(article => [article.id, article]));
  if (prior.size !== baseline.results.length || latest.size !== current.results.length || prior.size !== latest.size || [...prior.keys()].some(id => !latest.has(id))) {
    throw new Error('Model comparison requires the same frozen article IDs');
  }
  const rows = baseline.results.map(oldArticle => {
    const newArticle = latest.get(oldArticle.id);
    const oldTypes = eventTypes(oldArticle);
    const newTypes = eventTypes(newArticle);
    const comparable = oldArticle.status === 'completed' && newArticle.status === 'completed';
    return {
      id: oldArticle.id, title: oldArticle.title, url: oldArticle.url,
      oldStatus: oldArticle.status, newStatus: newArticle.status, comparable,
      oldEvents: oldTypes, newEvents: newTypes,
      oldEventDetails: eventDetails(oldArticle), newEventDetails: eventDetails(newArticle),
      added: comparable ? newTypes.filter(type => !oldTypes.includes(type)) : [],
      removed: comparable ? oldTypes.filter(type => !newTypes.includes(type)) : []
    };
  });
  return {
    baselineModel: baseline.model, currentModel: current.model,
    baselineCompleted: rows.filter(row => row.oldStatus === 'completed').length,
    currentCompleted: rows.filter(row => row.newStatus === 'completed').length,
    comparableArticles: rows.filter(row => row.comparable).length,
    changedEventTags: rows.filter(row => row.added.length || row.removed.length).length,
    rows
  };
}

export function modelComparisonCsv(result) {
  return encodeCsv([
    ['标题', '1.5B处理状态', '7B处理状态', '可比较', '1.5B事件标签', '7B事件标签', '7B新增标签', '7B减少标签', '1.5B事件证据', '7B事件证据', '链接'],
    ...result.rows.map(row => [row.title, row.oldStatus, row.newStatus, row.comparable ? '是' : '否', row.oldEvents.join('、'), row.newEvents.join('、'), row.added.join('、'), row.removed.join('、'), row.oldEventDetails.map(event => `${event.type}: ${event.change_quote}`).join('\n'), row.newEventDetails.map(event => `${event.type}: ${event.change_quote}`).join('\n'), row.url])
  ]);
}

async function main() {
  const outputDirectory = path.resolve(process.env.NEWS_TAGGING_OUTPUT || path.join(root, 'outputs/news-tagging'));
  const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  const current = JSON.parse(await fs.readFile(path.join(outputDirectory, 'results.json'), 'utf8'));
  const result = compareModels(baseline, current);
  await fs.writeFile(path.join(outputDirectory, 'model-comparison.json'), JSON.stringify(result, null, 2) + '\n');
  await fs.writeFile(path.join(outputDirectory, 'model-comparison.csv'), modelComparisonCsv(result));
  const lines = [
    '# 大小模型逐篇对照', '',
    `同一批 ${result.rows.length} 篇新闻：${result.baselineModel} 完整处理 ${result.baselineCompleted} 篇；${result.currentModel} 完整处理 ${result.currentCompleted} 篇。`,
    `两次都完整处理、可比较的文章：${result.comparableArticles} 篇；其中事件标签有增减的文章：${result.changedEventTags} 篇。逐篇证据见 model-comparison.csv，机器可读数据见 model-comparison.json。`, '',
    '标签变化只表示两个模型输出不同，不代表新模型更准确；请对照原文逐篇核对误判和漏判。', ''
  ];
  await fs.writeFile(path.join(outputDirectory, 'model-comparison.md'), lines.join('\n'));
  console.log(JSON.stringify({ baselineModel: result.baselineModel, currentModel: result.currentModel, articles: result.rows.length, comparableArticles: result.comparableArticles, changedEventTags: result.changedEventTags }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
