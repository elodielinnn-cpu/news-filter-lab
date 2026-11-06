import crypto from 'node:crypto';

export const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalizedText = value => String(value || '').replace(/\s+/gu, ' ').trim();

// Ported from feeds.fun dog_tags_extractor. BSD-3-Clause, see UPSTREAM.md and third-party license.
export function extractAtTags(text) {
  return [...new Set([...String(text).matchAll(/@([\p{L}\p{N}_-]+)/gu)].map(match => match[1].toLowerCase()))];
}

export function normalizeTag(value) {
  return String(value).normalize('NFKC').toLowerCase().replace(/^@/, '').replace(/[\s_]+/gu, '-').replace(/^-+|-+$/g, '');
}

export function chunkText(paragraphs, maxCharacters, overlapCharacters) {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 100 || !Number.isInteger(overlapCharacters) || overlapCharacters < 0 || overlapCharacters >= maxCharacters) throw new Error('Invalid chunk limits');
  const text = paragraphs.map(normalizedText).filter(Boolean).join('\n\n');
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxCharacters);
    const boundary = text.lastIndexOf('\n\n', end);
    if (end < text.length && boundary > start + maxCharacters / 2) end = boundary;
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1])) end -= 1;
    chunks.push({ index: chunks.length, start, end, text: text.slice(start, end) });
    if (end === text.length) break;
    start = Math.max(start + 1, end - overlapCharacters);
    if (/[\uDC00-\uDFFF]/u.test(text[start])) start += 1;
  }
  return chunks;
}

export function outputSchema(taxonomy, products) {
  const string = { type: 'string' };
  const list = (items, maximum = 4) => ({ type: 'array', maxItems: maximum, items });
  const productList = list({ type: 'string', enum: products.map(product => product.productId) });
  return {
    type: 'object', additionalProperties: false,
    required: ['domains', 'content_types', 'events', 'raw_tags', 'proposed_tags'],
    properties: {
      domains: list({ type: 'string', enum: Object.keys(taxonomy.domains) }, 3),
      content_types: list({ type: 'string', enum: Object.keys(taxonomy.content_types) }),
      raw_tags: list(string, 20),
      events: list({
        type: 'object', additionalProperties: false,
        required: ['type', 'status', 'subject', 'product_ids', 'change_quote', 'relation', 'impact_quote', 'impact_product_ids'],
        properties: {
          type: { type: 'string', enum: Object.keys(taxonomy.event_types) },
          status: { type: 'string', enum: Object.keys(taxonomy.statuses) }, subject: string,
          product_ids: productList, change_quote: string,
          relation: { type: 'string', enum: Object.keys(taxonomy.relations) },
          impact_quote: string, impact_product_ids: productList
        }
      }),
      proposed_tags: list({
        type: 'object', additionalProperties: false,
        required: ['dimension', 'tag', 'description', 'evidence_quote'],
        properties: { dimension: { type: 'string', enum: ['event', 'content', 'product'] }, tag: string, description: string, evidence_quote: string }
      }, 3)
    }
  };
}

export function validateOutput(value, chunk, taxonomy, products) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
  const productIds = new Set(products.map(product => product.productId));
  const directIds = new Set(products.filter(product => product.relationshipLevel === 'direct').map(product => product.productId));
  const requireList = (items, allowed, name, maximum) => {
    if (!Array.isArray(items) || items.length > maximum || items.some(item => typeof item !== 'string' || !allowed.has(item))) throw new Error(`Invalid ${name}`);
    return [...new Set(items)];
  };
  const quote = (text, required) => {
    if (typeof text !== 'string' || required && !normalizedText(text) || text && !normalizedText(chunk.text).includes(normalizedText(text))) throw new Error('Evidence quote absent from supplied chunk');
  };
  const domains = requireList(value.domains, new Set(Object.keys(taxonomy.domains)), 'domains', 3);
  const contentTypes = requireList(value.content_types, new Set(Object.keys(taxonomy.content_types)), 'content types', 4);
  if (!Array.isArray(value.events) || value.events.length > 4 || !Array.isArray(value.raw_tags) || value.raw_tags.length > 20 || value.raw_tags.some(tag => typeof tag !== 'string') || !Array.isArray(value.proposed_tags) || value.proposed_tags.length > 3) throw new Error('Invalid event/tag arrays');
  const events = value.events.map(event => {
    if (!event || !Object.hasOwn(taxonomy.event_types, event.type) || !Object.hasOwn(taxonomy.statuses, event.status) || !Object.hasOwn(taxonomy.relations, event.relation) || typeof event.subject !== 'string' || !event.subject.trim()) throw new Error('Invalid event classification');
    quote(event.change_quote, true);
    quote(event.impact_quote, event.relation === 'explicit-indirect');
    const subjects = requireList(event.product_ids, productIds, 'event products', 4);
    const targets = requireList(event.impact_product_ids, productIds, 'impact products', 4);
    if (event.relation === 'direct' && !subjects.some(id => directIds.has(id))) throw new Error('Direct relationship lacks a direct-scope product');
    if (event.relation === 'explicit-indirect' && (!targets.length || targets.some(id => !directIds.has(id)))) throw new Error('Indirect relationship lacks direct-scope target products');
    if (event.relation === 'unclear' && (event.impact_quote || targets.length)) throw new Error('Unclear relationship cannot assert a supported impact');
    return { type: event.type, status: event.status, subject: event.subject, product_ids: subjects, change_quote: event.change_quote, relation: event.relation, impact_quote: event.impact_quote, impact_product_ids: targets, chunk: chunk.index };
  });
  const proposals = value.proposed_tags.map(proposal => {
    if (!proposal || !['event', 'content', 'product'].includes(proposal.dimension) || typeof proposal.tag !== 'string' || typeof proposal.description !== 'string' || !proposal.description.trim()) throw new Error('Invalid tag proposal');
    const tag = normalizeTag(proposal.tag);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) throw new Error('Proposal must use a lowercase English slug');
    quote(proposal.evidence_quote, true);
    return { dimension: proposal.dimension, tag, description: proposal.description, evidence_quote: proposal.evidence_quote, chunk: chunk.index };
  });
  const rawTags = [...new Set(value.raw_tags.flatMap(tag => { const extracted = extractAtTags(tag); return extracted.length ? extracted : [tag]; }).map(normalizeTag).filter(Boolean))];
  return { domains, content_types: contentTypes, events, raw_tags: rawTags, proposed_tags: proposals };
}

export function mergeOutputs(outputs) {
  const unique = values => [...new Set(values)];
  const events = new Map();
  const proposals = new Map();
  for (const output of outputs) {
    for (const event of output.events) {
      const { chunk, ...identity } = event;
      events.set(digest(identity), event);
    }
    for (const proposal of output.proposed_tags) proposals.set(digest([proposal.dimension, proposal.tag, proposal.evidence_quote]), proposal);
  }
  return {
    domains: unique(outputs.flatMap(output => output.domains)),
    content_types: unique(outputs.flatMap(output => output.content_types)),
    events: [...events.values()], raw_tags: unique(outputs.flatMap(output => output.raw_tags)), proposed_tags: [...proposals.values()]
  };
}
