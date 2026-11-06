import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compareModels, modelComparisonCsv } from './compare-models.mjs';

const baseline = JSON.parse(fs.readFileSync(new URL('baselines/qwen2.5-1.5b-run-42169329227.json', import.meta.url), 'utf8'));
const current = {
  model: 'Qwen2.5-7B-Instruct-Q4_K_M',
  results: baseline.results.map(article => ({ ...article, events: article.events.map(event => ({ ...event })) }))
};
const sameTags = compareModels(baseline, current);
assert.equal(sameTags.rows.length, 48);
assert.equal(sameTags.changedEventTags, 0);
assert.equal(sameTags.baselineCompleted, 43);
assert.equal(sameTags.currentCompleted, 43);
assert.equal(sameTags.comparableArticles, 43);

current.results[0].events = [{ type: 'quality-recall' }];
const changed = compareModels(baseline, current);
assert.equal(changed.changedEventTags, 1);
assert(changed.rows[0].added.includes('quality-recall'));
assert(modelComparisonCsv(changed).includes('7B新增标签'));

current.results[0].status = 'partial';
const incomplete = compareModels(baseline, current);
assert.equal(incomplete.comparableArticles, 42);
assert.equal(incomplete.changedEventTags, 0);
current.results[0].status = 'completed';

assert.throws(() => compareModels(baseline, { ...current, model: baseline.model }), /different models/);
assert.throws(() => compareModels(baseline, { ...current, results: current.results.slice(1) }), /same frozen article IDs/);
console.log('Model comparison checks passed');
