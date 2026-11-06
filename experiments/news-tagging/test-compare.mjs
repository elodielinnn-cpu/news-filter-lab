import assert from 'node:assert/strict';
import { compareDecisions, comparisonCsv } from './compare.mjs';

const supported = {
  id: 'one', title: 'Supplier switch', url: 'https://example.com/one',
  originalDecision: '排除', status: 'completed', domains: ['automotive'],
  content_types: ['industry-news'],
  events: [{ status: 'occurred', relation: 'direct', change_quote: 'Supplier switched', impact_quote: '' }],
  proposed_tags: [{ dimension: 'product', description: '车载连接器', evidence_quote: 'connector' }]
};
const unfinished = { ...supported, id: 'two', status: 'partial' };
const speculative = { ...supported, id: 'three', events: [{ ...supported.events[0], status: 'rumor' }], proposed_tags: [] };
const rows = compareDecisions({ results: [supported, unfinished, speculative] });
assert.equal(rows[0].tagDecision, '待人工核对');
assert.equal(rows[0].discrepancy, true);
assert.equal(rows[0].productProposals.length, 1);
assert.equal(rows[1].tagDecision, '证据或推理未完成');
assert.equal(rows[1].discrepancy, false);
assert.equal(rows[1].productProposals.length, 0);
assert.equal(rows[2].tagDecision, '未发现可入选证据');
assert.match(comparisonCsv(rows), /Supplier switched/);
console.log('Comparison review cases passed');
