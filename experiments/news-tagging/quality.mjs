import { evidenceSpans } from './adapter.mjs';

const milestonePatterns = [
  { type: 'product-launch', pattern: /\b(?:orderable|available) (?:now|today)\b|\bnow available\b/iu },
  { type: 'qualification-certification', pattern: /\bselected by .{0,80}\b(?:supplier|system tier[ -]?1|partner for)\b/iu }
];

// These are review leads, not automatically accepted events. A model must still bind
// each milestone to the right actor, object, stage and article before it becomes a tag.
export function evidenceGaps(article, keptEvents) {
  const gaps = [];
  for (const chunk of article.chunks) for (const span of evidenceSpans(chunk.text)) {
    for (const { type, pattern } of milestonePatterns) {
      if (!pattern.test(span.text)) continue;
      const cited = keptEvents.some(event => event.type === type &&
        ((event.chunk === chunk.index && event.evidence_id === span.id) ||
          (event.chunk === chunk.index && event.supporting_evidence_id === span.id)));
      if (!cited) gaps.push({ type, chunk: chunk.index, evidence_id: span.id, quote: span.text });
    }
  }
  return gaps;
}

export function eventRecordWarnings(title, events) {
  const headline = title.toLowerCase();
  return events.flatMap(event => {
    const actor = event.actor || event.subject || '';
    const evidence = [event.change_quote, event.supporting_quote].filter(Boolean).join(' ').toLowerCase();
    const warnings = [];
    if (actor.length >= 4 && !headline.includes(actor.toLowerCase())) warnings.push('actor_not_named_in_headline');
    if (actor.length >= 4 && !evidence.includes(actor.toLowerCase())) warnings.push('actor_not_named_in_evidence');
    if (event.object && !evidence.includes(event.object.toLowerCase())) warnings.push('object_not_named_in_evidence');
    return warnings.length ? [{ type: event.type, actor, object: event.object || null, chunk: event.chunk,
      evidence_id: event.evidence_id, warnings }] : [];
  });
}
