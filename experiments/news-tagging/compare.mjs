import { encodeCsv } from '../news-screening/audit.mjs';

const relevantStages = new Set(['occurred', 'confirmed-plan', 'trial-validation']);
const lowValueContent = new Set(['promotion', 'tutorial', 'product-review', 'roundup']);
const inScopeDomains = new Set(['datacom-telecom', 'automotive']);

export function compareDecisions(report) {
  return report.results.map(article => {
    const candidates = Object.hasOwn(article, 'main_event') ? (article.main_event ? [article.main_event] : []) : (article.refined_events || article.events);
    const events = candidates.filter(event =>
      relevantStages.has(event.status));
    const relevant = article.domains.some(domain => inScopeDomains.has(domain)) &&
      !article.content_types.some(type => lowValueContent.has(type));
    const tagDecision = article.status === 'completed'
      ? relevant && events.length ? '发现实质事件，产品关系待核对' : '未发现实质事件'
      : '证据或推理未完成';
    const originalSelected = article.originalDecision === '入选';
    const discrepancy = article.status === 'completed' &&
      (Boolean(relevant && events.length) !== originalSelected);
    const reviewReason = !discrepancy ? '' : originalSelected
      ? '原规则入选但未识别实质事件' : '识别到实质事件，需核查产品知识库是否漏配';
    return {
      title: article.title, url: article.url, originalDecision: article.originalDecision,
      originalBusiness: article.originalBusiness || '', originalAffectedObject: article.originalAffectedObject || '',
      originalEvidence: article.originalEvidence || '', originalReason: article.originalReason || '',
      tagDecision, discrepancy, reviewReason,
      evidence: events.map(event => event.change_quote),
      reviewPriority: discrepancy ? '优先抽查' : '常规抽查'
    };
  });
}

export function comparisonCsv(comparisons) {
  return encodeCsv([
    ['标题', '原筛选结果', '原规则业务', '原规则影响产品', '原规则依据', '原规则理由', '事件标签辅助判断', '是否需交叉核对', '复核优先级', '复核原因', '事件原句', '链接'],
    ...comparisons.map(item => [
      item.title, item.originalDecision, item.originalBusiness, item.originalAffectedObject,
      item.originalEvidence, item.originalReason, item.tagDecision,
      item.discrepancy ? '是' : '否', item.reviewPriority,
      item.reviewReason,
      item.evidence.join('\n'), item.url
    ])
  ]);
}
