import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { activeProducts, isConsumerStory } from '../news-screening/scope.mjs';
import { articleId, encodeCsv } from '../news-screening/audit.mjs';
import { chunkText, digest, mergeOutputs, outputSchema, validateOutput } from './adapter.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export async function prepareManifest(input, taxonomy, runtime, prompt, profile) {
  if (!input || !Array.isArray(input.articles)) throw new Error('Input must contain an articles array');
  const products = activeProducts(profile).map(({ productId, productName, relationshipLevel }) => ({ productId, productName, relationshipLevel }));
  const schema = outputSchema(taxonomy, products);
  const contextHash = digest({ taxonomy, runtime, prompt, products, schema });
  const articles = input.articles.filter(article => !isConsumerStory(article)).map(article => ({
    id: articleId(article), title: article.title, url: article.url, sourceId: article.sourceId,
    publishedAt: article.publishedAt || null,
    originalDecision: article.decision?.result || '未判断', evidenceSource: article.evidenceSource || 'saved-snapshot',
    chunks: chunkText(Array.isArray(article.bodyEvidence) ? article.bodyEvidence : [], runtime.max_chunk_characters, runtime.overlap_characters)
  }));
  return { mode: 'semantic-shadow', taxonomyVersion: taxonomy.version, model: runtime.model, modelRevision: runtime.model_revision, contextHash, schema, products, articles };
}

export async function requestTags({ endpoint, model, prompt, taxonomy, products, schema, article, chunk, runtime, fetchImpl = fetch }) {
  const response = await fetchImpl(`${endpoint}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(runtime.request_timeout_ms),
    body: JSON.stringify({
      model, temperature: 0, seed: 42, max_tokens: runtime.max_output_tokens, stream: false,
      response_format: { type: 'json_object', schema },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify({ taxonomy, products, title: article.title, url: article.url, published_at: article.publishedAt || null, evidence_source: article.evidenceSource, chunk: chunk.index, text: chunk.text }) }
      ]
    })
  });
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  const payload = await response.json();
  const choice = payload.choices?.[0];
  if (payload.model && payload.model !== model) throw new Error('model_identity_mismatch');
  if (choice?.finish_reason !== 'stop') throw new Error('incomplete_model_output');
  const raw = JSON.parse(choice.message.content);
  return { output: validateOutput(raw, chunk, taxonomy, products), usage: payload.usage || null, actualModel: payload.model || model };
}

export async function tagManifest({ manifest, runtime, taxonomy, infer, loadCache = async () => null, saveCache = async () => {}, now = Date.now }) {
  const startedAt = now();
  const results = [];
  let requests = 0;
  let cacheHits = 0;
  let totalTokens = 0;
  for (const article of manifest.articles) {
    const outputs = [];
    const failures = [];
    const cacheWarnings = [];
    let completed = 0;
    for (const chunk of article.chunks) {
      const key = digest([manifest.contextHash, article.id, article.title, article.publishedAt, article.evidenceSource, chunk.text]);
      let cached = null;
      try { cached = await loadCache(key); }
      catch { cacheWarnings.push({ chunk: chunk.index, error: 'cache_read_failed' }); }
      if (cached) {
        try {
          if (cached.actualModel && cached.actualModel !== manifest.model) throw new Error('cached_model_identity_mismatch');
          outputs.push(validateOutput(cached.output, chunk, taxonomy, manifest.products));
          completed += 1;
          cacheHits += 1;
          continue;
        } catch { cacheWarnings.push({ chunk: chunk.index, error: 'invalid_cache_entry' }); }
      }
      try {
        if (now() - startedAt >= runtime.run_budget_ms) {
          failures.push({ chunk: chunk.index, error: 'run_budget_exhausted' });
          continue;
        }
        requests += 1;
        const response = await infer(article, chunk);
        const validated = validateOutput(response.output, chunk, taxonomy, manifest.products);
        outputs.push(validated);
        totalTokens += response.usage?.total_tokens || 0;
        completed += 1;
        try { await saveCache(key, { ...response, output: validated }); }
        catch { cacheWarnings.push({ chunk: chunk.index, error: 'cache_write_failed' }); }
      } catch (error) {
        failures.push({ chunk: chunk.index, error: error.name === 'TimeoutError' || error.name === 'AbortError' ? 'model_timeout' : String(error.message).slice(0, 180) });
      }
    }
    const status = !article.chunks.length ? 'no_evidence' : completed === article.chunks.length ? 'completed' : completed ? 'partial' : 'failed';
    results.push({ id: article.id, title: article.title, url: article.url, sourceId: article.sourceId, originalDecision: article.originalDecision, evidenceSource: article.evidenceSource, status, completedChunks: completed, totalChunks: article.chunks.length, ...mergeOutputs(outputs), failures, cacheWarnings });
  }
  return { mode: 'semantic-shadow', generatedAt: new Date().toISOString(), model: manifest.model, modelRevision: manifest.modelRevision, taxonomyVersion: taxonomy.version, contextHash: manifest.contextHash, requests, cacheHits, validatedResponseTokens: totalTokens, elapsedMs: now() - startedAt, results };
}

export function summarize(report, taxonomy) {
  const count = (items, field) => {
    const frequencies = new Map();
    for (const item of items) for (const value of new Set(field(item))) frequencies.set(value, (frequencies.get(value) || 0) + 1);
    return Object.fromEntries([...frequencies].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  };
  const successful = report.results.filter(item => item.status === 'completed');
  const proposals = new Map();
  for (const article of successful) {
    for (const proposal of article.proposed_tags) {
      const key = `${proposal.dimension}/${proposal.tag}`;
      const record = proposals.get(key) || { dimension: proposal.dimension, tag: proposal.tag, descriptions: [], articleIds: [], examples: [] };
      record.descriptions = [...new Set([...record.descriptions, proposal.description])];
      record.articleIds = [...new Set([...record.articleIds, article.id])];
      record.examples.push({ title: article.title, url: article.url, quote: proposal.evidence_quote });
      proposals.set(key, record);
    }
  }
  return {
    completed: successful.length, partial: report.results.filter(item => item.status === 'partial').length,
    failed: report.results.filter(item => item.status === 'failed').length,
    noEvidence: report.results.filter(item => item.status === 'no_evidence').length,
    eventCoverage: count(successful, item => item.events.map(event => event.type)),
    contentCoverage: count(successful, item => item.content_types),
    unusedEventTypes: Object.keys(taxonomy.event_types).filter(type => !successful.some(article => article.events.some(event => event.type === type))),
    proposedTags: [...proposals.values()].sort((a, b) => b.articleIds.length - a.articleIds.length || a.tag.localeCompare(b.tag))
  };
}

async function main() {
  const inputPath = path.resolve(process.env.NEWS_TAGGING_INPUT || path.join(root, 'outputs/news-screening/audit/4c92e2cb37ce/baseline.json'));
  const outputDirectory = path.resolve(process.env.NEWS_TAGGING_OUTPUT || path.join(root, 'outputs/news-tagging'));
  const [input, taxonomy, runtime, prompt, profile] = await Promise.all([
    fs.readFile(inputPath, 'utf8').then(JSON.parse),
    fs.readFile(new URL('taxonomy.json', import.meta.url), 'utf8').then(JSON.parse),
    fs.readFile(new URL('runtime.json', import.meta.url), 'utf8').then(JSON.parse),
    fs.readFile(new URL('system-prompt.txt', import.meta.url), 'utf8'),
    loadBusinessProfile(path.join(root, 'config/luxshare-business-profile.json'))
  ]);
  const manifest = await prepareManifest(input, taxonomy, runtime, prompt, profile);
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify({ ...manifest, status: 'prepared_for_inference' }, null, 2) + '\n');
  await fs.writeFile(path.join(outputDirectory, 'run-state.json'), JSON.stringify({ status: 'prepared_for_inference', contextHash: manifest.contextHash, articles: manifest.articles.length }, null, 2) + '\n');
  if (process.argv.includes('--prepare')) {
    console.log(JSON.stringify({ status: 'prepared_for_inference', articles: manifest.articles.length, chunks: manifest.articles.reduce((sum, article) => sum + article.chunks.length, 0) }));
    return;
  }
  const endpoint = (process.env.NEWS_TAGGING_ENDPOINT || 'http://127.0.0.1:8080').replace(/\/$/, '');
  const parsed = new URL(endpoint);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.username || parsed.password) throw new Error('This trial requires a loopback model server');
  const health = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(5000) });
  if (!health.ok) throw new Error('Inference server is not ready');
  const cacheDirectory = path.join(outputDirectory, 'cache');
  await fs.mkdir(cacheDirectory, { recursive: true });
  const report = await tagManifest({
    manifest, runtime, taxonomy,
    infer: (article, chunk) => requestTags({ endpoint, model: runtime.model, prompt, taxonomy, products: manifest.products, schema: manifest.schema, article, chunk, runtime }),
    loadCache: async key => {
      try { return JSON.parse(await fs.readFile(path.join(cacheDirectory, `${key}.json`), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
    },
    saveCache: async (key, value) => {
      const file = path.join(cacheDirectory, `${key}.json`);
      const temporary = `${file}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(value));
      await fs.rename(temporary, file);
    }
  });
  report.summary = summarize(report, taxonomy);
  await fs.writeFile(path.join(outputDirectory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  const productNames = Object.fromEntries(manifest.products.map(product => [product.productId, product.productName]));
  const label = (values, dictionary) => values.map(value => dictionary[value] || value).join('、');
  const rows = report.results.map(article => [article.title, article.sourceId, article.originalDecision, article.status, `${article.completedChunks}/${article.totalChunks}`, article.evidenceSource,
    label(article.domains, taxonomy.domains), label(article.content_types, taxonomy.content_types), label([...new Set(article.events.map(event => event.type))], taxonomy.event_types),
    article.events.map(event => event.subject).join('\n'), article.events.map(event => event.product_ids.map(id => productNames[id]).join('、')).join('\n'),
    article.events.map(event => taxonomy.statuses[event.status]).join('\n'), article.events.map(event => taxonomy.relations[event.relation]).join('\n'),
    article.events.map(event => event.change_quote).join('\n'), article.events.map(event => event.impact_quote).filter(Boolean).join('\n'), article.proposed_tags.map(tag => `${tag.dimension}/${tag.tag}: ${tag.description}`).join('\n'), article.url]);
  await fs.writeFile(path.join(outputDirectory, 'tags.csv'), encodeCsv([['标题', '来源', '现有结果', '处理状态', '完成分块', '证据来源', '业务标签', '内容类型', '事件标签', '变化对象', '产品标签', '事实状态', '关系类型', '事件原句', '影响原句', '候选新标签', '链接'], ...rows]));
  await fs.writeFile(path.join(outputDirectory, 'tag-discovery.json'), JSON.stringify(report.summary, null, 2) + '\n');
  const lines = [
    '# 语义标签试跑结果', '',
    `模型为 ${report.model}。处理完整 ${report.summary.completed} 篇，部分完成 ${report.summary.partial} 篇，失败 ${report.summary.failed} 篇，缺少证据 ${report.summary.noEvidence} 篇。`, '',
    `本次调用 ${report.requests} 次，缓存命中 ${report.cacheHits} 次，耗时 ${(report.elapsedMs / 60000).toFixed(1)} 分钟。`, '',
    '## 事件标签覆盖', '', '| 标签 | 完整处理文章数 |', '| --- | --- |'
  ];
  for (const [type, count] of Object.entries(report.summary.eventCoverage)) lines.push(`| ${taxonomy.event_types[type]} | ${count} |`);
  lines.push('', '## 内容类型覆盖', '', '| 类型 | 完整处理文章数 |', '| --- | --- |');
  for (const [type, count] of Object.entries(report.summary.contentCoverage)) lines.push(`| ${taxonomy.content_types[type]} | ${count} |`);
  lines.push('', '## 候选新标签', '');
  for (const proposal of report.summary.proposedTags) {
    lines.push(`- ${proposal.dimension}/${proposal.tag}，涉及 ${proposal.articleIds.length} 篇。${proposal.descriptions.join('；')}`);
    for (const example of proposal.examples.slice(0, 2)) lines.push(`  - ${example.title}。依据为 ${example.quote}`);
  }
  if (!report.summary.proposedTags.length) lines.push('完整处理记录中没有得到可核对的新标签建议。');
  lines.push('', '## 本批未覆盖的既有事件标签', '', report.summary.unusedEventTypes.map(type => taxonomy.event_types[type]).join('、'), '', '候选标签需要结合例句和人工审阅确认。事件标签和关系均为模型输出，原文引用已做存在性校验，语义正确性仍需核对。', '');
  await fs.writeFile(path.join(outputDirectory, 'report.md'), lines.join('\n'));
  const status = report.summary.completed === report.results.length ? 'completed' : report.summary.completed || report.summary.partial ? 'partial' : 'failed';
  await fs.writeFile(path.join(outputDirectory, 'run-state.json'), JSON.stringify({ status, contextHash: manifest.contextHash, finishedAt: report.generatedAt, articles: manifest.articles.length }, null, 2) + '\n');
  console.log(JSON.stringify({ ...report.summary, requests: report.requests, cacheHits: report.cacheHits, elapsedMs: report.elapsedMs }));
  if (report.summary.completed !== report.results.length) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
