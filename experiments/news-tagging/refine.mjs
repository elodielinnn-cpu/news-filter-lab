// Conservative, article-independent checks derived from the human audit.
// These rules reject unsupported tags; they never manufacture an event or infer a Luxshare link.
const test = (pattern, text) => pattern.test(text);
const futureOnly = /\b(?:will|would|could|might|may|plans? to|planned to|expects? to|expected to|aims? to|scheduled to|set to|likely to|forecast|projected|proposal)\b/iu;
const negated = /\b(?:not|no|without|hasn't|haven't|doesn't|isn't|won't|cannot|can't|neither)\b/iu;
const rules = {
  'deployment-adoption': /\b(?:deployed|installed|running|in use|in operation|operating|using|uses|went live|now live|available now|generally available|began testing|started testing|pilot is live|put to work|turning to|into production|trained and served)\b|已部署|已安装|投入使用|上线|正在运行/iu,
  'order-contract': /\b(?:signed|selected|awarded|contract|purchase agreement|supply agreement|production orders?|commercial agreement|definitive agreement)\b|签约|合同|订单|定点/iu,
  'partnership': /\b(?:partner(?:ship|ed|ing)?|collaborat(?:ion|e|ed|ing)|joint(?:ly)?|co-develop|agreement to develop|working together|contributes|integrating|letter of intent)\b|合作|联合开发/iu,
  'merger-acquisition': /\b(?:acquir(?:e|es|ed|ing)|acquisition|merg(?:e|er)|buy(?:ing|s)?\s+.{0,40}\bcompany)\b|收购|并购/iu,
  'investment': /\b(?:invest(?:ment|ed|ing|s)?|funding|financing|capital injection|equity stake)\b|投资|融资/iu,
  'product-launch': /\b(?:launch(?:ed|es|ing)?|introduc(?:ed|es|ing)?|unveil(?:ed|s|ing)?|release(?:d|s)?|now available|available to|orderable)\b|发布|推出|上市/iu,
  'qualification-certification': /\b(?:certif(?:ied|ication)|qualif(?:ied|ication)|approv(?:ed|al)|validated by|cleared by|authorized|permit granted)\b|认证|批准|许可|验证通过/iu,
  'quality-recall': /\brecall(?:ed|s|ing)?\b|召回/iu,
  'financial-results': /\b(?:quarterly|earnings|revenue|net income|operating income|profit|financial results)\b|财报|营收|利润/iu,
  'production-ramp': /\b(?:production ramp|ramp.up|ramp(?:ing|ed)? production|mass production|volume production|shipments? (?:have|has|are) (?:begun|started|increased)|output (?:rose|grew))\b|量产|产量爬坡|开始出货/iu,
  'capacity-expansion': /\b(?:construction (?:has )?(?:begun|started)|broke ground|capacity (?:came|is) online|expanded capacity|opened (?:a|the) (?:factory|facility|data center))\b|开工|投运|新增产能/iu,
  'manufacturing-relocation': /\b(?:relocat(?:e|ed|ion)|transfer(?:red)? production|shift(?:ed)? manufacturing|move(?:d)? production)\b|迁产|转移产线/iu,
  'supplier-change': /\b(?:replac(?:e|ed|ing) (?:the |its )?supplier|switch(?:ed|ing)? supplier|supplier share (?:shift|change)|dual.source)\b|换供|替换供应商|双供/iu,
  'security-incident': /\b(?:breach(?:ed)?|hack(?:ed)?|attack(?:ed)?|data leak(?:ed)?|compromised)\b|数据泄露|遭攻击/iu,
  'regulation-policy': /\b(?:new (?:law|rule|regulation|policy)|enacted|government (?:grant|funding)|public funding awarded|regulatory change|PennDOT|NEVI funding)\b|新规|政策拨款|政府资助/iu,
  'research-prototype': /\b(?:prototype|validation|sample (?:has been|was) (?:tested|validated)|test(?:ed|ing)? (?:in|at) (?:the )?(?:factory|lab)|takes on an? .{0,30}task|proof.of.concept)\b|原型|样机|完成验证/iu
};

export function refineEvents(events) {
  const kept = [];
  const rejected = [];
  for (const event of events) {
    const quote = String(event.change_quote || '');
    let reason = '';
    if (['historical', 'rumor', 'unclear'].includes(event.status)) reason = 'non_current_or_unconfirmed';
    else if (event.type === 'other-event') reason = 'unspecified_event';
    else if (event.status === 'forecast' && !['demand-outlook', 'pricing-cost', 'product-launch'].includes(event.type)) reason = 'forecast_is_not_an_event';
    else if (rules[event.type] && !test(rules[event.type], quote)) reason = 'type_not_supported_by_quote';
    else if (event.type === 'deployment-adoption' && (futureOnly.test(quote) || negated.test(quote)) && !test(/\b(?:already|currently|now|has deployed|have deployed|is running|are running)\b/iu, quote)) reason = 'deployment_not_yet_live';
    else if (event.type === 'production-ramp' && futureOnly.test(quote) && !test(/\b(?:has begun|have begun|is ramping|are ramping|now shipping)\b/iu, quote)) reason = 'production_not_yet_ramping';
    else if (event.type === 'financial-results' && test(/\b(?:vehicle|car|EV|registration|grant|funding)\s+(?:sales|registrations|funding|grant)\b/iu, quote) && !test(/\b(?:revenue|income|profit|earnings)\b/iu, quote)) reason = 'not_company_financial_results';
    (reason ? rejected : kept).push(reason ? { ...event, rejection_reason: reason } : event);
  }
  return { kept, rejected };
}
