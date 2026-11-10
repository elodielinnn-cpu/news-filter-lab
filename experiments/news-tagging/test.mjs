import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { extractAtTags, normalizeTag, chunkText, evidenceSpans, validateOutput, mergeOutputs, digest } from './adapter.mjs';
import { prepareManifest, requestTags, tagManifest, summarize } from './run.mjs';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { refineEvents } from './refine.mjs';

const taxonomy = JSON.parse(await fs.readFile(new URL('taxonomy.json', import.meta.url), 'utf8'));
const runtime = JSON.parse(await fs.readFile(new URL('runtime.json', import.meta.url), 'utf8'));
const prompt = await fs.readFile(new URL('system-prompt.txt', import.meta.url), 'utf8');
const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const text = 'The server cold plate was redesigned to improve cooling performance.';
const fixture = { title: 'Synthetic server update', url: 'https://example.com/synthetic', sourceId: 'synthetic', bodyEvidence: [text], evidenceSource: 'synthetic', decision: { result: '排除' } };
const manifest = await prepareManifest({ articles: [fixture] }, taxonomy, runtime, prompt, profile);
const chunk = manifest.articles[0].chunks[0];
const raw = {
  domains: ['datacom-telecom'], content_types: ['industry-news'], raw_tags: ['@Cooling', '@server_cooling'], proposed_tags: [],
  events: [{ type: 'technology-update', status: 'occurred', subject: 'server cold plate', evidence_id: 0 }]
};
const valid = validateOutput(raw, chunk, taxonomy);
assert.deepEqual(extractAtTags('@GPU @gpu @冷板 @server-cooling'), ['gpu', '冷板', 'server-cooling']);
assert.equal(normalizeTag('@Server_Cooling'), 'server-cooling');
assert.equal(evidenceSpans(text)[0].text, text);
assert.equal(valid.events[0].change_quote, text);
const grounded = refineEvents([
  { type: 'deployment-adoption', status: 'forecast', change_quote: 'The company plans to deploy the fleet next year.' },
  { type: 'merger-acquisition', status: 'occurred', change_quote: 'Intel signed an agreement to acquire Classiq.' },
  { type: 'other-event', status: 'occurred', change_quote: 'The conference discussed AI.' }
]);
assert.deepEqual(grounded.kept.map(event => event.type), ['merger-acquisition']);
assert.deepEqual(grounded.rejected.map(event => event.rejection_reason), ['forecast_is_not_an_event', 'boilerplate_or_fragment']);
const freshChecks = refineEvents([
  { type: 'capacity-expansion', status: 'occurred', change_quote: 'CoreWeave has brought most of its planned 22.5MW of IT capacity online at DEN01.' },
  { type: 'order-contract', status: 'confirmed-plan', change_quote: 'Dropbox has signed a definitive agreement to acquire Tigris Data.' },
  { type: 'product-launch', status: 'occurred', change_quote: 'Find all our press releases: https://www.valeo.com/en/press-releases/' }
]);
assert.deepEqual(freshChecks.kept.map(event => event.type), ['capacity-expansion']);
const reviewedChecks = refineEvents([
  { type: 'architecture-change', status: 'confirmed-plan', change_quote: 'The two companies will deliver clusters built from existing rack-scale systems.' },
  { type: 'architecture-change', status: 'occurred', change_quote: 'The new design moves cached state off the GPU and onto a shared storage tier.' },
  { type: 'product-launch', status: 'occurred', change_quote: 'The companies announced a new managed security offering for AI servers.' },
  { type: 'product-launch', status: 'confirmed-plan', change_quote: 'The companies will deliver clusters built from existing rack-scale systems.' },
  { type: 'research-prototype', status: 'trial-validation', change_quote: 'The three companies tested the stack at cluster level under heavy load.' },
  { type: 'qualification-certification', status: 'occurred', change_quote: 'The camera platform has secured design wins with several automakers.' },
  { type: 'partnership', status: 'confirmed-plan', change_quote: 'The partnership will create new opportunities in a growing market.' }
]);
assert.deepEqual(reviewedChecks.kept.map(event => event.type), ['architecture-change', 'product-launch', 'research-prototype', 'qualification-certification']);
assert.deepEqual(reviewedChecks.rejected.map(event => event.rejection_reason), ['architecture_not_supported_by_quote', 'launch_not_supported_by_quote', 'joint_action_not_supported']);
const firstBatchChecks = refineEvents([
  { type: 'product-launch', status: 'confirmed-plan', change_quote: 'Next year, the company will launch the electric van after final testing.' },
  { type: 'product-launch', status: 'occurred', change_quote: 'The company launched a new liquid-cooled server platform today.' },
  { type: 'pricing-cost', status: 'confirmed-plan', change_quote: 'The company will announce prices closer to the vehicle launch.' },
  { type: 'pricing-cost', status: 'occurred', change_quote: 'The new server rack costs $411,200 compared with $172,500 for the older system.' },
  { type: 'order-contract', status: 'occurred', change_quote: 'You can check out the full text of the contract below.' },
  { type: 'order-contract', status: 'occurred', change_quote: 'The operator signed a supply agreement for server power systems.' }
]);
assert.deepEqual(firstBatchChecks.kept.map(event => event.type), ['product-launch', 'pricing-cost', 'order-contract']);
assert.deepEqual(firstBatchChecks.rejected.map(event => event.rejection_reason), ['future_launch_not_released', 'price_or_cost_change_not_stated', 'contract_action_not_supported']);
const duplicateQuote = { type: 'technology-update', status: 'occurred', subject: 'IBM', evidence_id: 1, change_quote: 'A shared storage tier was introduced.', chunk: 0 };
assert.equal(mergeOutputs([{ domains: [], content_types: [], events: [duplicateQuote], raw_tags: [], proposed_tags: [] },
  { domains: [], content_types: [], events: [{ ...duplicateQuote, subject: 'NVIDIA', chunk: 1 }], raw_tags: [], proposed_tags: [] }]).events.length, 1);
assert.deepEqual(freshChecks.rejected.map(event => event.rejection_reason), ['acquisition_is_not_supply_contract', 'boilerplate_or_fragment']);
const twoSentences = { ...chunk, text: 'BYD launched a new electric SUV. Sales remain uncertain.' };
assert.deepEqual(evidenceSpans(twoSentences.text).map(span => span.id), [0, 1]);
assert.equal(validateOutput({ ...raw, events: [{ ...raw.events[0], evidence_id: 1 }] }, twoSentences, taxonomy).events[0].change_quote, 'Sales remain uncertain.');
assert.ok(!JSON.stringify(manifest.schema).includes('product_ids'));
assert.ok(!Object.hasOwn(validateOutput({ ...raw, events: [{ ...raw.events[0], product_ids: ['cold_plate'], relation: 'direct' }] }, chunk, taxonomy).events[0], 'product_ids'));
assert.deepEqual(validateOutput(valid, chunk, taxonomy), valid);
assert.throws(() => validateOutput({ ...raw, content_types: ['invented'] }, chunk, taxonomy), /Invalid/);
assert.throws(() => validateOutput({ ...raw, events: [{ ...raw.events[0], evidence_id: 99 }] }, chunk, taxonomy), /Evidence ID/);
const invalidProposal = validateOutput({ ...raw, proposed_tags: [{ dimension: 'product', tag: 'cold-plate', description: '冷板', evidence_id: 0 }] }, chunk, taxonomy);
assert.equal(invalidProposal.events.length, 1);
assert.equal(invalidProposal.proposed_tags.length, 0);
assert.deepEqual(invalidProposal.proposal_warnings, ['Invalid tag proposal']);
const invalidSlug = validateOutput({ ...raw, proposed_tags: [{ dimension: 'event', tag: '车辆召回', description: '车辆召回', evidence_id: 0 }] }, chunk, taxonomy);
assert.equal(invalidSlug.events.length, 1);
assert.deepEqual(invalidSlug.proposal_warnings, ['Proposal must use a lowercase English slug']);
const duplicateProposal = validateOutput({ ...raw, proposed_tags: [{ dimension: 'event', tag: 'product-launch', description: '新品发布', evidence_id: 0 }] }, chunk, taxonomy);
assert.equal(duplicateProposal.proposed_tags.length, 0);
assert.deepEqual(duplicateProposal.proposal_warnings, ['Proposal duplicates an existing tag']);
const invalidProposalEvidence = validateOutput({ ...raw, proposed_tags: [{ dimension: 'event', tag: 'new-event', description: '新事件', evidence_id: 99 }] }, chunk, taxonomy);
assert.equal(invalidProposalEvidence.events.length, 1);
assert.deepEqual(invalidProposalEvidence.proposal_warnings, ['Evidence ID absent from supplied chunk']);
const proposed = validateOutput({ ...raw, proposed_tags: [{ dimension: 'event', tag: 'Thermal_Optimization', description: '散热优化', evidence_id: 0 }] }, chunk, taxonomy);
assert.equal(proposed.proposed_tags[0].tag, 'thermal-optimization');
assert.equal(taxonomy.event_types['thermal-optimization'], undefined);

const long = Array.from({ length: 35 }, (_, index) => `Paragraph ${index}: ${'word '.repeat(70)}`);
const chunks = chunkText(long, 800, 100);
assert.ok(chunks.length > 10);
assert.equal(chunks[0].start, 0);
assert.ok(chunks.every(item => item.text.length <= 800));
assert.equal(chunks.at(-1).end, long.map(value => value.trim()).join('\n\n').length);
assert.ok(chunks.slice(1).every((item, index) => item.start <= chunks[index].end));
assert.throws(() => chunkText(long, 100, 100), /limits/);
const unicodeChunks = chunkText(['a'.repeat(99) + '😀' + 'b'.repeat(150)], 100, 5);
assert.ok(unicodeChunks.every(item => !/[\uD800-\uDBFF]$/u.test(item.text) && !/^[\uDC00-\uDFFF]/u.test(item.text)));
assert.ok(chunkText(['word '.repeat(45), 'word '.repeat(45)], 100, 99).length < 500);

const cache = new Map();
const progress = [];
const infer = async () => ({ output: proposed, actualModel: runtime.model, usage: { total_tokens: 100 } });
const report = await tagManifest({ manifest, runtime, taxonomy, prompt, infer, loadCache: async key => cache.get(key), saveCache: async (key, value) => cache.set(key, value), onProgress: item => progress.push(item) });
assert.equal(report.results[0].status, 'completed');
assert.equal(report.requests, 1);
assert.deepEqual(progress.map(item => [item.processedChunks, item.totalChunks, item.outcome]), [[1, 1, 'completed']]);
assert.equal(summarize(report, taxonomy).proposedTags[0].articleIds.length, 1);
const optionalFailure = await tagManifest({ manifest, runtime, taxonomy, prompt, infer: async () => ({ output: invalidSlug, actualModel: runtime.model }) });
assert.equal(optionalFailure.results[0].status, 'completed');
assert.equal(optionalFailure.results[0].events.length, 1);
assert.equal(summarize(optionalFailure, taxonomy).proposalWarningCoverage['Proposal must use a lowercase English slug'], 1);
const cached = await tagManifest({ manifest, runtime, taxonomy, prompt, infer: async () => { throw new Error('should not call'); }, loadCache: async key => cache.get(key) });
assert.equal(cached.cacheHits, 1);
assert.equal(cached.requests, 0);
assert.deepEqual(cached.results[0].raw_tags, report.results[0].raw_tags);
assert.notEqual(digest([manifest.contextHash, chunk.text]), digest(['different-model', chunk.text]));
const corrupt = await tagManifest({ manifest, runtime, taxonomy, prompt, infer, loadCache: async () => ({ output: {} }) });
assert.equal(corrupt.results[0].status, 'completed');
assert.equal(corrupt.results[0].cacheWarnings[0].error, 'invalid_cache_entry');
const cacheFailure = await tagManifest({ manifest, runtime, taxonomy, prompt, infer, saveCache: async () => { throw new Error('disk error'); } });
assert.equal(cacheFailure.results[0].status, 'completed');
assert.equal(cacheFailure.results[0].cacheWarnings[0].error, 'cache_write_failed');
const failed = await tagManifest({ manifest, runtime, taxonomy, prompt, infer: async () => { throw new Error('model_http_500'); } });
assert.equal(failed.results[0].status, 'failed');
assert.equal(failed.requests, 1);
assert.equal(failed.results[0].events.length, 0);
assert.equal(summarize(failed, taxonomy).failureCoverage.model_http_500, 1);

const twoChunkManifest = { ...manifest, articles: [{ ...manifest.articles[0], chunks: [chunk, { ...chunk, index: 1 }] }] };
let calls = 0;
const partial = await tagManifest({ manifest: twoChunkManifest, runtime, taxonomy, prompt, infer: async () => { if (calls++) throw new Error('second chunk fails'); return infer(); } });
assert.equal(partial.results[0].status, 'partial');
assert.equal(summarize(partial, taxonomy).completed, 0);
let clock = 0;
const deferred = await tagManifest({ manifest, runtime: { ...runtime, run_budget_ms: 1 }, taxonomy, prompt, infer, now: () => clock++ * 10 });
assert.equal(deferred.requests, 0);
assert.equal(deferred.results[0].failures[0].error, 'run_budget_exhausted');
const consumer = await prepareManifest({ articles: [{ ...fixture, title: 'New iPhone speaker' }] }, taxonomy, runtime, prompt, profile);
assert.equal(consumer.articles.length, 0);

let sent;
const args = { endpoint: 'http://127.0.0.1:8080', model: runtime.model, prompt, taxonomy, schema: manifest.schema, article: fixture, chunk, runtime };
const response = await requestTags({ ...args, fetchImpl: async (url, request) => {
  sent = JSON.parse(request.body);
  return { ok: true, json: async () => ({ model: runtime.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }], usage: { total_tokens: 100 } }) };
} });
assert.equal(response.output.events[0].change_quote, text);
assert.equal(sent.response_format.type, 'json_object');
assert.ok(sent.messages[1].content.includes(text));
assert.ok(!sent.messages[1].content.includes('cold_plate'));
await assert.rejects(() => requestTags({ ...args, fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) }) }), /incomplete/);
await assert.rejects(() => requestTags({ ...args, fetchImpl: async () => ({ ok: false, status: 429 }) }), /429/);


await assert.rejects(() => requestTags({ ...args, fetchImpl: async () => ({ ok: true, json: async () => ({ model: 'wrong-model', choices: [] }) }) }), /identity/);
console.log('Feeds Fun extraction port, grounding, chunk completeness, taxonomy proposals, cache recovery, partial failures, budgets, consumer isolation and model protocol checks passed');
