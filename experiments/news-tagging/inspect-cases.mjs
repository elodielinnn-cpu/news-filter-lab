import fs from 'node:fs/promises';
import { evidenceSpans } from './adapter.mjs';

const markdown = process.argv.includes('--markdown');
const [manifestPath, ...resultPaths] = process.argv.slice(2).filter(argument => argument !== '--markdown');
if (!manifestPath || !resultPaths.length) throw new Error('Usage: node inspect-cases.mjs MANIFEST_JSON RESULTS_JSON...');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const reports = await Promise.all(resultPaths.map(async file => ({ file, data: JSON.parse(await fs.readFile(file, 'utf8')) })));
const targetTitles = ['NetApp Novus Splits', 'Meta Prometheus:'];
const cases = targetTitles.map(titlePrefix => {
  const article = manifest.articles.find(item => item.title.startsWith(titlePrefix));
  if (!article) throw new Error(`Article absent from manifest: ${titlePrefix}`);
  const chunks = article.chunks.map(chunk => ({ chunk: chunk.index, text: chunk.text, evidence_spans: evidenceSpans(chunk.text) }));
  return {
    title: article.title, url: article.url, chunks,
    runs: reports.map(({ file, data }) => {
      const result = data.results.find(item => item.url === article.url);
      if (!result) throw new Error(`Article absent from results: ${article.url} in ${file}`);
      return { file, status: result.status, events: result.events.map(event => ({
        ...event, actor: event.actor || null, object: event.object || null, action: event.action || null,
        article_role: event.article_role || null,
        rejection_reason: result.rejected_events.find(rejected => rejected.type === event.type && rejected.change_quote === event.change_quote)?.rejection_reason || null
      })) };
    })
  };
});
if (markdown) {
  const lines = ['# NetApp 与 Meta：实际送模正文及候选事件', '', '旧版没有单独输出主体、产品、动作和文章角色；空值表示当时未记录，不能从标题臆填。', ''];
  for (const article of cases) {
    lines.push(`## ${article.title}`, '', `原文链接：${article.url}`, '', '### 送入模型的全部正文段落', '');
    for (const chunk of article.chunks) {
      lines.push(`#### 分段 ${chunk.chunk}`, '', chunk.text, '');
    }
    lines.push('### 模型候选事件', '');
    for (const run of article.runs) {
      lines.push(`#### ${run.file}`, '');
      for (const event of run.events) {
        lines.push(`- 标签：${event.type}；阶段：${event.status}；主体：${event.actor || '未记录'}；产品或项目：${event.object || '未记录'}；动作：${event.action || '未记录'}；文章角色：${event.article_role || '未记录'}`);
        lines.push(`  - 证据位置：分段 ${event.chunk}、句子 ${event.evidence_id}；检查结果：${event.rejection_reason || '保留'}`);
        lines.push(`  - 原文：${event.change_quote}`);
      }
      lines.push('');
    }
  }
  console.log(lines.join('\n'));
} else {
  console.log(JSON.stringify({ description: 'Actual model input and event candidates; null record fields were not produced by the previous model schema.', cases }, null, 2));
}
