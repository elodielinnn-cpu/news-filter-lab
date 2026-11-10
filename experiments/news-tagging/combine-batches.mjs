import fs from 'node:fs/promises';
import path from 'node:path';
import { encodeCsv } from '../news-screening/audit.mjs';

const inputDirectory = process.argv[2];
const outputDirectory = process.argv[3];
const minimumArticles = Number(process.argv[4] || 30);
if (!inputDirectory || !outputDirectory || !Number.isInteger(minimumArticles) || minimumArticles < 1) {
  throw new Error('Usage: node combine-batches.mjs INPUT_DIR OUTPUT_DIR [MIN_ARTICLES]');
}

const taxonomy = JSON.parse(await fs.readFile(new URL('taxonomy.json', import.meta.url), 'utf8'));
const folders = (await fs.readdir(inputDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const reports = await Promise.all(folders.map(async folder => {
  const file = path.join(inputDirectory, folder, 'results.json');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}));
if (!reports.length || reports.some(report => report.model !== reports[0].model || report.taxonomyVersion !== reports[0].taxonomyVersion || report.contextHash !== reports[0].contextHash)) {
  throw new Error('Missing batch or inconsistent model/taxonomy/context');
}
const allArticles = reports.flatMap(report => report.results);
const urls = allArticles.map(article => article.url);
if (new Set(urls).size !== urls.length) throw new Error('Duplicate article URLs across batches');
const articles = allArticles.filter(article => article.status === 'completed');
const skippedArticles = allArticles.filter(article => article.status !== 'completed').map(article => ({
  title: article.title, url: article.url, status: article.status, completedChunks: article.completedChunks,
  totalChunks: article.totalChunks, failures: article.failures
}));
if (articles.length < minimumArticles) throw new Error(`Need ${minimumArticles} complete articles; got ${articles.length}/${allArticles.length}`);
const label = (key, values) => [...new Set(values.map(value => taxonomy[key][value] || value))].join('、');
const articleRows = articles.map((article, index) => [
  index + 1, article.title, article.sourceId, article.originalDecision,
  label('domains', article.domains), label('event_types', article.events.map(event => event.type)),
  label('event_types', article.refined_events.map(event => event.type)),
  '', '', '', article.url
]);
const eventRows = articles.flatMap((article, index) => [
  ...article.refined_events.map(event => [index + 1, article.title, taxonomy.event_types[event.type] || event.type,
    taxonomy.statuses[event.status] || event.status, '保留', '', event.subject, event.change_quote, '', '', article.url]),
  ...article.rejected_events.map(event => [index + 1, article.title, taxonomy.event_types[event.type] || event.type,
    taxonomy.statuses[event.status] || event.status, '剔除', event.rejection_reason, event.subject, event.change_quote, '', '', article.url])
]);
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, 'results.json'), JSON.stringify({
  model: reports[0].model, taxonomyVersion: reports[0].taxonomyVersion,
  contextHash: reports[0].contextHash, results: articles
}, null, 2) + '\n');
await fs.writeFile(path.join(outputDirectory, 'article-review.csv'), encodeCsv([
  ['编号', '标题', '来源', '现有筛选', '业务标签', '模型原始事件标签', '证据检查后标签', '人工正确事件标签', '建议去向（首页/观察/仅全集）', '人工理由或漏掉的事件', '原文链接'],
  ...articleRows
]));
await fs.writeFile(path.join(outputDirectory, 'event-review.csv'), encodeCsv([
  ['文章编号', '标题', '模型标签', '模型阶段', '证据检查', '剔除原因', '变化对象', '原文证据句', '人工判断（对/错/待定）', '正确标签或阶段', '原文链接'],
  ...eventRows
]));
await fs.writeFile(path.join(outputDirectory, 'summary.json'), JSON.stringify({
  model: reports[0].model, taxonomyVersion: reports[0].taxonomyVersion,
  batches: folders, completeArticles: articles.length, totalArticles: allArticles.length, skippedArticles, eventRows: eventRows.length,
  sourceCounts: Object.fromEntries([...new Set(articles.map(article => article.sourceId))].map(source => [source, articles.filter(article => article.sourceId === source).length]))
}, null, 2) + '\n');
console.log(JSON.stringify({ batches: folders.length, completeArticles: articles.length, skippedArticles: skippedArticles.length, eventRows: eventRows.length }));
