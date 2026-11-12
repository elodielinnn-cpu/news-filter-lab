import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chunkText, digest, evidenceSpans, mergeOutputs, outputSchema, validateOutput } from './adapter.mjs';
import { prepareManifest, requestTags, selectMainEvent, tagManifest } from './run.mjs';
import { refineEvents } from './refine.mjs';
import { compareDecisions } from './compare.mjs';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';

const taxonomy = JSON.parse(await fs.readFile(new URL('taxonomy.json', import.meta.url), 'utf8'));
const runtime = JSON.parse(await fs.readFile(new URL('runtime.json', import.meta.url), 'utf8'));
const prompt = await fs.readFile(new URL('system-prompt.txt', import.meta.url), 'utf8');
const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
assert.equal(Object.keys(taxonomy.event_types).length, 7);
const body = 'Valeo secured a new contract for automotive radar with a North American OEM.';
const article = { title: 'Valeo radar contract', url: 'https://example.com/valeo-radar', sourceId: 'synthetic',
  publishedAt: null, bodyEvidence: [body], evidenceSource: 'fixture', decision: { result: '排除' } };
const manifest = await prepareManifest({ articles: [article] }, taxonomy, runtime, prompt, profile);
const chunk = manifest.articles[0].chunks[0];
const raw = { domains: ['automotive'], content_types: ['industry-news'], raw_tags: ['radar'], proposed_tags: [],
  events: [{ type: 'order', status: 'not_applicable', actor: 'Valeo', object: 'automotive radar', action: 'secured a new contract',
    article_role: 'primary', evidence_id: 0 }] };
const valid = validateOutput(raw, chunk, taxonomy);
assert.equal(valid.events[0].change_quote, body);
assert.equal(valid.events[0].actor, 'Valeo');
assert.deepEqual(evidenceSpans(chunk.text).map(item => item.id), [0]);
assert.throws(() => validateOutput({ ...raw, events: [{ ...raw.events[0], evidence_id: 3 }] }, chunk, taxonomy), /Evidence ID/);
assert.throws(() => validateOutput({ ...raw, events: [{ ...raw.events[0], type: 'order-contract' }] }, chunk, taxonomy), /Invalid event record/);
assert.throws(() => validateOutput({ ...raw, domains: ['datacom-telecom'] }, chunk, taxonomy), /Invalid domains/);

const wrongActor = refineEvents([{ ...valid.events[0], actor: 'CoreWeave' }]);
assert.equal(wrongActor.kept[0].verification_status, 'needs_review');
assert.ok(wrongActor.kept[0].verification_warnings.includes('actor_not_in_evidence'));
const background = refineEvents([{ ...valid.events[0], article_role: 'background' }]);
assert.equal(background.rejected[0].rejection_reason, 'background_not_article_event');
const unknown = refineEvents([{ ...valid.events[0], status: 'unknown' }]);
assert.equal(unknown.kept.length, 1); // Unclear stage is a reviewable fact, not a silent veto.
const reviewArticle = { status: 'completed', title: 'Server benchmark', url: 'https://example.com/review',
  domains: ['datacom'], content_types: ['product-review'], main_event: { ...valid.events[0], type: 'technology', status: 'validation' },
  originalDecision: '排除' };
assert.equal(compareDecisions({ results: [reviewArticle] })[0].tagDecision, '发现实质事件，产品关系待核对');
assert.equal(selectMainEvent([{ ...valid.events[0], article_role: 'related' }, valid.events[0]]).article_role, 'primary');
assert.equal(mergeOutputs([valid, valid]).events.length, 1);

const long = Array.from({ length: 20 }, (_, index) => `Paragraph ${index}: ${'word '.repeat(70)}`);
const chunks = chunkText(long, 800, 100);
assert.ok(chunks.length > 5);
assert.ok(chunks.every(item => item.text.length <= 800));
assert.notEqual(digest([manifest.contextHash, chunk.text]), digest(['other-version', chunk.text]));
const cache = new Map();
const infer = async () => ({ output: raw, actualModel: runtime.model, usage: { total_tokens: 100 } });
const report = await tagManifest({ manifest, runtime, taxonomy, infer,
  loadCache: async key => cache.get(key), saveCache: async (key, value) => cache.set(key, value) });
assert.equal(report.results[0].status, 'completed');
assert.equal(report.results[0].main_event?.type, 'order');
assert.equal(report.results[0].display_events.length, 1);
const cached = await tagManifest({ manifest, runtime, taxonomy, infer: async () => { throw new Error('cache miss'); },
  loadCache: async key => cache.get(key) });
assert.equal(cached.cacheHits, 1);
const failure = await tagManifest({ manifest, runtime, taxonomy, infer: async () => { throw new Error('model_http_500'); } });
assert.equal(failure.results[0].status, 'failed');
const consumer = await prepareManifest({ articles: [{ ...article, title: 'New iPhone speaker' }] }, taxonomy, runtime, prompt, profile);
assert.equal(consumer.articles.length, 0);

let sent;
const response = await requestTags({ endpoint: 'http://127.0.0.1:8080', model: runtime.model, prompt, taxonomy,
  schema: outputSchema(taxonomy), article, chunk, runtime,
  fetchImpl: async (_url, request) => {
    sent = JSON.parse(request.body);
    return { ok: true, json: async () => ({ model: runtime.model,
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] }) };
  } });
assert.equal(response.output.events[0].type, 'order');
assert.equal(sent.response_format.schema.properties.events.items.properties.evidence_id.maximum, 0);
console.log('Unified model schema, evidence checks, review behavior, cache and protocol passed');
