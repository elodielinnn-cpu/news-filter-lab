import assert from 'node:assert/strict';
import { TAGGING_TAXONOMY, tagArticle } from './unified-tagging.mjs';

const tag = (title, bodyEvidence, scope = ['datacom', 'automotive', 'consumer']) =>
  tagArticle({ title, bodyEvidence, sourceId: 'synthetic' }, { scope });

const launch = tag('Server platform launched', ['Lenovo introduced a new server platform for data centers.']);
assert.deepEqual(launch.displayTags, ['通信与数据中心', '新产品', '已发布']);
assert.equal(launch.mainEvent.paragraphId, 1);
assert.equal(launch.mainEvent.actor, 'Lenovo');
assert.ok(launch.mainEvent.object.includes('server platform'));

const plan = tag('Supermicro inference racks', ['Supermicro plans to launch a new AI rack system next year.']);
assert.equal(plan.mainEvent?.stage, 'planned');
const test = tag('AMD Helios racks at Meta', ['AMD says Helios rackscale systems are installed and under test at Meta.']);
assert.equal(test.mainEvent?.stage, 'validation');
assert.equal(test.mainEvent?.actor, 'AMD');
const volume = tag('Server rack supply', ['Vertiv started mass production of its server rack system.']);
assert.equal(volume.mainEvent?.stage, 'scale_use');
const orderable = tag('New data-center system', ['Vertiv announced a new data-center rack system, now available to order.']);
assert.equal(orderable.mainEvent?.stage, 'published');
assert.equal(orderable.mainEvent?.availability, 'orderable');
const availableAfterPlan = tag('Server rack cloud expansion', ['Oracle plans to expand its cloud server racks, and the rack system is now generally available.']);
assert.ok(availableAfterPlan.facts.some(fact => fact.eventType === 'product' && fact.stage === 'published'));
const futureProduction = tag('New server rack plans', ['Vertiv will begin mass production of its new server rack next year.']);
assert.equal(futureProduction.mainEvent?.stage, 'planned');
const sameProductProgress = tag('Enterprise SSD announced', [
  'DapuStor announced an enterprise SSD for cloud servers. The drive has 2W idle power. DapuStor says it is in volume production and running in customer environments.'
]);
assert.equal(sameProductProgress.mainEvent?.stage, 'scale_use');
assert.match(sameProductProgress.mainEvent?.stageEvidence || '', /volume production/u);
const launchedAxle = tag('Valeo eAxle for Dacia', ['Valeo announces the commercial launch of its 48V eAxle for automotive applications.']);
assert.equal(launchedAxle.mainEvent?.eventType, 'product');
assert.equal(launchedAxle.mainEvent?.stage, 'published');
const reviewActor = tag('NVIDIA Vera CPU Review', ['Memory bandwidth tests measured 25% more throughput in a server CPU system.']);
assert.notEqual(reviewActor.mainEvent?.actor, 'Memory');
assert.notEqual(reviewActor.mainEvent?.actor, 'Vera');

const contract = tag('Valeo radar contract', ['Valeo secured a new contract for automotive radar with a vehicle manufacturer.'], ['automotive', 'datacom']);
assert.deepEqual(contract.displayTags, ['汽车电子', '订单与定点']);
assert.equal(contract.mainEvent.stage, 'not_applicable');
const genericOem = tag('Server CPU review', ['AMD reported a measured 25% performance increase in a server OEM test.']);
assert.ok(!genericOem.mainEvent?.domains.includes('automotive'));

const reviewOnlySpecs = tag('Server CPU review', ['This server CPU has 256 cores and 600W rated power.']);
assert.equal(reviewOnlySpecs.mainEvent, null);
const reviewResult = tag('Server CPU review', ['Our testing measured a 25% performance increase in a server CPU system.']);
assert.equal(reviewResult.mainEvent?.eventType, 'technology');
assert.equal(reviewResult.mainEvent?.stage, 'unknown');
const cloudScope = tag('Oracle Acceleron cloud network', [
  'Oracle announced new RDMA and SmartNIC capabilities for OCI cloud networking.'
], ['datacom', 'automotive']);
assert.deepEqual(cloudScope.articleDomains, ['datacom']);
const futureRelease = tag('Dell PowerStore software release', [
  'Dell announced the next PowerStore software release for cloud servers, due in November, with new encryption.'
]);
assert.equal(futureRelease.mainEvent?.stage, 'planned');
const modelUse = tag('Valeo 48V eAxle for Dacia', [
  'Valeo announces the commercial launch of its 48V 2-Speed eAxle for automotive applications.',
  'The 48V 2-Speed eAxle has been selected by Dacia for its powertrain launched on Duster and Bigster, with Striker coming later.'
]);
assert.equal(modelUse.mainEvent?.stage, 'initial_use');
assert.match(modelUse.mainEvent?.stageEvidence || '', /Duster and Bigster/u);
const consumer = tag('New iPhone speaker', ['Apple introduced a new smartphone speaker module.'], ['datacom', 'automotive']);
assert.equal(consumer.mainEvent, null);

const separateActors = tag('Meta rack deployment', [
  'Meta deployed a new AI server rack at its training site.',
  'CoreWeave deployed a different AI rack at its own site.'
]);
assert.equal(separateActors.mainEvent?.actor, 'Meta');
assert.ok(separateActors.facts.some(fact => fact.actor === 'CoreWeave'));
assert.ok(separateActors.displayEvents.length <= 2);
assert.deepEqual(Object.values(TAGGING_TAXONOMY.events), ['新技术', '新产品', '商业合作', '订单与定点', '投资与产能', '经营变化', '政策与风险']);
console.log('Unified tagging evidence, scope, stage and review cases passed');
