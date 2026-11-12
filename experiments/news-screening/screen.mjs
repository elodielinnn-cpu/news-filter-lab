import { containsAlias } from '../news-filter-v3/business-profile.mjs';
import { eventRules, hardwareDetails, impactRelation, nonIndustryTitle, softwareOnly, speculativeImpact } from './rules.mjs';
import { articleDomains, domainNames, matchProducts, productMention, scopeVersion } from './scope.mjs';
import { tagArticle } from '../unified-tagging.mjs';

const rumor = /\b(?:rumou?rs?|leakers?|reportedly|unconfirmed|according to people|sources? said)\b|传闻|爆料|据称|知情人士/iu;
const negation = /\b(?:no|not|never|without)\b.{0,35}\b(?:new|chang\w*|replac\w*|adopt\w*|supplier|orders?|agreement)\b|没有.{0,15}(?:变化|更换|新增|订单)|并未|尚未确认/iu;
const background = /investor relations|corporate governance|annual meeting of shareholders|all rights reserved|previous post|next post|related articles|as we saw|previously covered|in our .{0,60}coverage from/iu;
const objectReference = /^(?:it|its|these|this|that|they|their|the (?:new )?(?:module|component|design|system))\b|^(?:该|这些|其|这一)/iu;
const reference = /^(?:it|its|these|this|that|they|their|the (?:new |strategic )?(?:module|component|design|system|companies|collaboration|agreement|platform|two))\b|^(?:该|这些|其|这一)/iu;

function sentences(paragraphs) {
  return paragraphs.flatMap((paragraph, paragraphIndex) => String(paragraph)
    .split(/(?<=[。！？])|(?<=[.!?])\s+(?=[A-Z“"'])|(?<=[.!?][”"'])\s+(?=[A-Z“"'])|;\s*|,?\s+(?:while|whereas|but)\s+|\s+and\s+(?=(?:the|a|an|it|its|this|these)\b)/u)
    .map(text => ({ text: text.trim(), paragraphIndex })).filter(item => item.text));
}

export function extractChanges(paragraphs) {
  return sentences(paragraphs).flatMap((sentence, index) => {
    if (background.test(sentence.text) || negation.test(sentence.text) || softwareOnly.test(sentence.text)) return [];
    return eventRules.flatMap(rule => {
      const match = sentence.text.match(rule.pattern);
      if (!match || rule.type === '技术与制造变化' && !hardwareDetails.test(sentence.text)) return [];
      return [{ type: rule.type, change: match[0], evidence: sentence.text, sentenceIndex: index, paragraphIndex: sentence.paragraphIndex }];
    });
  });
}

function objectIdentifiers(text) {
  return [...new Set(text.match(/\b(?:Rubin|Blackwell|Helios|Snapdragon Ride|[A-Z]{1,4}-?\d{2,4}[A-Z]?)\b/giu) || [])];
}

function directProducts(products) {
  return products.filter(product => product.relationshipLevel === 'direct');
}

function upstreamProducts(products) {
  return products.filter(product => ['upstream', 'adjacent', 'unconfirmed'].includes(product.relationshipLevel));
}

function withEvidence(base, change, products, businessEvidence, relationship, impactEvidence = '') {
  return {
    ...base, event: change.type, eventEvidence: change.evidence, evidence: change.evidence,
    affectedObject: products.map(product => product.productName).join('、'),
    businessEvidence, relationship, impactEvidence,
    affectedProducts: products.map(product => ({
      productId: product.productId, productName: product.productName, relationshipLevel: product.relationshipLevel,
      evidenceStatus: product.evidenceStatus, scopeEvidence: product.scopeEvidence
    }))
  };
}

export function screenLegacy(article, profile) {
  const domains = articleDomains(article);
  const base = {
    result: '待定', reason: '', evidence: '', business: domains.map(domain => domainNames[domain]).join('、'),
    event: '', rule: 'two-domain-event-impact-v3', scopeVersion, inScope: domains.length > 0,
    eventGate: 'not_found', businessGate: 'not_checked', eventEvidence: '', businessEvidence: '',
    affectedObject: '', relationship: '', impactEvidence: '', changes: [], affectedProducts: []
  };
  if (!base.inScope) return { ...base, result: '排除', reason: '不属于通信与数据中心或汽车范围' };
  if (nonIndustryTitle.test(article.title)) return { ...base, result: '排除', reason: '教程、软件操作或促销内容缺少产业新闻价值' };
  const body = Array.isArray(article.bodyEvidence) ? article.bodyEvidence : [];
  const bodySentences = sentences(body);
  // Gate one identifies the change before consulting the business scope.
  const changes = extractChanges(body);
  const hints = extractChanges([article.title, article.summary].filter(Boolean));
  base.changes = changes;
  base.event = changes[0]?.type || '';
  base.eventEvidence = [...new Set(changes.map(change => change.evidence))].join('\n');
  base.eventGate = changes.length ? 'passed' : hints.length ? 'hint_only' : 'not_found';
  if (!['ok', 'rss_evidence'].includes(article.bodyStatus)) return { ...base, reason: '正文不足，无法完成变化与业务影响核对' };
  if (!changes.length) {
    return { ...base, result: hints.length ? '待定' : '排除', reason: hints.length ? '标题或摘要有变化线索，正文未证实' : '正文没有具体变化，一般介绍和配置罗列不通过' };
  }

  const sentenceProducts = bodySentences.map(sentence => matchProducts(sentence.text, profile, domains));
  let unresolved = null;
  // Gate two checks either the changed direct product or an evidenced upstream impact.
  for (const change of changes) {
    const previous = bodySentences[change.sentenceIndex - 1];
    const usesReference = objectReference.test(change.evidence) && previous?.paragraphIndex === change.paragraphIndex;
    const context = [usesReference && previous.text, change.evidence].filter(Boolean);
    for (const next of bodySentences.slice(change.sentenceIndex + 1, change.sentenceIndex + 3)) {
      if (next.paragraphIndex !== change.paragraphIndex || !reference.test(next.text)) break;
      context.push(next.text);
    }
    // A paragraph that explicitly refers back to the agreement can identify its product.
    const next = bodySentences[change.sentenceIndex + 1];
    if (next?.paragraphIndex === change.paragraphIndex + 1 && reference.test(next.text)) {
      context.push(next.text);
      const detail = bodySentences[change.sentenceIndex + 2];
      if (detail?.paragraphIndex === next.paragraphIndex) context.push(detail.text);
    }
    const businessEvidence = context.join(' ');
    const products = matchProducts(businessEvidence, profile, domains);
    const direct = directProducts(products);
    if (change.type === '新品与平台方案' && !hardwareDetails.test(businessEvidence)) continue;
    const upstream = upstreamProducts(products);
    let decision = withEvidence(base, change, products, businessEvidence, 'direct');
    if (direct.length && (!upstream.length || ['供应商变化', '供应商与技术合作', '订单与产能', '并购与投资'].includes(change.type))) {
      if (rumor.test(`${article.title} ${businessEvidence}`) || speculativeImpact.test(change.evidence)) {
        unresolved ||= { ...decision, reason: '相关产品发生变化，但消息确定性仍待核对' };
        continue;
      }
      return { ...decision, result: '入选', businessGate: 'passed', reason: `${change.type}直接涉及${direct.map(product => product.productName).join('、')}` };
    }
    if (!upstream.length) continue;
    const identifiers = objectIdentifiers(change.evidence);

    // A later paragraph can supply the impact, but it must name the same upstream object.
    for (const [index, sentence] of bodySentences.entries()) {
      if (background.test(sentence.text) || negation.test(sentence.text) || !impactRelation.test(sentence.text)) continue;
      const targets = directProducts(sentenceProducts[index]);
      if (!targets.length) continue;
      const sharedIdentifier = identifiers.some(identifier => containsAlias(sentence.text, identifier));
      const repeatedSubject = upstream.some(product => productMention(sentence.text, product))
        && (!identifiers.length || sharedIdentifier);
      const adjacentReference = objectReference.test(sentence.text) && index === change.sentenceIndex + 1
        && sentence.paragraphIndex === change.paragraphIndex
        && (!identifiers.length || !objectIdentifiers(sentence.text).length || sharedIdentifier);
      if (!repeatedSubject && !adjacentReference) continue;
      decision = withEvidence(base, change, [...upstream, ...targets], sentence.text, 'explicit_indirect', sentence.text);
      if (rumor.test(`${article.title} ${change.evidence}`) || speculativeImpact.test(sentence.text)) {
        unresolved ||= { ...decision, reason: '上下游影响链有原文线索，但仍含传闻或推测' };
        continue;
      }
      return { ...decision, result: '入选', businessGate: 'passed', reason: `${upstream.map(product => product.productName).join('、')}发生${change.type}，正文明确影响${targets.map(product => product.productName).join('、')}` };
    }
    unresolved ||= { ...withEvidence(base, change, upstream, businessEvidence, 'unresolved_indirect'), reason: '已识别上游变化，尚缺对具体产品的明确影响依据' };
  }
  if (unresolved) return { ...unresolved, businessGate: 'needs_review' };
  if (sentenceProducts.some(products => products.length)) {
    return { ...base, businessGate: 'needs_review', reason: '存在变化和产品线索，尚未建立两者对应关系' };
  }
  if (domains.includes('datacom') && changes.some(change => change.type === '商业部署与供货'
    && /\b(?:data[ -]?cent(?:er|re)|IT capacity)\b.{0,100}\bonline\b|\bonline\b.{0,100}\bdata[ -]?cent(?:er|re)\b/iu.test(change.evidence))) {
    return { ...base, businessGate: 'needs_review', reason: '数据中心产能已上线，但未证实具体立讯产品对应关系' };
  }
  return { ...base, result: '排除', businessGate: 'not_matched', reason: '变化对象没有对应具体产品或有原文支持的业务影响' };
}

export function screen(article, profile) {
  const unified = tagArticle(article, { scope: ['datacom', 'automotive'] });
  const main = unified.mainEvent;
  const domains = articleDomains(article);
  let result = '排除';
  let reason = '没有范围内且可核对的新增事件';
  let businessGate = 'not_checked';
  let products = [];
  if (!domains.length) reason = '不属于通信与数据中心或汽车范围';
  else if (!['ok', 'rss_evidence'].includes(article.bodyStatus)) {
    result = '待定';
    reason = '正文不足，事件及业务关系待核对';
  } else if (main) {
    const paragraph = article.bodyEvidence?.[main.paragraphId - 1] || main.evidence;
    products = matchProducts(paragraph, profile, domains);
    if (products.some(product => product.relationshipLevel === 'direct')) {
      result = '入选';
      businessGate = 'direct_product';
      reason = `事件与直接产品在同段：${main.eventType}`;
    } else if (products.length) {
      result = '待定';
      businessGate = 'indirect_needs_impact';
      reason = '事件成立，上游/邻接产品对立讯直接产品的影响未证实';
    } else {
      result = '待定';
      businessGate = 'product_unresolved';
      reason = '事件成立，具体立讯业务对象尚未对应';
    }
  }
  return { result, reason, rule: 'unified-v1', scopeVersion, inScope: domains.length > 0,
    business: domains.map(domain => domainNames[domain]).join('、'), businessGate,
    eventGate: main ? 'passed' : 'not_found', event: main?.eventType || '', stage: main?.stage || 'unknown',
    eventEvidence: main?.evidence || '', affectedObject: products.map(product => product.productName).join('、'),
    businessEvidence: main?.evidence || '', relationship: businessGate, impactEvidence: '',
    changes: unified.facts, affectedProducts: products, unifiedTagging: unified,
    homepageCandidate: result === '入选' && Boolean(main),
    dataQuality: article.publishedAt ? 'complete' : 'missing_published_at' };
}
