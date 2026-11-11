// Conservative, article-independent checks derived from the human audit.
// These rules reject unsupported tags; they never manufacture an event or infer a Luxshare link.
const test = (pattern, text) => pattern.test(text);
const futureOnly = /\b(?:will|would|could|might|may|plans? to|planned to|expects? to|expected to|aims? to|scheduled to|set to|likely to|forecast|projected|proposal)\b/iu;
const negated = /\b(?:not|no|without|hasn't|haven't|doesn't|isn't|won't|cannot|can't|neither)\b/iu;
const boilerplate = /(?:find all our press releases|privacy notice|login credentials|located in .{0,50}chief analyst|newsletter|cookie policy)/iu;
const editorialAside = /\b(?:let us know what you think|in the comments|i still consider|i think this|you can check out .{0,80} below)\b/iu;
const oldBackground = /\b(?:predates this announcement|previously|last year|in May|in September|published at GTC Berlin|introduced at Fal\.Con in Las Vegas)\b/iu;
const architectureEvidence = /\b(?:topology|dual[ -]homed|redundan(?:t|cy) (?:path|route)|shared (?:file|storage|flash) tier|cache hierarchy|spine[ -]and[ -]leaf|(?:moves?|migrat(?:es|ed|ing)?) .{0,100}\b(?:off|onto|from|to)\b|(?:replac(?:es|ed)|redesign(?:s|ed)) .{0,90}\b(?:with|into)\b)\b|拓扑|双归属|共享存储层|架构调整/iu;
const formalLaunch = /\b(?:announc(?:es|ed)|launch(?:es|ed)|unveil(?:s|ed)|introduc(?:es|ed)|release(?:s|d))\b.{0,110}\b(?:platform|solution|offering|service|product|system)\b|\b(?:launch(?:es|ed|ing)?|unveil(?:s|ed)|introduc(?:es|ed)|release(?:s|d))\b|\b(?:platform|solution|offering|service|product|system)\b.{0,80}\b(?:now available|generally available|launched)\b|\b(?:available|orderable) (?:now|today)\b|正式发布|正式推出/iu;
const partnershipAction = /\b(?:announc(?:es|ed)|sign(?:s|ed)|added? .{0,50}partner network|will deliver|joint(?:ly)?|collaborat(?:es|ed|ing) on|agreement with|integrat(?:es|ed|ing) .{0,90}into)\b|宣布合作|签署协议|联合交付/iu;
const technologyChange = /\b(?:adds?|added|updated|upgrad(?:e|ed|es)|redesign(?:s|ed)?|integrat(?:es|ed|ing)|implement(?:s|ed)?|improv(?:es|ed)?|reduc(?:es|ed)?|increas(?:es|ed)?|moves? .{0,100}\b(?:off|onto|from|to)|new (?:feature|function|capability))\b|新增功能|技术升级|性能提升|工艺改进/iu;
const futureLaunch = /\b(?:will|plans? to|expected to|set to|scheduled to)\s+(?:\w+\s+){0,3}(?:launch|unveil|release|introduce)\b|\blaunch event\b.{0,60}\bwill be held\b|计划发布|将于.{0,20}发布/iu;
const actualPrice = /(?:[$€£¥]\s?\d|\b\d+(?:\.\d+)?\s?(?:percent|%|dollars?|euros?|yuan)\b|\b(?:price|cost)s?\b.{0,70}\b(?:rose|fell|dropped|climbed|increased|decreased|higher|lower)\b)/iu;
const contractAction = /\b(?:signed|awarded|selected|entered into|secured .{0,50}(?:order|contract|agreement)|new (?:dealer|supply|purchase) agreement|(?:expanded|extended) .{0,60}(?:purchasing |procurement )?contract|(?:placed|received|won|booked) .{0,30}order)\b|签署|获得订单|定点/iu;
const rules = {
  'deployment-adoption': /\b(?:deployed|deployment is live|live deployment|installed|running|in use|in operation|operating|using|uses|went live|now live|available now|generally available|began testing|started testing|pilot is live|put to work|turning to|into production|trained and served|brought .{0,100} online)\b|已部署|已安装|投入使用|上线|正在运行/iu,
  'order-contract': /\b(?:signed|selected|awarded|booked .{0,30}order|contract|purchase agreement|supply agreement|production orders?|commercial agreement|definitive agreement)\b|签约|合同|订单|定点/iu,
  'partnership': /\b(?:partner(?:ship|ed|ing)?|collaborat(?:ion|e|ed|ing)|joint(?:ly)?|co-develop|agreement to develop|working together|contributes|integrating|letter of intent|[A-Z][\w.-]+(?:\s+[A-Z][\w.-]+){0,2}\s+and\s+[A-Z][\w.-]+(?:\s+[A-Z][\w.-]+){0,2}\s+(?:have\s+)?announced)\b|合作|联合开发/iu,
  'merger-acquisition': /\b(?:acquir(?:e|es|ed|ing)|acquisition|merg(?:e|er)|buy(?:ing|s)?\s+.{0,40}\bcompany)\b|收购|并购/iu,
  'investment': /\b(?:invest(?:ment|ed|ing|s)?|funding|financing|capital injection|equity stake)\b|投资|融资/iu,
  'product-launch': /\b(?:launch(?:ed|es|ing)?|introduc(?:ed|es|ing)?|unveil(?:ed|s|ing)?|release(?:d|s)?|announc(?:es|ed)|now available|available now|available to|orderable)\b|发布|推出|上市/iu,
  'qualification-certification': /\b(?:certif(?:ied|ication)|qualif(?:ied|ication)|approv(?:ed|al)|validated by|cleared by|authorized|permit granted|design wins?|nominat(?:ed|ion))\b|认证|批准|许可|验证通过|客户定点/iu,
  'quality-recall': /\brecall(?:ed|s|ing)?\b|召回/iu,
  'financial-results': /\b(?:quarterly|earnings|revenue|net income|operating income|profit|financial results)\b|财报|营收|利润/iu,
  'production-ramp': /\b(?:production ramp|ramp.up|ramp(?:ing|ed)? production|mass production|volume production|shipments? (?:have|has|are) (?:begun|started|increased)|output (?:rose|grew))\b|量产|产量爬坡|开始出货/iu,
  'capacity-expansion': /\b(?:construction (?:has )?(?:begun|started)|broke ground|capacity (?:came|is) online|brought .{0,100}capacity online|expanded capacity|opened (?:a|the) (?:factory|facility|data center))\b|开工|投运|新增产能/iu,
  'manufacturing-relocation': /\b(?:relocat(?:e|ed|ion)|transfer(?:red)? production|shift(?:ed)? manufacturing|move(?:d)? production)\b|迁产|转移产线/iu,
  'supplier-change': /\b(?:replac(?:e|ed|ing) (?:the |its )?supplier|switch(?:ed|ing)? supplier|supplier share (?:shift|change)|dual.source)\b|换供|替换供应商|双供/iu,
  'security-incident': /\b(?:breach(?:ed)?|hack(?:ed)?|attack(?:ed)?|data leak(?:ed)?|compromised)\b|数据泄露|遭攻击/iu,
  'regulation-policy': /\b(?:new (?:law|rule|regulation|policy)|enacted|government (?:grant|funding)|public funding awarded|regulatory change|PennDOT|NEVI funding)\b|新规|政策拨款|政府资助/iu,
  'research-prototype': /\b(?:prototype|validation|benchmark (?:client|result)|sample (?:has been|was) (?:tested|validated)|test(?:ed|ing)? (?:in|at) (?:the )?(?:factory|lab)|test(?:ed|ing)? .{0,80}\b(?:stack|cluster|system|platform)|takes on an? .{0,30}task|proof.of.concept)\b|原型|样机|完成验证/iu
};

export function refineEvents(events) {
  const kept = [];
  const rejected = [];
  for (const event of events) {
    const quote = String(event.change_quote || '').replace(/&#(\d+);/gu, (token, code) => Number(code) > 0 && Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : token).replace(/&(?:ldquo|rdquo|lsquo|rsquo);/giu, '"');
    let reason = '';
    if (boilerplate.test(quote) || editorialAside.test(quote) || quote.length < 45 || /^\S{1,8}es? in a spine/iu.test(quote)) reason = 'boilerplate_or_fragment';
    else if (['historical', 'rumor', 'unclear'].includes(event.status)) reason = 'non_current_or_unconfirmed';
    else if (event.type === 'other-event') reason = 'unspecified_event';
    else if (event.status === 'forecast' && !['demand-outlook', 'pricing-cost', 'product-launch'].includes(event.type)) reason = 'forecast_is_not_an_event';
    else if (event.type === 'order-contract' && /\b(?:acquir(?:e|es|ed|ing)|acquisition|merger)\b/iu.test(quote)) reason = 'acquisition_is_not_supply_contract';
    else if (event.type === 'order-contract' && !contractAction.test(quote)) reason = 'contract_action_not_supported';
    else if (event.type === 'technology-update' && oldBackground.test(quote)) reason = 'historical_background';
    else if (event.type === 'technology-update' && !technologyChange.test(quote)) reason = 'technology_change_not_supported';
    else if (event.type === 'partnership' && !partnershipAction.test(quote)) reason = 'joint_action_not_supported';
    else if (event.type === 'architecture-change' && !architectureEvidence.test(quote)) reason = 'architecture_not_supported_by_quote';
    else if (event.type === 'product-launch' && (oldBackground.test(quote) || !formalLaunch.test(quote))) reason = 'launch_not_supported_by_quote';
    else if (event.type === 'product-launch' && futureLaunch.test(quote) && !/\b(?:has launched|launched today|unveiled today|now available)\b/iu.test(quote)) reason = 'future_launch_not_released';
    else if (event.type === 'pricing-cost' && !actualPrice.test(quote)) reason = 'price_or_cost_change_not_stated';
    else if (event.type === 'demand-outlook' && event.status === 'forecast' && /\b(?:could|might|may|potentially)\b/iu.test(quote) && !/\b(?:according to|forecasts?|projects?|estimates?|expects?|predicts?)\b/iu.test(quote)) reason = 'unattributed_demand_speculation';
    else if (rules[event.type] && !test(rules[event.type], quote)) reason = 'type_not_supported_by_quote';
    else if (event.type === 'deployment-adoption' && (futureOnly.test(quote) || negated.test(quote)) && !test(/\b(?:already|currently|now|has deployed|have deployed|is running|are running)\b/iu, quote)) reason = 'deployment_not_yet_live';
    else if (event.type === 'production-ramp' && futureOnly.test(quote) && !test(/\b(?:has begun|have begun|is ramping|are ramping|now shipping)\b/iu, quote)) reason = 'production_not_yet_ramping';
    else if (event.type === 'financial-results' && test(/\b(?:vehicle|car|EV|registration|grant|funding)\s+(?:sales|registrations|funding|grant)\b/iu, quote) && !test(/\b(?:revenue|income|profit|earnings)\b/iu, quote)) reason = 'not_company_financial_results';
    (reason ? rejected : kept).push(reason ? { ...event, rejection_reason: reason } : event);
  }
  return { kept, rejected };
}
