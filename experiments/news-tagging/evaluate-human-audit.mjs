import fs from 'node:fs/promises';

const input = process.argv[2];
const auditOption = process.argv.indexOf('--audit');
const auditPath = auditOption < 0 ? new URL('human-audit-48.json', import.meta.url) : process.argv[auditOption + 1];
if (!input || !auditPath) throw new Error('Usage: node experiments/news-tagging/evaluate-human-audit.mjs RESULTS_JSON [--refined] [--audit AUDIT_JSON]');
const audit = JSON.parse(await fs.readFile(auditPath, 'utf8'));
const report = JSON.parse(await fs.readFile(input, 'utf8'));
if (!Array.isArray(report.results)) throw new Error('Expected results array');
const refined = process.argv.includes('--refined');

const byUrl = new Map(report.results.map(article => [article.url, article]));
const rows = audit.articles.map(item => {
  const actual = byUrl.get(item.source_url);
  const expected = item.expected_event_types;
  if (refined && actual?.status === 'completed' && !Array.isArray(actual.refined_events)) throw new Error('Refined events absent from results');
  const observed = actual?.status === 'completed' ? [...new Set((refined ? actual.refined_events : actual.events).map(event => event.type))].sort() : [];
  return {
    number: item.number, title: item.title, url: item.source_url,
    status: actual?.status || 'missing', expected, observed,
    missing: actual?.status === 'completed' ? expected.filter(tag => !observed.includes(tag)) : expected,
    extra: actual?.status === 'completed' ? observed.filter(tag => !expected.includes(tag)) : [],
    recommended_destination: item.recommended_destination,
    review_reason: item.review_reason
  };
});
const summary = {
  total: rows.length,
  completed: rows.filter(row => row.status === 'completed').length,
  exactEventSets: rows.filter(row => row.status === 'completed' && !row.missing.length && !row.extra.length).length,
  withMissingTags: rows.filter(row => row.missing.length).length,
  withExtraTags: rows.filter(row => row.extra.length).length,
  emptyExpected: rows.filter(row => !row.expected.length).length
};
console.log(JSON.stringify({ model: report.model, mode: refined ? 'refined' : 'raw', summary, rows }, null, 2));
