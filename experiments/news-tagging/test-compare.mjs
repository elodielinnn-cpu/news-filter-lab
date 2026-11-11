import assert from 'node:assert/strict';
import { compareDecisions, comparisonCsv } from './compare.mjs';

const supported = {
  id: 'one', title: 'Supplier switch', url: 'https://example.com/one',
  originalDecision: '排除', originalBusiness: '汽车', originalAffectedObject: '', originalEvidence: '', originalReason: '产品未匹配',
  status: 'completed', domains: ['automotive'],
  content_types: ['industry-news'],
  events: [{ status: 'occurred', change_quote: 'Supplier switched' }],
  proposed_tags: []
};
const unfinished = { ...supported, id: 'two', status: 'partial' };
const speculative = { ...supported, id: 'three', events: [{ ...supported.events[0], status: 'rumor' }], proposed_tags: [] };
const unsupportedSelection = { ...supported, id: 'four', originalDecision: '入选', events: [] };
const backgroundOnly = { ...supported, id: 'five', refined_events: [] };
const rows = compareDecisions({ results: [supported, unfinished, speculative, unsupportedSelection, backgroundOnly] });
assert.equal(rows[0].tagDecision, '发现实质事件，产品关系待核对');
assert.equal(rows[0].discrepancy, true);
assert.match(rows[0].reviewReason, /知识库/);
assert.equal(rows[1].tagDecision, '证据或推理未完成');
assert.equal(rows[1].discrepancy, false);
assert.equal(rows[2].tagDecision, '未发现实质事件');
assert.equal(rows[3].discrepancy, true);
assert.equal(rows[4].tagDecision, '未发现实质事件');
assert.match(rows[3].reviewReason, /原规则入选/);
assert.match(comparisonCsv(rows), /Supplier switched/);
assert.match(comparisonCsv(rows), /产品未匹配/);
console.log('Comparison review cases passed');
