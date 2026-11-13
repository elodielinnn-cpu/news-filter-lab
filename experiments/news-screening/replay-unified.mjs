import fs from 'node:fs/promises';
import path from 'node:path';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';
import { encodeCsv } from './audit.mjs';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) throw new Error('Usage: node replay-unified.mjs INPUT.json OUTPUT.json');
const source = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (!Array.isArray(source.articles)) throw new Error('Input must contain articles');
const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const rows = source.articles.map((article, index) => {
  const current = screen(article, profile);
  const main = current.unifiedTagging.mainEvent;
  return {
    sampleNumber: article.sampleNumber || index + 1,
    title: article.title, url: article.url,
    originalResult: article.decision?.result || '未记录',
    originalEvent: article.decision?.event || '',
    newResult: current.result, newEvent: main?.eventType || '',
    newDomain: main?.domains || [], newStage: main?.stage || 'unknown',
    actor: main?.actor || '', object: main?.object || '', evidence: main?.evidence || '', stageEvidence: main?.stageEvidence || '',
    paragraphId: main?.paragraphId || null,
    businessRelation: current.businessGate,
    businessProducts: current.affectedProducts.map(product => ({ productId: product.productId, relationshipLevel: product.relationshipLevel })),
    homepageCandidate: current.homepageCandidate,
    dataQuality: current.dataQuality,
    reason: current.reason,
    difference: current.result !== (article.decision?.result || '未记录') ? 'screening_decision' :
      current.event !== (article.decision?.event || '') ? 'event_taxonomy_or_main_event' : 'none'
  };
});
const count = key => Object.fromEntries([...new Set(rows.map(row => row[key]))].sort().map(value => [value, rows.filter(row => row[key] === value).length]));
const report = {
  version: 'unified-v1', generatedAt: new Date().toISOString(), input: path.basename(inputPath),
  scope: ['datacom', 'automotive'], modelRun: false,
  totals: { articles: rows.length, oldResults: count('originalResult'), newResults: count('newResult'),
    missingDates: rows.filter(row => row.dataQuality !== 'complete').length,
    noMainEvent: rows.filter(row => !row.newEvent).length },
  articles: rows
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
const csv = encodeCsv([['编号','标题','原结果','原事件','新结果','行业','主事件','阶段','主体','对象','证据段落','事件证据','阶段证据','业务关系','首页候选','资料质量','差异类型','原因','链接'],
  ...rows.map(row => [row.sampleNumber,row.title,row.originalResult,row.originalEvent,row.newResult,row.newDomain.join('、'),row.newEvent,row.newStage,
    row.actor,row.object,row.paragraphId || '',row.evidence,row.stageEvidence,row.businessRelation,row.homepageCandidate ? '是' : '否',row.dataQuality,row.difference,row.reason,row.url])]);
await fs.writeFile(outputPath.replace(/\.json$/u, '.csv'), csv);
console.log(JSON.stringify(report.totals));
