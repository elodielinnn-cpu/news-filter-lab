// Post-model checks preserve semantic uncertainty for review instead of vetoing
// a fact because one English synonym is absent from a short allow-list.
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const boilerplate = /\b(?:cookie policy|privacy notice|newsletter|related articles|let us know in the comments)\b|评论区|相关阅读|隐私政策/iu;
const actionStage = /\b(?:announced|introduced|launched|unveiled|released|published|available|orderable|plans? to|will)\b|发布|公布|推出|计划|将于|可订/iu;
const useStage = /\b(?:deployed|installed|running|in use|started shipping|delivered|production|at scale|live at)\b|已部署|已安装|运行|开始交付|量产|规模部署/iu;
const technologyStages = new Set(['technology', 'product']);

export function refineEvents(events) {
  const kept = [];
  const rejected = [];
  for (const event of events) {
    const quote = [event.change_quote, event.supporting_quote].filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim();
    if (event.article_role === 'background') {
      rejected.push({ ...event, rejection_reason: 'background_not_article_event' });
      continue;
    }
    if (quote.length < 35 || boilerplate.test(quote)) {
      rejected.push({ ...event, rejection_reason: 'boilerplate_or_fragment' });
      continue;
    }
    const warnings = [...(event.evidence_warnings || [])];
    if (event.actor && !normalize(quote).includes(normalize(event.actor))) warnings.push('actor_not_in_evidence');
    const objectWords = normalize(event.object).split(' ').filter(word => word.length >= 4);
    if (objectWords.length && !objectWords.some(word => normalize(quote).includes(word))) warnings.push('object_not_in_evidence');
    if (technologyStages.has(event.type) && event.status === 'published' && !actionStage.test(quote)) warnings.push('publication_action_unconfirmed');
    if (technologyStages.has(event.type) && ['initial_use', 'scale_use'].includes(event.status) && !useStage.test(quote)) warnings.push('application_stage_unconfirmed');
    if (!technologyStages.has(event.type) && !['not_applicable', 'planned', 'unknown'].includes(event.status)) warnings.push('maturity_stage_on_non_product_event');
    kept.push({ ...event, verification_status: warnings.length ? 'needs_review' : 'validated_structure',
      verification_warnings: [...new Set(warnings)] });
  }
  return { kept, rejected };
}
