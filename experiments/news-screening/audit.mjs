import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const headers = ['编号', '标题', '来源', '业务', '原文链接', '证据来源', '已抓取原文', '人工结果', '人工关系', '变化对象', '具体变化', '对应产品', '变化原句', '业务或影响原句', '人工理由', '误差环节', '补充原文', '系统结果', '系统理由', '系统变化原句', '系统业务依据'];
export { headers as reviewHeaders };
const normalize = value => String(value || '').replace(/\s+/gu, ' ').trim();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const articleId = article => hash(new URL(article.url).href.replace(/#.*$/, '').replace(/\/$/, '')).slice(0, 16);

export function encodeCsv(rows) {
  return '\ufeff' + rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  const input = text.replace(/^\ufeff/, '');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        if (!quoted && field) throw new Error('CSV contains a quote inside an unquoted field');
        quoted = !quoted;
        afterQuote = !quoted;
      }
    } else if (!quoted && (character === ',' || character === '\n' || character === '\r')) {
      row.push(field);
      field = '';
      afterQuote = false;
      if (character !== ',') {
        if (row.some(value => value)) rows.push(row);
        row = [];
        if (character === '\r' && input[index + 1] === '\n') index += 1;
      }
    } else {
      if (afterQuote) {
        if (character.trim()) throw new Error('CSV has unexpected text after a closing quote');
        continue;
      }
      field += character;
    }
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field');
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

export function reviewRecords(text) {
  const [columns, ...rows] = parseCsv(text);
  if (!columns || new Set(columns).size !== columns.length) throw new Error('CSV headers are missing or duplicated');
  return rows.map(row => {
    if (row.length !== columns.length) throw new Error('CSV row has a different number of columns');
    return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
  });
}

export function validateLabels(articles, rows) {
  if (rows.some(row => headers.some(column => !(column in row)))) throw new Error('Review CSV headers changed; retain the supplied column names');
  const byId = new Map(articles.map(article => [articleId(article), article]));
  const seen = new Set();
  const labels = [];
  for (const row of rows) {
    const id = row['编号'];
    const article = byId.get(id);
    if (!article || seen.has(id)) throw new Error(`Unknown or duplicate review ID ${id}`);
    if (row['原文链接'] !== article.url) throw new Error(`Original link changed for ${id}`);
    seen.add(id);
    const expected = row['人工结果'].trim();
    if (!expected) continue;
    if (!['入选', '待定', '排除'].includes(expected)) throw new Error(`Invalid human decision for ${id}`);
    if (!row['人工理由'].trim()) throw new Error(`Human reason required for ${id}`);
    if (expected === '入选') {
      for (const column of ['变化对象', '具体变化', '对应产品', '变化原句', '业务或影响原句']) {
        if (!row[column]?.trim()) throw new Error(`${column} required for ${id}`);
      }
      if (!['直接', '明确间接'].includes(row['人工关系'])) throw new Error(`Human relationship required for ${id}`);
      const evidence = normalize([...(article.bodyEvidence || []), row['补充原文']].join(' '));
      for (const column of ['变化原句', '业务或影响原句']) {
        if (!evidence.includes(normalize(row[column]))) throw new Error(`${column} is outside saved/supplemented evidence for ${id}`);
      }
    }
    labels.push({ id, expected, reason: row['人工理由'], errorStage: row['误差环节'], evidenceBasis: row['补充原文']?.trim() ? 'reviewer_supplement' : 'saved_snapshot', article });
  }
  if (seen.size !== articles.length) throw new Error('Review must retain every row, including unlabelled rows');
  return labels;
}

export function metrics(labels, predict) {
  const cases = labels.map(label => ({ id: label.id, title: label.article.title, url: label.article.url, expected: label.expected, actual: predict(label.article), reason: label.reason, errorStage: label.errorStage, evidenceBasis: label.evidenceBasis }));
  const admitted = cases.filter(item => item.actual === '入选');
  const relevant = cases.filter(item => item.expected === '入选');
  const correctAdmissions = admitted.filter(item => item.expected === '入选').length;
  const matrix = Object.fromEntries(['入选', '待定', '排除'].map(expected => [expected, Object.fromEntries(['入选', '待定', '排除'].map(actual => [actual, cases.filter(item => item.expected === expected && item.actual === actual).length]))]));
  return {
    reviewed: cases.length, admitted: admitted.length, humanSelected: relevant.length,
    admissionPrecision: admitted.length ? correctAdmissions / admitted.length : null,
    selectionRecall: relevant.length ? correctAdmissions / relevant.length : null,
    matrix,
    falseAdmissions: cases.filter(item => item.actual === '入选' && item.expected !== '入选'),
    falseExclusions: cases.filter(item => item.actual === '排除' && item.expected === '入选'),
    heldBackRelevant: cases.filter(item => item.actual === '待定' && item.expected === '入选')
  };
}

async function writeNew(file, content) {
  try {
    await fs.writeFile(file, content, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function prepare() {
  const report = JSON.parse(await fs.readFile(path.join(root, 'outputs/news-screening/latest.json'), 'utf8'));
  const profile = await loadBusinessProfile(path.join(root, 'config/luxshare-business-profile.json'));
  const input = report.articles.map(({ decision, ...article }) => article);
  const batchId = hash(JSON.stringify(input)).slice(0, 12);
  const directory = path.join(root, 'outputs/news-screening/audit', batchId);
  await fs.mkdir(directory, { recursive: true });
  const codeFiles = ['screen.mjs', 'scope.mjs', 'rules.mjs'];
  const code = await Promise.all(codeFiles.map(file => fs.readFile(new URL(file, import.meta.url), 'utf8')));
  await writeNew(path.join(directory, 'baseline.json'), JSON.stringify({ batchId, sourceFetchedAt: report.fetchedAt, preparedAt: new Date().toISOString(), codeHash: hash(code.join('\n')), profileHash: profile.profileHash, scopeVersion: report.scopeVersion, articles: report.articles }, null, 2) + '\n');
  const baseline = JSON.parse(await fs.readFile(path.join(directory, 'baseline.json'), 'utf8'));
  const sorted = [...baseline.articles].sort((a, b) => articleId(a).localeCompare(articleId(b)));
  const rows = sorted.map(article => [articleId(article), article.title, article.sourceId, article.decision.business, article.url, article.evidenceSource, article.bodyEvidence.join('\n\n'), '', '', '', '', '', '', '', '', '', '', article.decision.result, article.decision.reason, article.decision.eventEvidence, article.decision.businessEvidence]);
  await writeNew(path.join(directory, 'review.csv'), encodeCsv([headers, ...rows]));
  await writeNew(path.join(directory, 'coverage.csv'), encodeCsv([['标题', '原文链接', '业务', '人工应收录', '原因']]));
  console.log(JSON.stringify({ directory, articles: rows.length, annotation: '人工结论留空，已有文件保留' }));
}

async function score(directory, labelsPath) {
  const baseline = JSON.parse(await fs.readFile(path.join(directory, 'baseline.json'), 'utf8'));
  const rows = reviewRecords(await fs.readFile(labelsPath || path.join(directory, 'review.csv'), 'utf8'));
  const labels = validateLabels(baseline.articles, rows);
  const profile = await loadBusinessProfile(path.join(root, 'config/luxshare-business-profile.json'));
  const original = metrics(labels, article => article.decision.result);
  const current = metrics(labels, article => screen(article, profile).result);
  const savedEvidenceOnly = metrics(labels.filter(label => label.evidenceBasis === 'saved_snapshot'), article => screen(article, profile).result);
  const coverageRows = reviewRecords(await fs.readFile(path.join(directory, 'coverage.csv'), 'utf8'));
  const pool = new Set(baseline.articles.map(article => articleId(article)));
  for (const row of coverageRows) {
    if (!['', '是', '否'].includes(row['人工应收录'])) throw new Error('Coverage decision must be 是 or 否');
    if (row['人工应收录'] === '是' && (!row['原文链接'] || !row['标题'] || !row['原因'])) throw new Error('Coverage entries require title, link and reason');
  }
  const coverage = coverageRows.filter(row => row['人工应收录'] === '是').map(row => ({ ...row, presentByUrl: pool.has(articleId({ url: row['原文链接'] })) }));
  const report = { batchId: baseline.batchId, reviewed: labels.length, total: baseline.articles.length, remaining: baseline.articles.length - labels.length, baseline: original, current, savedEvidenceOnly, baselineProfileHash: baseline.profileHash || null, currentProfileHash: profile.profileHash, coverage };
  await fs.writeFile(path.join(directory, 'score.json'), JSON.stringify(report, null, 2) + '\n');
  const percent = value => value === null ? '样本不足，未计算' : `${(value * 100).toFixed(1)}%`;
  const lines = [
    '# 新闻筛选人工核对结果', '', `已标注 ${labels.length}/${baseline.articles.length} 条。`, '',
    '| 指标 | 冻结版本 | 当前规则 |', '| --- | --- | --- |',
    `| 入选符合率 | ${percent(original.admissionPrecision)} | ${percent(current.admissionPrecision)} |`,
    `| 人工入选召回率 | ${percent(original.selectionRecall)} | ${percent(current.selectionRecall)} |`,
    `| 错排除 | ${original.falseExclusions.length} | ${current.falseExclusions.length} |`,
    `| 应入选但仍待定 | ${original.heldBackRelevant.length} | ${current.heldBackRelevant.length} |`, '',
    `已抓取证据子集的入选符合率为 ${percent(savedEvidenceOnly.admissionPrecision)}，召回率为 ${percent(savedEvidenceOnly.selectionRecall)}。该子集排除需要审阅人补充原文的记录。`, '',
    '以上指标仅适用于已标注记录。待定单独统计，尚需关系或证据核对。召回率分母为人工确认应入选的文章，适用范围为冻结候选池。来源采集覆盖另表核对。补充原文由审阅人提供并负责事实核验。', '',
    `采集覆盖清单已填 ${coverage.length} 条应收录新闻，其中 ${coverage.filter(item => !item.presentByUrl).length} 条 URL 不在冻结候选池。缺少 URL 还需检查是否已有同事件其他报道。`, '',
    '## 当前规则错例', ''
  ];
  for (const [name, items] of [['误入选', current.falseAdmissions], ['错排除', current.falseExclusions], ['待定未放行', current.heldBackRelevant]]) {
    lines.push(`### ${name}`, '');
    for (const item of items) lines.push(`- ${item.title}。人工理由为 ${item.reason}。原文 ${item.url}`);
    if (!items.length) lines.push(labels.length ? '已标注记录中无此类错例。' : '等待人工标注。');
    lines.push('');
  }
  await fs.writeFile(path.join(directory, 'score.md'), lines.join('\n'));
  console.log(JSON.stringify({ reviewed: report.reviewed, total: report.total, remaining: report.remaining, directory }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [command, directory, labelsPath] = process.argv.slice(2);
  if (command === 'prepare') await prepare();
  else if (command === 'score' && directory) await score(path.resolve(directory), labelsPath && path.resolve(labelsPath));
  else throw new Error('Use audit.mjs prepare, or audit.mjs score <audit-directory> [edited-review.csv]');
}
