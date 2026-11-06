import { containsAlias, matchBusinessProfile } from '../news-filter-v3/business-profile.mjs';

export const scopeVersion = 'datacom-automotive-v1';
export const domainNames = { datacom: '通信与数据中心', automotive: '汽车' };
const datacom = /\b(?:data[ -]?cent(?:er|re)s?|datacenter|servers?|rack(?:s|[ -]scale)?|NVL\d+|interconnect|optical|transceiver|CPO|ethernet|infiniband|telecom|5G network|mobile network|base station|RAN|radio access|hyperscalers?|Rubin|Blackwell|Helios|AI accelerator)\b|数据中心|服务器|机柜|互连|光模块|光通信|通信网络|基站|射频单元/iu;
const automotive = /\b(?:automotive|automakers?|vehicles?|EVs?|electric (?:cars?|SUVs?|trucks?)|wire harness|zonal architecture|ADAS|brake[ -]by[ -]wire|steer[ -]by[ -]wire)\b|汽车|整车|车载|线束|智能座舱|底盘|制动|转向|悬架/iu;
const consumer = /\b(?:iPhone|iPad|MacBook|iMac|HomePod|Apple TV|smartphones?|smartwatches?|earbuds?|headsets?|laptops?|gaming|XPS|OptiPlex|ThinkPad|ThinkBook|Zenbook|ROG|NUC|notebooks?|desktop PC|Dell Pro .{0,15}Micro|mini PC|home NAS|portable SSD|external SSD|e-?bikes?|power ?banks?|portable power|BLUETTI|EcoFlow|USB-C pruning|leaf blower|home batteries|home backup|Powerwall)\b|手机|耳机|笔记本|智能手表|充电宝|游戏|家用储能|户外电源|电动自行车/iu;
const profileDomains = {
  ai_server_systems: 'datacom', high_speed_interconnect: 'datacom', optical_communications: 'datacom',
  power_and_thermal: 'datacom', automotive_electronics: 'automotive'
};
const upstreamDomains = new Set(['semiconductor_and_memory_upstream']);
const aliases = {
  ai_rack_scale_integration: ['rack-scale system', 'rack-scale systems', 'NVL72', 'NVL144'],
  server_power_supply: ['PSUs', 'power shelf', 'power shelves', 'power module', '电源模块', '电源架'],
  coolant_distribution_unit: ['CDUs'],
  cold_plate: ['cold plates', 'direct-to-chip liquid cooling', '冷板'],
  busbar: ['busbars', '母排'],
  optical_module: ['optical transceivers', 'optical transceiver module', '光收发模块'],
  optical_engine: ['optical engines'],
  automotive_wire_harness: ['wiring harness', 'wiring harnesses', 'wire harnesses', '汽车线束'],
  automotive_high_voltage_connector: ['automotive connectors', '汽车连接器'],
  gpu_chip: ['GPUs'], cpu_chip: ['CPUs'], autonomous_driving_chip: ['ADAS processors', 'Snapdragon Ride']
};
// Product scope follows the supplied company overview. It makes no customer/volume assertion.
const presentationProducts = [
  ['datacom', 'dc_manifold', '液冷歧管', ['liquid manifold', 'coolant manifold', 'inner manifold', '液冷歧管', '内歧管'], 4],
  ['datacom', 'dc_mechanical', '机柜结构件', ['rear bracket', 'ID bezel', 'rack bracket', '机柜支架', '机柜结构件'], 4],
  ['datacom', 'dc_vapor_chamber', 'VC均热板', ['vapor chamber', '均热板'], 4],
  ['automotive', 'auto_braking', '制动系统', ['braking system', 'brake-by-wire', '制动系统', '线控制动'], 3],
  ['automotive', 'auto_steering', '转向系统', ['steering system', 'steer-by-wire', '转向系统', '线控转向'], 3],
  ['automotive', 'auto_suspension', '悬架系统', ['suspension system', 'active suspension', '悬架系统', '主动悬架'], 3],
  ['automotive', 'auto_cockpit', '智能座舱硬件', ['cockpit electronics', 'cockpit hardware', '智能座舱硬件'], 3],
  ['automotive', 'auto_control_architecture', '智能驾驶与座舱控制架构', ['central vehicle computers', 'central vehicle computer', 'vehicle control architecture', '中央计算架构'], 3],
  ['automotive', 'auto_sensing', 'ADAS与感知硬件', ['ADAS sensors', 'vehicle sensors', 'camera monitor system', 'digital cameras', '车载传感器', 'ADAS传感器'], 3]
].map(([domain, productId, productName, productAliases, page]) => ({
  domain, productId, productName, aliases: productAliases, relationshipLevel: 'direct',
  evidenceStatus: 'provided_company_overview', scopeEvidence: `Company overview English Oct 2026, slide ${page}`
}));

export function isConsumerStory(article) {
  const title = String(article.title || '');
  return consumer.test(title);
}

export function articleDomains(article) {
  if (isConsumerStory(article)) return [];
  const titleDomains = [datacom.test(article.title) && 'datacom', automotive.test(article.title) && 'automotive'].filter(Boolean);
  if (titleDomains.length) return titleDomains;
  const text = [article.summary, ...(article.bodyEvidence || []).slice(0, 3)].filter(Boolean).join(' ');
  const domains = [datacom.test(text) && 'datacom', automotive.test(text) && 'automotive'].filter(Boolean);
  if (domains.length) return domains;
  return ['datacom', 'automotive'].includes(article.sourceDomain) ? [article.sourceDomain] : [];
}

export function activeProducts(profile, domains = ['datacom', 'automotive']) {
  const products = profile.products.filter(product => {
    const domain = profileDomains[product.domainId];
    const relevantUpstream = upstreamDomains.has(product.domainId) || ['aec_dsp', 'retimer_chip', 'autonomous_driving_chip'].includes(product.productId);
    return domains.includes(domain) || relevantUpstream;
  }).map(product => ({
    ...product, domain: profileDomains[product.domainId] || domains[0],
    scopeEvidence: `business-profile ${profile.profile.profileVersion}: ${product.productId}`
  }));
  return [...products, ...presentationProducts.filter(product => domains.includes(product.domain))];
}

export function matchProducts(text, profile, domains) {
  const matches = matchBusinessProfile({ title: text }, profile).articleSubjects;
  const matchedIds = new Set(matches.map(product => product.productId));
  return activeProducts(profile, domains).filter(product => matchedIds.has(product.productId)
    || [...(aliases[product.productId] || []), ...(product.aliases || [])].some(alias => containsAlias(text, alias)));
}

export function productMention(text, product) {
  return [product.productName, ...(product.aliases || []), ...(product.aliasesEn || []), ...(product.aliasesZh || []), ...(aliases[product.productId] || [])]
    .some(alias => containsAlias(text, alias));
}
