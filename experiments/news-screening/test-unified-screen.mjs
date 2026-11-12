import assert from 'node:assert/strict';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';

const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const make = (title, bodyEvidence, publishedAt = '2026-11-12') => ({
  title, bodyEvidence, publishedAt, sourceId: 'synthetic', bodyStatus: 'ok'
});
const direct = screen(make('Server rack launched', ['Lenovo introduced a new liquid-cooled server rack system for data centers.']), profile);
assert.equal(direct.result, '入选');
assert.equal(direct.unifiedTagging.mainEvent?.eventType, 'product');
assert.equal(direct.homepageCandidate, true);

const uncertain = screen(make('Valeo automotive radar order', ['Valeo secured a contract for an automotive radar from a vehicle manufacturer.']), profile);
assert.equal(uncertain.unifiedTagging.mainEvent?.eventType, 'order');
assert.equal(uncertain.result, '待定');

const noBody = screen({ ...make('Server rack launched', []), bodyStatus: 'insufficient' }, profile);
assert.equal(noBody.result, '待定');
assert.equal(noBody.eventGate, 'not_found');

console.log('Unified program scope, direct mapping and unresolved relation checks passed');
