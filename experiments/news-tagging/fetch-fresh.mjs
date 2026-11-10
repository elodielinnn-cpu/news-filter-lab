import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from '../news-screening/screen.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sources = JSON.parse(await fs.readFile(new URL('fresh-sources.json', import.meta.url), 'utf8'));
const profile = await loadBusinessProfile(path.join(root, 'config/luxshare-business-profile.json'));
const decode = value => value.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/giu, token => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[token.toLowerCase()] || token);
const clean = value => decode(value.replace(/<[^>]+>/gu, ' ')).replace(/\s+/gu, ' ').trim();
const articles = [];
const failures = [];
for (const source of sources) {
  try {
    const response = await fetch(source.url, { headers: { 'user-agent': 'Mozilla/5.0 news-filter-lab/1.0' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const paragraphs = fragment => [...fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/giu)].map(match => clean(match[1])).filter(value => value.length > 60).slice(0, 45);
    const articleHtml = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/iu)?.[1];
    const scoped = articleHtml ? paragraphs(articleHtml) : [];
    const bodyEvidence = scoped.length >= 3 ? scoped : paragraphs(html);
    if (bodyEvidence.length < 3) throw new Error('insufficient_body');
    const article = { title: source.title, url: source.url, sourceId: new URL(source.url).hostname, summary: bodyEvidence[1] || '', bodyEvidence,
      bodyStatus: 'ok', evidenceSource: 'fresh-fetch-2026-11', publishedAt: null };
    article.decision = screen(article, profile);
    articles.push(article);
  } catch (error) { failures.push({ url: source.url, error: String(error.message).slice(0, 100) }); }
}
if (articles.length < 5) throw new Error(`Fresh batch has only ${articles.length} complete articles: ${JSON.stringify(failures)}`);
const directory = path.join(root, 'outputs/news-tagging');
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(path.join(directory, 'fresh-batch.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), articles, failures }, null, 2) + '\n');
console.log(JSON.stringify({ fetched: articles.length, failures, decisions: articles.map(a => a.decision.result) }));
