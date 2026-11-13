import crypto from "node:crypto";
import fs from "node:fs/promises";

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}+#./%-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsAlias(text, alias) {
  const normalizedText = normalizeText(text);
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;
  if (/^[\p{Script=Han}\d.+/-]+$/u.test(normalizedAlias)) {
    return normalizedText.includes(normalizedAlias);
  }
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(normalizedAlias)}(?=$|[^\\p{L}\\p{N}])`, "iu")
    .test(normalizedText);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function unique(values) {
  return [...new Set(values)];
}

export async function loadBusinessProfile(profilePath) {
  const profileText = await fs.readFile(profilePath, "utf8");
  const profile = JSON.parse(profileText);
  const products = profile.domains.flatMap((domain) => domain.products.map((product) => ({
    ...product,
    domainId: domain.domainId,
    domainName: domain.domainName
  })));
  return {
    profile,
    products,
    productsById: new Map(products.map((product) => [product.productId, product])),
    profileHash: sha256(profileText)
  };
}
const DATA_CENTER_OPTICAL_CONTEXT = /\b(?:data cent(?:er|re)|datacenter|server|rack|ethernet|infiniband|800g|1[.]6t|osfp|qsfp|cpo|optical transceiver)\b|数据中心|服务器|机柜|光收发|光模块|光通信/iu;
const CONSUMER_OPTICAL_CONTEXT = /\b(?:camera|lens|smartphone|iphone|ipad|wearable|consumer electronics|tof|vcsel)\b|摄像头|镜头|手机|消费电子|穿戴|光学模组/iu;
const AEC_CHIP_CONTEXT = /\b(?:aec dsp|retimer|signal[- ]conditioning ic|protocol[- ]aware retimer|alaska [ae])\b|有源电缆dsp|重定时器|信号重整芯片/iu;
const AEC_CABLE_CONTEXT = /\b(?:active electrical cables?|aec cables?|cable assembly|copper cables?)\b|有源电缆|有源电连接|线缆模组/iu;
const HIGH_SPEED_CABLE_CONTEXT = /\b(?:high[- ]speed|direct attach|active copper|active optical|data cent(?:er|re)|server|rack|ethernet|infiniband|gbps|tbps)\b.{0,80}\b(?:cable|interconnect)\b|\b(?:cable|interconnect)\b.{0,80}\b(?:high[- ]speed|data cent(?:er|re)|server|rack|ethernet|infiniband|gbps|tbps)\b|高速(?:铜缆|线缆|互连)|服务器线缆|数据中心线缆/iu;
const UNCONFIRMED_PACKAGING_CONTEXT = /\b(?:cowos|chiplet|2[.]5d|3d (?:semiconductor )?packaging|panel[- ]level packaging)\b|晶圆级系统整合封装|芯粒封装|2[.]5d封装|3d封装|面板级封装/iu;
const SIP_CONTEXT = /\b(?:sip|system[- ]in[- ]package|module packaging|micro[- ]assembly)\b|系统级封装|电子模组封装|微组装/iu;
const SUPPLY_RELATIONSHIP_EVIDENCE = /\b(?:supplier|supply agreement|manufacturing partner|contract manufacturer|production partner|awarded|selected to supply)\b|供应商|供货协议|制造伙伴|代工厂|获选供货|供应关系/iu;
const BUSINESS_IMPACT = /\b(?:interface|bandwidth|reach|latency|power efficiency|power consumption|cost|yield|manufactur|design|architecture|performance|demand|qualification|compatibility|bom)\b|接口|带宽|距离|延迟|功耗|成本|良率|制造|设计|架构|性能|需求|认证|兼容|物料清单/iu;
const UNRESOLVED_ADVANCED_PACKAGING = /\b(?:panel[- ]level (?:processing|packaging)|advanced semiconductor packaging)\b|面板级(?:加工|封装)|先进半导体封装/iu;
const UNRESOLVED_DATA_CENTER_INFRASTRUCTURE = /\b(?:high[- ]density ai infrastructure|factory[- ]built ai infrastructure|data[- ]center hardware update)\b|高密度AI基础设施|数据中心硬件更新/iu;

function contextExcerpt(text, alias, radius = 110) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  const index = normalizeText(normalized).indexOf(normalizeText(alias));
  if (index < 0) return normalized.slice(0, radius * 2);
  return normalized.slice(Math.max(0, index - radius), Math.min(normalized.length, index + String(alias).length + radius));
}

function resolveAmbiguousMatch(product, text) {
  if (product.productId === "optical_module") {
    return DATA_CENTER_OPTICAL_CONTEXT.test(text) && !CONSUMER_OPTICAL_CONTEXT.test(text);
  }
  if (product.productId === "consumer_optical_modules") {
    return CONSUMER_OPTICAL_CONTEXT.test(text) && !DATA_CENTER_OPTICAL_CONTEXT.test(text);
  }
  if (["aec_dsp", "retimer_chip"].includes(product.productId)) return AEC_CHIP_CONTEXT.test(text);
  if (product.productId === "active_electrical_cable") return AEC_CABLE_CONTEXT.test(text);
  if (["direct_attach_copper_cable", "active_copper_cable", "active_optical_cable"].includes(product.productId)) {
    return HIGH_SPEED_CABLE_CONTEXT.test(text);
  }
  if (["sip_packaging", "electronic_module_packaging", "micro_assembly"].includes(product.productId)) {
    return SIP_CONTEXT.test(text) && !UNCONFIRMED_PACKAGING_CONTEXT.test(text);
  }
  if (["chiplet_packaging", "cowos_packaging", "2_5d_3d_semiconductor_packaging"].includes(product.productId)) {
    return UNCONFIRMED_PACKAGING_CONTEXT.test(text);
  }
  return true;
}

function classifyProductRole(product, matchedAliases, text) {
  if (["aec_dsp", "retimer_chip"].includes(product.productId)) return "article_subject";
  if (product.productId === "active_electrical_cable" && AEC_CHIP_CONTEXT.test(text)) {
    return "related_luxshare_product";
  }
  if (product.relationshipLevel === "direct") return "article_subject";
  return "article_subject";
}

function findBoundImpactEvidence(text, subjectAliases, directAliases, radius = 520) {
  const normalized = normalizeText(text);
  for (const subjectAlias of subjectAliases) {
    const subject = normalizeText(subjectAlias);
    let subjectIndex = normalized.indexOf(subject);
    while (subjectIndex >= 0) {
      const start = Math.max(0, subjectIndex - radius);
      const end = Math.min(normalized.length, subjectIndex + subject.length + radius);
      const window = normalized.slice(start, end);
      if (BUSINESS_IMPACT.test(window) && directAliases.some((alias) => window.includes(normalizeText(alias)))) {
        return window;
      }
      subjectIndex = normalized.indexOf(subject, subjectIndex + subject.length);
    }
  }
  return "";
}

export function matchBusinessProfile(article, profileData) {
  const rawText = [
    article.title,
    article.summary,
    article.originalSummary,
    ...(Array.isArray(article.bodyEvidence) ? article.bodyEvidence : [])
  ].filter(Boolean).join("\n");
  const normalizedText = normalizeText(rawText);
  const matches = [];
  const trace = [];

  for (const product of profileData.products) {
    const aliases = unique([product.productName, ...(product.aliasesZh || []), ...(product.aliasesEn || [])]);
    const matchedAliases = aliases.filter((alias) => containsAlias(normalizedText, alias));
    if (!matchedAliases.length) continue;
    if (!resolveAmbiguousMatch(product, normalizedText)) {
      trace.push({ step: "ambiguous_alias_rejected", productId: product.productId, matchedAliases });
      continue;
    }
    const role = classifyProductRole(product, matchedAliases, normalizedText);
    matches.push({
      productId: product.productId,
      productName: product.productName,
      domainId: product.domainId,
      relationshipLevel: product.relationshipLevel,
      evidenceStatus: product.evidenceStatus,
      userConfirmedClassification: product.userConfirmedClassification?.classification || "unknown",
      productRole: role,
      matchedAliases,
      impactSupported: false,
      impactEvidence: "",
      evidence: contextExcerpt(rawText, matchedAliases[0])
    });
  }

  const addDerivedMatch = (productId, pattern, evidenceLabel) => {
    if (!pattern.test(normalizedText) || matches.some((match) => match.productId === productId)) return;
    const product = profileData.productsById.get(productId);
    if (!product) return;
    matches.push({
      productId: product.productId,
      productName: product.productName,
      domainId: product.domainId,
      relationshipLevel: product.relationshipLevel,
      evidenceStatus: product.evidenceStatus,
      userConfirmedClassification: product.userConfirmedClassification?.classification || "unknown",
      productRole: "article_subject",
      matchedAliases: [evidenceLabel],
      impactSupported: false,
      impactEvidence: "",
      evidence: contextExcerpt(rawText, normalizedText.match(pattern)?.[0] || evidenceLabel)
    });
    trace.push({ step: "specification_or_process_match", productId, evidenceLabel });
  };

  addDerivedMatch(
    "ai_rack_scale_integration",
    /\b(?:rack[- ]scale|full[- ]rack|factory[- ]built (?:ai )?(?:containers?|infrastructure|deployment)|(?:cpu|gpu|inference|ai|server)[ -]racks?|(?:nvl\d+|helios|supermicro|liquid[- ]cooled|ai|gpu|server).{0,70}racks?.{0,90}(?:systems?|deployment|running|anchor|integration|infrastructure|\d+\s*(?:kw|mw))|racks?.{0,90}(?:systems?|deployment|running|anchor|integration|infrastructure|\d+\s*(?:kw|mw)))\b|AI.{0,30}(?:整柜|机柜|工厂预制基础设施)|(?:整柜|机柜).{0,30}(?:AI|GPU|服务器)/iu,
    "AI/server rack-scale context"
  );
  addDerivedMatch(
    "server_complete_assembly",
    /\bserver\b.{0,240}\b(?:chassis|rack unit|airflow|cooling|two[- ]socket|2u|3u)\b|\b(?:chassis|rack unit|airflow|cooling|two[- ]socket|2u|3u)\b.{0,240}\bserver\b/iu,
    "physical server system design"
  );
  addDerivedMatch("cpu_chip", /\b(?:xeon|epyc|server cpu|vera cpu|central processing unit)\b|至强|霄龙|服务器处理器/iu, "CPU platform specification");
  addDerivedMatch("gpu_chip", /\b(?:instinct gpu|nvidia gpu|ai accelerator chip|graphics processing unit)\b|AI加速芯片|图形处理器/iu, "GPU/accelerator specification");
  addDerivedMatch("silicon_photonics_chip", /\bsilicon photonics?\b|硅光子?(?:技术|器件|芯片)/iu, "silicon photonics context");
  addDerivedMatch(
    "800v_dc_system",
    /(?:\b(?:data cent(?:er|re)s?|datacenter|server|rack)\b.{0,240}\b(?:800\s*v\s*dc|800vdc)\b|\b(?:800\s*v\s*dc|800vdc)\b.{0,240}\b(?:data cent(?:er|re)s?|datacenter|server|rack)\b)|(?:数据中心|服务器|机柜).{0,240}800\s*伏直流|800\s*伏直流.{0,240}(?:数据中心|服务器|机柜)/iu,
    "800V DC data-center power architecture"
  );

  const articleSubjects = matches.filter((match) => match.productRole === "article_subject");
  const relatedLuxshareProducts = matches.filter((match) => match.productRole === "related_luxshare_product");
  const relatedDirectAliases = relatedLuxshareProducts.flatMap((match) => {
    const product = profileData.productsById.get(match.productId);
    return [product?.productName, ...(product?.aliasesZh || []), ...(product?.aliasesEn || [])]
      .filter((alias) => normalizeText(alias).length > 3);
  });
  for (const subject of articleSubjects.filter((match) => ["upstream", "adjacent"].includes(match.relationshipLevel))) {
    subject.impactEvidence = findBoundImpactEvidence(rawText, subject.matchedAliases, relatedDirectAliases);
    subject.impactSupported = Boolean(subject.impactEvidence);
  }
  const unresolvedContexts = [];
  if (UNRESOLVED_ADVANCED_PACKAGING.test(normalizedText) && !articleSubjects.some((match) => match.domainId === "advanced_packaging")) {
    unresolvedContexts.push({
      contextId: "advanced_semiconductor_packaging",
      reason: "panel_level_process_does_not_prove_sip_or_wafer_level_capability",
      possibleRelatedProductIds: ["sip_packaging", "electronic_module_packaging", "micro_assembly"],
      evidence: contextExcerpt(rawText, normalizedText.match(UNRESOLVED_ADVANCED_PACKAGING)?.[0] || "panel-level packaging")
    });
  }
  if (UNRESOLVED_DATA_CENTER_INFRASTRUCTURE.test(normalizedText) && !articleSubjects.some((match) => match.relationshipLevel === "direct" && match.domainId === "ai_server_integration")) {
    unresolvedContexts.push({
      contextId: "data_center_infrastructure_scope",
      reason: "generic_infrastructure_evidence_does_not_identify_a_direct_product",
      possibleRelatedProductIds: ["ai_rack_scale_integration", "server_power_supply", "coolant_distribution_unit"],
      evidence: contextExcerpt(rawText, normalizedText.match(UNRESOLVED_DATA_CENTER_INFRASTRUCTURE)?.[0] || "data-center infrastructure")
    });
  }
  const brandSupplyInferenceAllowed = SUPPLY_RELATIONSHIP_EVIDENCE.test(normalizedText);
  trace.push({
    step: "brand_supply_guard",
    allowed: brandSupplyInferenceAllowed,
    reason: brandSupplyInferenceAllowed ? "explicit_supply_relationship_language" : "brand_name_is_not_supply_proof"
  });

  return {
    profileVersion: profileData.profile.profileVersion,
    profileHash: profileData.profileHash,
    articleSubjects,
    relatedLuxshareProducts,
    allMatches: matches,
    unresolvedContexts,
    brandSupplyInferenceAllowed,
    trace
  };
}
