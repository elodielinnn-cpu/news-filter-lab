// Shared contract. The news-filter-lab copy must remain byte-identical because the
// website and the cloud screening experiment are separate repositories.
export const TAGGING_VERSION = 'unified-v1';
export const TAGGING_TAXONOMY = Object.freeze({
  domains: { datacom: '通信与数据中心', automotive: '汽车电子', consumer: '消费电子' },
  events: { technology: '新技术', product: '新产品', partnership: '商业合作', order: '订单与定点', investment: '投资与产能', operations: '经营变化', risk: '政策与风险' },
  stages: { published: '已发布', validation: '试验验证', initial_use: '初步应用', scale_use: '规模应用', planned: '计划中', unknown: '未明确', not_applicable: '不适用' },
  availability: { unknown: '未说明', preorder: '预订', orderable: '可购买/可订阅' }
});

const domainRules = {
  datacom: /\b(?:data cent(?:er|re)s?|datacenters?|servers?|racks?|rack[- ]?scale|ai infrastructure|ai factory|ai clusters?|inference systems?|hpc|supercomput|telecom|optical interconnect|cpo|liquid cooling|cold plate|network fabric|ethernet|infiniband|rdma|smartnic|nvme|interconnect)\b|数据中心|服务器|机柜|算力|超算|通信基础设施|光互连|光模块|液冷|冷板/iu,
  automotive: /\b(?:automotive|vehicle|automotive oem|radar|adas|e-axle|electric mobility|car maker|autonomous driving|steering|braking)\b|汽车电子|车载|车型|车企|雷达|智驾|座舱|线束|电驱/iu,
  consumer: /\b(?:iphone|ipad|smartphone|consumer electronics|laptop|earbuds|wearable|macbook)\b|消费电子|手机|平板|笔记本|耳机|可穿戴/iu
};
const mention = /\b(?:announc(?:ed|es)|introduc(?:ed|es)|unveil(?:ed|s)|launch(?:ed|es)|releas(?:ed|es)|present(?:ed|s)|publish(?:ed|es))\b|宣布|发布|推出|亮相|公布/iu;
const patterns = {
  order: /\b(?:(?:signed|secured|booked|awarded|won|received) .{0,75}\b(?:contract|order|supply agreement)|selected by .{0,80}\b(?:customer|oem|automaker|manufacturer)|nominated by|purchase order|supply contract|design win|procurement framework|contract for|(?:announc(?:ed|es)|signed) an? agreement to (?:launch|supply|deliver)|through this contract)\b|签署合同|获得订单|客户定点|获选供应商|采购协议|中标/iu,
  partnership: /\b(?:partner(?:ship|ed)? with|announc(?:ed|es) a partnership|collaborat(?:ion|e|ed|ing) (?:with|on)|signed a technology agreement|joint(?:ly)? develop|co-develop|joint agreement|joint program|work(?:ing)? together to|will build and sell|team(?:s|ed)? up with)\b|达成合作|联合开发|合作协议|联合交付/iu,
  investment: /\b(?:invest(?:ed|ment|ing)|acquir(?:e|ed|es|ing)|propos(?:ed|es) acquir(?:ing|e)|to buy .{0,80}(?:company|firm)|merger|capacity expansion|expand(?:ed|s) capacity|new factory|broke ground|manufacturing transfer|buildout)\b|投资|融资|并购|收购|扩产|迁产|新工厂|开工/iu,
  operations: /\b(?:earnings|revenue|profit|shipment|demand|price|cost|market share|sales|backlog|restructur|business exit)\b.{0,100}\b(?:rose|fell|grew|declined|increased|decreased|reached|reported|forecast|expect|change|shift|record)\b|\b(?:reported|posted)\b.{0,100}\b(?:earnings|revenue|profit|shipments?|sales)\b|营收|利润|出货|需求|价格|成本|份额|重组|业务退出/iu,
  risk: /\b(?:export controls?|sanctions?|tariffs?|new regulation|new policy|shortage|supply disruption|initiated a recall|issued a recall|suffered a breach|cyberattack|major outage)\b|出口管制|关税|新规|短缺|供应中断|发起召回|数据泄露|遭到攻击/iu,
  product: /\b(?:announc(?:ed|es)|introduc(?:e[ds]?|ing)|unveil(?:ed|s)|launch(?:ed|es)|releas(?:e[ds]?|ing)|present(?:ed|s))\b.{0,150}\b(?:products?|platforms?|systems?|racks?|servers?|modules?|solutions?|services?|designs?|cpus?|gpus?|radars?|eaxle|technology|thinksystem|smartit|storage arrays?|software releases?|capabilities)\b|\bcommercial launch of\b.{0,100}|\bnew\b.{0,75}\b(?:reference design|platform|server|rack|system|product)\b|发布.{0,35}(?:产品|平台|方案|系统|机柜|服务器|模组|雷达)|推出.{0,35}(?:产品|平台|方案|系统|机柜|服务器|模组|雷达)/iu,
  technology: /\b(?:new (?:technology|architecture|process|material|standard|design)|improv(?:ed|es) .{0,80}(?:performance|efficiency|yield)|validat(?:e[ds]?|ing) .{0,100}(?:memory|stack|technology|durability|performance|architecture|design|heat exchanger|cooling|thermal)|completed .{0,50}\bvalidation\b|validated that .{0,80}\btechnology\b|tested .{0,80}(?:durability|performance|architecture)|updat(?:ed|es) .{0,100}(?:specs?|specifications?|architecture|design)|revis(?:ed|es) .{0,100}(?:specs?|specifications?|architecture|design)|breakthrough|reference architecture|(?:airflow|cooling|power|bandwidth|latency|layout).{0,110}(?:needed to|allows?|enables?|reduces?|improves?|increases?))\b|新技术|新架构|新工艺|新材料|技术突破|性能验证|耐久验证|参考架构/iu
};
const planned = /\b(?:plans? to|expected to|scheduled to|aims? to|intends? to|proposed|proposal|will (?:launch|deliver|begin|build|deploy|test|validate|present))\b|计划|预计|将于|拟于|目标是|有望/iu;
const testing = /\b(?:under test|(?:initial |completed |recent )?validation (?:of|status|results?)|completed (?:the )?(?:initial )?validation|(?:has (?:now )?)?validated|pilot|prototype|trial|installed for testing|proof of concept|tests? (?:showed|confirmed|found))\b|测试中|完成验证|验证结果|试验|试点|样机|送样|原型/iu;
const initialUse = /\b(?:deployed (?:a |the )?.{0,65}\bat|deployed at|in use at|running at (?=[A-Z])|installed at|began delivering|started shipping|entered service|customer deployment)\b|已部署于|投入使用|已安装于|开始交付|投入运行/iu;
const scaleUse = /\b(?:mass production|volume production|at scale|large.scale deployment|batch delivery|ramping production|mass deployment)\b|量产|批量交付|规模部署|规模应用|大规模生产/iu;
const available = /\b(?:orderable|available now|generally available|commercially available|available to order)\b|现已可订|已可购买|正式商用/iu;
const preorder = /\b(?:preorder|pre-order|reservation)\b|预订|预约/iu;
const futureTest = /\b(?:will|plans? to|expected to)\b.{0,65}\b(?:test|validate|pilot|deploy|produce|ship)\b|计划.{0,30}(?:测试|验证|试点|部署|生产|交付)/iu;
const rumor = /\b(?:rumou?red|unconfirmed|leak(?:ed)?|anonymous sources?)\b|传闻|爆料|未经确认|匿名消息/iu;
const negated = /\b(?:no|not|without|has not|hasn't)\b.{0,45}\b(?:order|deal|deployment|production|customer|contract)\b|未获.{0,20}(?:订单|合同)|尚未.{0,20}(?:部署|量产)/iu;
const background = /\b(?:previously|last year|historically|in prior years|as we reported)\b|此前|去年|历史上|过去曾/iu;
const noise = /\b(?:cookie policy|newsletter|let us know in the comments|related articles|privacy notice)\b|评论区|相关阅读|隐私政策/iu;
const reviewTitle = /\b(?:review|benchmark|first look|hands.on)\b|评测|跑分|上手/iu;
const engineeringConclusion = /\b(?:bandwidth|memory|power|cooling|thermal|density|rack|slots?|socket|interconnect|airflow|air-cooled|pcie|card|compatib(?:le|ility)|replaceable|serviceab(?:le|ility))\b.{0,130}\b(?:measured|allows?|enables?|limits?|requires?|reduces?|improves?|increases?|fits?|supports?|shares?|changes?|deploy|budget|headroom|compared|versus|vs\.?|\d+(?:\.\d+)?\s*(?:%|x|w|kw|gb\/s|tb\/s))\b|\b(?:measured|allows?|enables?|limits?|requires?|reduces?|improves?|increases?|fits?|supports?)\b.{0,130}\b(?:bandwidth|memory|power|cooling|thermal|density|rack|slots?|socket|interconnect|airflow|air-cooled|pcie|card|compatib(?:le|ility)|replaceable)\b/iu;
const reviewMethodOnly = /^(?:our test data comes from|to understand|we started with|we begin with|this review focuses on|the comparison that matters|the .* comparison runs the other way)|\b(?:ran in the .{0,120}from our review|figures come from|test setup|test platform)\b/iu;

const normalize = value => String(value || '').replace(/\s+/gu, ' ').trim();
const splitSentences = value => normalize(value).split(/(?<=[。！？.!?])\s+(?=[\p{Lu}\p{Script=Han}“"'])|(?<=[。！？；])|, and (?=[^,]{0,110}\b(?:are|is|has|have)\b)/u).map(normalize).filter(Boolean);
const tokens = value => new Set((String(value).toLowerCase().match(/[a-z][a-z0-9-]{2,}|[\p{Script=Han}]{2,}/gu) || []).filter(word => !['with','from','that','this','and','the','for','are','has','will','new','its'].includes(word)));
const overlap = (left, right) => [...tokens(left)].filter(word => tokens(right).has(word)).length;

export function classifyStage(text, type) {
  if (type === 'order' || type === 'operations' || type === 'risk' || type === 'investment' || type === 'partnership') return 'not_applicable';
  if (futureTest.test(text) && !/\b(?:has|have|already|now|completed|began|started)\b|已|完成|正在/iu.test(text)) return 'planned';
  if (testing.test(text) && !futureTest.test(text)) return 'validation';
  // A media benchmark is evidence about a product, not its development stage.
  if (planned.test(text) && scaleUse.test(text) && !/\b(?:has|have|already|now|completed|began|started)\b|已|完成|正在/iu.test(text)) return 'planned';
  if (scaleUse.test(text)) return 'scale_use';
  if (initialUse.test(text)) return 'initial_use';
  if (planned.test(text) || /\b(?:due in|coming in|scheduled for|available in)\b.{0,35}\b(?:20\d\d|january|february|march|april|may|june|july|august|september|october|november|december)\b/iu.test(text)) return 'planned';
  if (mention.test(text) || /\b(?:introducing|expanded|expands)\b/iu.test(text) || available.test(text) || /\bnew\b.{0,80}\breference design\b/iu.test(text)) return 'published';
  return 'unknown';
}

function classifyEvent(sentence, title) {
  if (noise.test(sentence) || negated.test(sentence) || rumor.test(sentence) || /\bno shortage\b|future product disclaimer|no availability dates/iu.test(sentence)) return '';
  if (patterns.order.test(sentence)) return 'order';
  if (scaleUse.test(sentence) && /\b(?:racks?|servers?|systems?|modules?|products?|radars?|platforms?|drives?|ssds?)\b|机柜|服务器|模组|产品|雷达|系统/iu.test(sentence)
    && !/\b(?:factory|plant|facility|capacity)\b|工厂|产线|产能/iu.test(sentence)) return 'product';
  if (patterns.investment.test(sentence)) return 'investment';
  if (patterns.risk.test(sentence)) return 'risk';
  if (patterns.partnership.test(sentence)) return 'partnership';
  if (patterns.operations.test(sentence)) return 'operations';
  if (available.test(sentence) && /\b(?:racks?|systems?|cpus?|gpus?|platforms?|services?|servers?)\b|机柜|服务器|平台|服务/iu.test(sentence)) return 'product';
  if (/\b(?:expanded|expands|announced updates to|introducing)\b/iu.test(sentence) && /\b(?:racks?|systems?|platforms?|servers?|products?|solutions?)\b|机柜|服务器|平台|产品/iu.test(sentence)) return 'product';
  if (patterns.product.test(sentence) && !(reviewTitle.test(title) && !mention.test(sentence))) return 'product';
  if (reviewTitle.test(title) && (engineeringConclusion.test(sentence)
    || /\bmeasured\b.{0,100}\b(?:performance|throughput|bandwidth|power efficiency)\b/iu.test(sentence))
    && !reviewMethodOnly.test(sentence)) return 'technology';
  if ((initialUse.test(sentence) || testing.test(sentence) || /\b(?:adopt(?:ed|s)|began using|put into service)\b|已采用|投入使用/iu.test(sentence))
    && /\b(?:racks?|rackscale|servers?|systems?|radar|cooling|architecture|platform|mirror|sensor|memory)\b|机柜|服务器|雷达|液冷|系统|传感器/iu.test(sentence)) return 'technology';
  if (patterns.technology.test(sentence)) return 'technology';
  return '';
}

function findActor(sentence, title) {
  const joint = sentence.match(/^([\p{Lu}][\p{L}\p{N}.-]+) and (?:the (?:open science |research )?lab )?([\p{Lu}][\p{L}\p{N}:.-]+)(?=\s+(?:will|have|has|announce|launched|jointly))/u);
  if (joint) return `${joint[1]} and ${joint[2]}`;
  const topicActor = String(title).match(/^([\p{Lu}][\p{L}\p{N}.-]+)\s+(?:CPU|GPU|EPYC|Instinct|Vera)\b/u)?.[1];
  if (topicActor && /^(?:each|the|this|its)\b/iu.test(sentence)) return topicActor;
  const titleLead = String(title).match(/^[\p{Lu}][\p{L}\p{N}.-]*(?:\s+[\p{Lu}][\p{L}\p{N}.-]*)?/u)?.[0] || '';
  const beforeAction = normalize(sentence.split(/\b(?:announced|introduced|unveiled|launched|signed|secured|selected|validated|plans|has|have|will|is|reported|says|confirms|deployed|started|expanded|introducing|provides|highlights)\b|宣布|发布|推出|签署|获得|完成验证/u)[0]);
  const lead = titleLead.split(' ')[0];
  if (lead && new RegExp(`\\b${lead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(beforeAction)) {
    const match = beforeAction.match(new RegExp(`\\b${lead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+(?:and|&|×)\\s+[\\p{Lu}][\\p{L}\\p{N}.-]+|\\s+[\\p{Lu}][\\p{L}\\p{N}.-]+)?`, 'u'));
    if (match) return match[0];
  }
  if (/^[\p{Lu}][\p{L}\p{N}.-]+\b/u.test(beforeAction) && beforeAction.length <= 45
    && !reviewTitle.test(title) && !/^(?:the|this|it|its|they|their)\b/iu.test(beforeAction)) return beforeAction;
  const titleNames = String(title).match(/\b(?:[A-Z][a-z]{2,}|[A-Z]{3,})\b/gu) || [];
  const firstTitleName = titleNames.find(name => !/^(?:GPU|CPU|NVL|AI|HPC|SSD|The|New|Review)$/u.test(name));
  if (firstTitleName && new RegExp(`\\b${firstTitleName}\\b`, 'u').test(sentence)) return firstTitleName;
  return '未明确';
}

export function eventEvidenceWindow(article, main) {
  if (!main || !Array.isArray(article.bodyEvidence)) return main?.evidence || '';
  const current = article.bodyEvidence[main.paragraphId - 1] || main.evidence;
  const next = article.bodyEvidence[main.paragraphId];
  const identifiers = [...String(main.evidence).matchAll(/\b(?:[A-Z]{2,}\s+[A-Z]{2,}|[A-Z]+[0-9][A-Z0-9-]*)\b/gu)].map(match => match[0]);
  return next && identifiers.some(identifier => next.includes(identifier)) ? `${current}\n${next}` : current;
}

function findObject(sentence, title, actor) {
  if (/^(?:all of that|these (?:validation |test )?results)\b/iu.test(sentence)) {
    return normalize(title.replace(/\b(?:Review|First Look):.*$/iu, ''));
  }
  if (actor.includes(' and ')) {
    const jointObject = sentence.match(/\b(?:will|have|has)\s+(?:jointly\s+)?(?:develop|build|sell|launch|release|announce)\s+(.+)/iu)?.[1];
    if (jointObject) return normalize(jointObject).replace(/^and\s+(?:(?:openly|jointly)\s+)?(?:sell|release|develop|build)\s+/iu, '').slice(0, 180);
  }
  const withoutActor = normalize(sentence.replace(new RegExp(actor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu'), ''));
  const afterAction = withoutActor.split(/\b(?:announced|announces|introduced|introduces|unveiled|unveils|launched|launches|signed|secured|selected|validated|plans to|has developed|has deployed|is running|presents)\b|发布|推出|签署|获得|完成验证/u).at(-1);
  return normalize(afterAction || title).replace(/^(?:and\s+)?(?:will|has|have|is|are)\s+/iu, '').slice(0, 180) || normalize(title);
}

export function tagArticle(article, { scope = ['datacom', 'automotive', 'consumer'] } = {}) {
  const title = normalize(article.title);
  const paragraphs = Array.isArray(article.bodyEvidence) && article.bodyEvidence.length
    ? article.bodyEvidence.map(normalize).filter(Boolean) : [normalize(article.summary)].filter(Boolean);
  const industryContext = `${title} ${paragraphs.slice(0, 2).join(' ')}`;
  const articleDomains = Object.entries(domainRules).filter(([id, rule]) => scope.includes(id) && rule.test(industryContext)).map(([id]) => id);
  const facts = [];
  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    const sentences = splitSentences(paragraph);
    for (const [sentenceIndex, sentence] of sentences.entries()) {
      let type = classifyEvent(sentence, title);
      const priorProduct = facts.findLast(fact => fact.paragraphId === paragraphIndex + 1 && fact.eventType === 'product');
      const refersToPriorProduct = priorProduct && /\b(?:it|the (?:product|drive|system)|this (?:product|drive|system))\b|该产品|该系统/iu.test(sentence);
      if (!type && scaleUse.test(sentence) && refersToPriorProduct) type = 'product';
      if (!type) continue;
      let actor = refersToPriorProduct && type === 'product' ? priorProduct.actor : findActor(sentence, title);
      const object = refersToPriorProduct && type === 'product' ? priorProduct.object : findObject(sentence, title, actor);
      const context = `${title} ${sentence}`;
      let domains = Object.entries(domainRules).filter(([id, rule]) => scope.includes(id) && rule.test(context)).map(([id]) => id);
      if (!domains.length) domains = Object.entries(domainRules)
        .filter(([id, rule]) => scope.includes(id) && rule.test(`${title} ${paragraphs[0] || ''}`)).map(([id]) => id);
      if (!domains.length) domains = articleDomains.filter(id => domainRules[id].test(paragraphs[paragraphIndex] || '') || paragraphIndex < 2);
      // A generic company background must not add another industry to this event.
      if (domains.length > 2) domains = domains.filter(id => domainRules[id].test(sentence)).slice(0, 2);
      if (!domains.length && domainRules.datacom.test(title) && scope.includes('datacom')) domains = ['datacom'];
      const stage = classifyStage(sentence, type);
      const availability = available.test(sentence) ? 'orderable' : preorder.test(sentence) ? 'preorder' : 'unknown';
      const titleFit = overlap(sentence, title);
      const evidence = /^(?:all of that|these (?:validation |test )?results)\b/iu.test(sentence) && sentenceIndex > 0
        ? `${sentences.slice(Math.max(0, sentenceIndex - 2), sentenceIndex).join(' ')} ${sentence}`
        : /^it brings\b/iu.test(sentence) && sentenceIndex > 0 ? `${sentences[sentenceIndex - 1]} ${sentence}` : sentence;
      const titleCompany = title.match(/^[\p{Lu}][\p{L}\p{N}.-]+/u)?.[0];
      if (actor === '未明确' && titleCompany && new RegExp(`\\b${titleCompany}\\b`, 'u').test(evidence)) actor = titleCompany;
      const record = { id: `p${paragraphIndex + 1}s${sentenceIndex + 1}`, actor, object, action: sentence,
        eventType: type, stage, availability, domains, evidence, paragraphId: paragraphIndex + 1,
        eventTime: null, publishedAt: article.publishedAt || null, titleFit,
        sourceStatus: rumor.test(sentence) ? 'rumor' : 'attributed', role: titleFit > 0 ? 'primary_candidate' : 'related_candidate' };
      facts.push(record);
    }
  }
  // Preserve internal facts; presentation is capped separately.
  const reviewScore = fact => reviewTitle.test(title) && fact.eventType === 'technology'
    ? (engineeringConclusion.test(fact.evidence) ? 5 : 0) + (/\b(?:server|rack|socket|memory|cooling|power budget|bandwidth|airflow|air-cooled)\b/iu.test(fact.evidence) ? 2 : 0)
      + (/\b(?:because|so that|which means|giving customers|needed to|versus|compared with|validation results)\b/iu.test(fact.evidence) ? 3 : 0)
      + (/\b(?:airflow|cooling)\b.{0,75}\b(?:needed|requires?|enables?|allows?)\b/iu.test(fact.evidence) ? 8 : 0)
      + (fact.paragraphId === 1 ? 10 : 0)
      - (reviewMethodOnly.test(fact.evidence) || /full analysis is in|comparison runs the other way/iu.test(fact.evidence) ? 20 : 0) : 0;
  const evidenceScore = fact => fact.eventType === 'technology' && fact.stage === 'validation'
    && /\b(?:validation results|testing .* reached|tested .* months|\d+(?:\.\d+)?\s*(?:%|years?))\b/iu.test(fact.evidence) ? 10 : 0;
  const reviewIdentifier = reviewTitle.test(title) ? title.match(/\b[A-Z]+[A-Z0-9-]*\d[A-Z0-9-]*\b/u)?.[0] : null;
  const subjectScore = fact => reviewIdentifier && fact.evidence.slice(0, 100).includes(reviewIdentifier) ? 12 : 0;
  const ranked = facts.filter(fact => fact.domains.length && !(reviewTitle.test(title) && reviewMethodOnly.test(fact.evidence))).sort((a, b) =>
    b.titleFit + reviewScore(b) + evidenceScore(b) + subjectScore(b)
      - a.titleFit - reviewScore(a) - evidenceScore(a) - subjectScore(a)
      || a.paragraphId - b.paragraphId || a.id.localeCompare(b.id));
  const shown = [];
  for (const fact of ranked) {
    if (shown.some(previous => previous.eventType === fact.eventType && overlap(previous.object, fact.object) >= 2)) continue;
    shown.push(fact);
    if (shown.length === 2) break;
  }
  const main = shown[0] || null;
  if (main?.eventType === 'product' && main.stage === 'published') {
    const laterStage = facts.find(fact => fact.paragraphId === main.paragraphId && fact.eventType === 'product'
      && fact.stage === 'scale_use' && fact.id !== main.id && fact.actor === main.actor
      && /\b(?:it|the (?:product|drive|system)|this (?:product|drive|system))\b|该产品|该系统/iu.test(fact.evidence));
    if (laterStage) {
      main.stage = 'scale_use';
      main.stageEvidence = paragraphs[laterStage.paragraphId - 1];
    }
  }
  if (main?.eventType === 'product' && main.stage === 'published') {
    const productName = main.evidence.match(/\b(?:[A-Z]?\d+[A-Z]?V\s+)?\d+-Speed\s+eAxle\b|\b[A-Z][A-Z0-9-]*\d[A-Z0-9-]*\b/u)?.[0];
    const adoption = productName && paragraphs.slice(main.paragraphId, main.paragraphId + 2).find(paragraph =>
      paragraph.includes(productName) && /\b(?:selected by|adopted by|used in|launched on)\b/iu.test(paragraph)
      && /\b(?:launched on|now in|already in|in production)\b/iu.test(paragraph));
    if (adoption) {
      main.stage = 'initial_use';
      main.stageEvidence = adoption;
    }
  }
  return { version: TAGGING_VERSION, scope: [...scope], articleDomains, facts, mainEvent: main, displayEvents: shown,
    displayTags: main ? [...main.domains.map(id => TAGGING_TAXONOMY.domains[id]), TAGGING_TAXONOMY.events[main.eventType],
      ...(['unknown', 'not_applicable'].includes(main.stage) ? [] : [TAGGING_TAXONOMY.stages[main.stage]])] : [],
    unclassifiedReason: !facts.length ? 'no_supported_change_in_supplied_text' : !ranked.length ? 'no_in_scope_event' : '' };
}
