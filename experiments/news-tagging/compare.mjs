import { encodeCsv } from '../news-screening/audit.mjs';

const relevantStages = new Set(['occurred', 'confirmed-plan', 'trial-validation']);
const lowValueContent = new Set(['promotion', 'tutorial', 'product-review', 'roundup']);
const inScopeDomains = new Set(['datacom-telecom', 'automotive']);

export function compareDecisions(report) {
  return report.results.map(article => {
    const events = article.events.filter(event =>
      relevantStages.has(event.status) &&
      (event.relation === 'direct' || event.relation === 'explicit-indirect'));
    const relevant = article.domains.some(domain => inScopeDomains.has(domain)) &&
      !article.content_types.some(type => lowValueContent.has(type));
    const tagDecision = article.status === 'completed'
      ? relevant && events.length ? '待人工核对' : '未发现可入选证据'
      : '证据或推理未完成';
    const originalSelected = article.originalDecision === '入选';
    const discrepancy = article.status === 'completed' &&
      ((tagDecision === '待人工核对') !== originalSelected);
    const productProposals = article.status === 'completed'
      ? article.proposed_tags.filter(tag => tag.dimension === 'product') : [];
    return {
      title: article.title, url: article.url, originalDecision: article.originalDecision,
      tagDecision, discrepancy, productProposals,
      evidence: events.map(event => event.change_quote),
      impactEvidence: events.map(event => event.impact_quote).filter(Boolean),
      reviewPriority: productProposals.length || discrepancy ? '优先抽查' : '常规抽查'
    };
  });
}

export function comparisonCsv(comparisons) {
  return encodeCsv([
    ['标题', '原筛选结果', '标签辅助判断', '是否分歧', '复核优先级', '产品知识库候选补充', '事件原句', '影响原句', '链接'],
    ...comparisons.map(item => [
      item.title, item.originalDecision, item.tagDecision,
      item.discrepancy ? '是' : '否', item.reviewPriority,
      item.productProposals.map(tag => `${tag.description}：${tag.evidence_quote}`).join('\n'),
      item.evidence.join('\n'), item.impactEvidence.join('\n'), item.url
    ])
  ]);
}
