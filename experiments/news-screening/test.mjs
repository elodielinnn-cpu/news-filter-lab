import assert from 'node:assert/strict';
import { loadBusinessProfile } from '../news-filter-v3/business-profile.mjs';
import { screen } from './screen.mjs';
import { clean, extractBody } from './extract.mjs';

const profile = await loadBusinessProfile(new URL('../../config/luxshare-business-profile.json', import.meta.url));
const article = { sourceId: 'test', title: 'Server hardware update', summary: '', bodyStatus: 'ok', bodyEvidence: [] };
const cases = [
  ['different GPU models cannot share an impact', { bodyEvidence: ['The H100 GPU architecture was upgraded.', 'The B200 GPU requires a redesigned cold plate.'] }, '待定'],
  ['hypothetical direct change remains pending', { bodyEvidence: ['The server cold plate could adopt a new channel design.'] }, '待定'],
  ['consumer computer removed from mixed source', { title: 'Dell XPS 16 Creator Edition Review', sourceDomain: 'datacom', bodyEvidence: ['The cooling design was upgraded.'] }, '排除'],
  ['consumer mixed with server topic is removed', { title: 'Gaming laptop uses server technology', bodyEvidence: ['The server power supply was upgraded.'] }, '排除'],
  ['software installation is not commercial hardware deployment', { title: 'Ollama Hands-On: Running Local LLMs on Windows', sourceDomain: 'datacom', bodyEvidence: ['We installed Ollama on a rack-scale system.'] }, '排除'],
  ['company reference cannot borrow old rack context', { bodyEvidence: ['The rack is part of an existing system. The companies are collaborating on a new CPU architecture.'] }, '待定'],
  ['deployed system', { bodyEvidence: ['The operator has deployed a new rack-scale system.'] }, '入选', 'direct'],
  ['multi-sentence automotive agreement', { title: 'Automotive computing agreement', bodyEvidence: ['The companies signed a technology agreement for the ADAS chip. The collaboration combines safety management and connectivity. The companies will develop central vehicle computers.'] }, '入选', 'direct'],
  ['navigation text cannot qualify a story', { bodyEvidence: ['Previous post: The operator deployed a rack-scale system.'] }, '排除'],
  ['RSS excerpt supports concrete impact', { bodyStatus: 'rss_evidence', bodyEvidence: ['The GPU architecture was upgraded.', 'The GPU requires a redesigned cold plate.'] }, '入选', 'explicit_indirect'],
  ['RSS excerpt without product impact remains pending', { bodyStatus: 'rss_evidence', bodyEvidence: ['The GPU architecture was upgraded.'] }, '待定'],
  ['consumer source removed', { title: 'Apple replaces smartphone speaker supplier', bodyEvidence: ['Apple selected a new supplier for its acoustic module.'] }, '排除'],
  ['consumer story cannot use incidental server paragraph', { title: 'MacBook OLED display redesigned', bodyEvidence: ['The display design was upgraded.', 'AI servers use optical modules.'] }, '排除'],
  ['direct server component update', { bodyEvidence: ['The manufacturer redesigned the cold plate to improve cooling performance.'] }, '入选', 'direct'],
  ['supplier change', { bodyEvidence: ['The server manufacturer selected a new supplier for the cold plate.'] }, '入选', 'direct'],
  ['PPT product expansion', { bodyEvidence: ['The manufacturer expanded production capacity for the liquid manifold.'] }, '入选', 'direct'],
  ['automotive direct update', { title: 'Vehicle braking hardware update', bodyEvidence: ['The automaker adopted a new brake-by-wire architecture.'] }, '入选', 'direct'],
  ['automotive supplier change', { title: 'Automotive harness supplier changes', bodyEvidence: ['The automaker replaced its supplier of automotive wire harnesses.'] }, '入选', 'direct'],
  ['automotive firmware plus actual hardware update', { title: 'Vehicle gateway update', bodyEvidence: ['The vehicle central gateway hardware was redesigned to support redundant connections.'] }, '入选', 'direct'],
  ['upstream change with explicit impact across paragraphs', { bodyEvidence: ['The GPU architecture was upgraded.', 'The higher GPU power draw requires redesigned cold plates in the server.'] }, '入选', 'explicit_indirect'],
  ['adjacent impact pronoun', { bodyEvidence: ['The GPU architecture was upgraded. This requires a new cold plate design.'] }, '入选', 'explicit_indirect'],
  ['upstream without impact', { bodyEvidence: ['The GPU architecture was upgraded.', 'The server also contains a cold plate.'] }, '待定'],
  ['speculative impact', { bodyEvidence: ['The GPU architecture was upgraded.', 'The GPU could require a redesigned cold plate.'] }, '待定'],
  ['rumor', { title: 'Server cold plate reportedly redesigned', bodyEvidence: ['The cold plate design was upgraded.'] }, '待定'],
  ['unrelated changed object', { bodyEvidence: ['The GPU architecture was upgraded and the server contains a cold plate.'] }, '待定'],
  ['same paragraph direct pronoun', { bodyEvidence: ['The server uses a cold plate. It adopts a new channel design.'] }, '入选', 'direct'],
  ['general configuration', { bodyEvidence: ['The server has a cold plate and a power supply.'] }, '排除'],
  ['no confirmed supplier change', { bodyEvidence: ['The server manufacturer has not replaced its supplier of cold plates.'] }, '排除'],
  ['summary cannot replace body', { summary: 'The server manufacturer replaced its cold plate supplier.', bodyEvidence: ['The server includes a cold plate.'] }, '待定'],
  ['request failure', { bodyStatus: 'fetch_failed' }, '待定'],
  ['old coverage', { bodyEvidence: ['As we saw in our coverage from OCP 2025, optical engines replace long copper traces.'] }, '排除'],
  ['company financials alone', { bodyEvidence: ['Revenue increased 30 percent this year.'] }, '排除'],
  ['car retail pricing', { title: 'New electric SUV discount', bodyEvidence: ['The electric vehicle price dropped by 500 dollars.'] }, '排除'],
  ['terminal volume alone', { title: 'Electric vehicle sales update', bodyEvidence: ['Electric vehicle sales increased 20 percent.'] }, '排除'],
  ['automotive upstream explicit effect', { title: 'Vehicle ADAS architecture upgrade', bodyEvidence: ['The ADAS chip architecture was upgraded.', 'The ADAS chip requires a redesigned automotive connector.'] }, '入选', 'explicit_indirect'],
  ['mobile network direct connector change', { title: '5G network server connector upgrade', bodyEvidence: ['The manufacturer redesigned the high-speed connector to reduce signal loss.'] }, '入选', 'direct'],
  ['upstream change does not borrow another component impact', { bodyEvidence: ['The GPU architecture was upgraded.', 'The CPU requires a new server power supply.'] }, '待定'],
  ['announced rack partnership and planned delivery are linked', { title: 'AI infrastructure partnership', bodyEvidence: ['The operator has added a hardware company to its partner network. The two will deliver dedicated clusters built from rack-scale systems.'] }, '入选', 'direct'],
  ['agreement paragraph explicitly identifies the power product', { title: 'Critical power partnership', bodyEvidence: ['The company announced a strategic agreement with a semiconductor supplier.', 'The strategic agreement supports reliable deliveries. The components will be integrated into its 800 VDC power systems for data centers.'] }, '入选', 'direct'],
  ['data center capacity online without product evidence needs review', { title: 'Data center capacity online', bodyEvidence: ['The operator has brought most of its planned 22MW IT capacity online at the DEN01 data center.'] }, '待定'],
  ['announced automotive camera collaboration maps to sensing hardware', { title: 'Automotive camera collaboration', bodyEvidence: ['Valeo and QNX announced a strategic collaboration to integrate safety software into a new front-view camera platform.'] }, '入选', 'direct']
];
for (const [name, input, expected, relationship] of cases) {
  const result = screen({ ...article, ...input }, profile);
  assert.equal(result.result, expected, name);
  if (relationship) assert.equal(result.relationship, relationship, name);
  if (result.result === '入选') {
    assert.equal(result.eventGate, 'passed', name);
    assert.equal(result.businessGate, 'passed', name);
    assert.ok(result.eventEvidence && result.businessEvidence && result.affectedProducts.length, name);
    assert.ok(result.affectedProducts.every(product => product.scopeEvidence), name);
    if (result.relationship === 'explicit_indirect') assert.ok(result.impactEvidence, name);
  }
}
console.log(`${cases.length} two-domain direct/indirect screening cases passed`);

const paragraph = 'The server platform adopts new liquid cooling hardware and changes rack power requirements. '.repeat(4);
const wordpress = `<main><div class="container med post-content"><div><p>${paragraph}</p></div><p>Short but useful technical evidence.</p></div><aside><article><p>Sidebar recommendation.</p></article></aside></main>`;
const wordpressResult = extractBody(wordpress);
assert.equal(wordpressResult.bodyStatus, 'ok');
assert.equal(wordpressResult.bodySelector, '.post-content');
assert.equal(wordpressResult.bodyEvidence.length, 2);
assert.ok(!wordpressResult.bodyEvidence.join(' ').includes('Sidebar'));
const chinese = extractBody(`<div id='paragraph' class='post_content'><div><p>${'服务器采用液冷方案，调整机柜供电要求。'.repeat(20)}</p></div></div>`);
assert.equal(chinese.bodyStatus, 'ok');
assert.equal(chinese.bodySelector, '#paragraph');
assert.equal(extractBody(`<article><p>${paragraph}</p></article>`).bodyStatus, 'ok');
assert.equal(extractBody('<title>Just a moment</title><div class="cf-chl-test">Verify</div>').bodyStatus, 'blocked');
assert.equal(extractBody('<main><p>Short article.</p></main>').bodyStatus, 'insufficient');
assert.equal(clean('&lt;p&gt;正文 &amp; 原句&lt;/p&gt;'), '正文 & 原句');
console.log('10 extraction regression assertions passed');

const entry = extractBody(`<main><div class="entry-content"><p>${paragraph}</p><p>Previous post: A redesigned server power supply is available.</p></div><aside><p>${'Unrelated footer text. '.repeat(20)}</p></aside></main>`);
assert.equal(entry.bodySelector, '.entry-content');
assert.equal(entry.bodyEvidence.length, 1);
assert.ok(!entry.bodyEvidence[0].includes('Unrelated'));
console.log('3 article-container regression assertions passed');
