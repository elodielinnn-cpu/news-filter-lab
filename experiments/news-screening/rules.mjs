// Event recognition and business scope are separate, editable inputs.
export const eventRules = [
  { type: '商业部署与供货', pattern: /\b(?:has deployed|have deployed|are running|is running|started shipping|now shipping|installed|deployed|brought .{0,100}\bcapacity online|went live)\b|已部署|正在运行|开始出货|已安装|已上线/iu },
  { type: '新品与平台方案', pattern: /\b(?:showcas(?:es|ed|ing)|unveil(?:s|ed|ing)?|debut(?:s|ed|ing)?|introduc(?:es|ed|ing)|launch(?:es|ed)?\s+.{0,90}\b(?:platform|solution|offering|product|service|system|server|module|camera)|announc(?:es|ed)\s+(?:a|an|the|its)\s+.{0,70}\b(?:solution|platform|offering)|reveal(?:s|ed|ing)?)\b|展示|推出|发布|亮相/iu },
  { type: '供应商与技术合作', pattern: /\b(?:collaborat(?:es|ed|ing|ion)|partner(?:s|ed|ing)? with|partnership with|signed a technology agreement|announc(?:es|ed)\s+.{0,70}\b(?:strategic agreement|collaboration|partnership)|added?\s+.{0,50}\bto (?:its|the) partner network)\b|达成合作|联合开发|开展合作/iu },
  { type: '供应商变化', pattern: /\b(?:select(?:s|ed|ing)?|replac(?:es|ed|ing)|switch(?:es|ed|ing)?|add(?:s|ed|ing)?|expand(?:s|ed|ing)?)\b.{0,90}\b(?:suppliers?|manufacturing partners?|partnerships?|sourcing)\b|\b(?:suppliers?|manufacturing partners?)\b.{0,70}\b(?:selected|replaced|added|changed)\b|(?:新增|更换|替换|选定|扩大).{0,30}(?:供应商|制造伙伴|供应合作)/iu },
  { type: '订单与产能', pattern: /\b(?:expand(?:s|ed|ing)?|increas(?:es|ed|ing)|relocat(?:es|ed|ing)|transfer(?:s|red|ring)?|start(?:s|ed|ing)?|begin(?:s|ning)?|began)\b.{0,90}\b(?:production|capacity|factory|manufacturing)\b|\b(?:secur(?:es|ed)|sign(?:s|ed))\b.{0,90}\b(?:orders?|supply agreement|purchase contract)\b|\b(?:entered|enters) (?:mass|volume) production\b|扩产|开始量产|进入量产|产能迁移|新增产能|(?:获得|签署|新增).{0,20}(?:订单|供货协议)/iu },
  { type: '并购与投资', pattern: /\b(?:acquir(?:e[sd]?|ing)|acquisition of|merge[sd]? with|invest(?:s|ed|ing)? in|investment in)\b|(?:收购|并购|投资建设)/iu },
  { type: '需求与成本变化', pattern: /\b(?:shipments?|sales|demand|costs?|prices?|revenue)\b.{0,70}\b(?:rose|fell|up|down|grow\w*|declin\w*|increas\w*|decreas\w*|ris\w*|drop\w*)\b|(?:出货|销量|需求|成本|价格|营收).{0,30}(?:增长|下降|提高|降低|上涨|下跌)/iu },
  { type: '技术与制造变化', pattern: /\b(?:adopt(?:s|ed|ing)?|replac(?:es|ed|ing)|redesign(?:s|ed|ing)?|upgrad(?:es|ed|ing)|improv(?:es|ed|ing)|reduc(?:es|ed|ing)|increas(?:es|ed|ing)|revis(?:es|ed|ing)|switch(?:es|ed|ing)? to|introduc(?:es|ed|ing)|now features|validat(?:es|ed|ing)|adopting)\b|采用|替换|重新设计|升级|改进|降低|提高|修订|改用|完成验证/iu },
  { type: '政策与供应风险', pattern: /\b(?:impos(?:es|ed|ing)|rais(?:es|ed|ing)|lift(?:s|ed|ing)?|restrict(?:s|ed|ing)?|halt(?:s|ed|ing)?|recall(?:s|ed|ing)?)\b.{0,80}\b(?:tariffs?|exports?|production|components?|products?)\b|(?:加征|取消).{0,20}关税|出口管制|供应中断|停产|召回/iu }
];

export const hardwareDetails = /\b(?:hardware|design|architecture|material|connector|antenna|module|manufacturing|assembly|yield|cooling|busbar|rack|interconnect|optical|power|bandwidth|voltage|thermal|sensors?|cameras?|steering|braking|harness|gateway|sensing|chassis)\b|硬件|结构|材料|连接器|天线|模组|制造|工艺|组装|良率|散热|机柜|互连|带宽|供电|线束|制动|转向|底盘|座舱|传感器|车载摄像头/iu;
export const softwareOnly = /\b(?:subscription|tokens?|spending limits?|allowances?|screensaver|video game|app store)\b|订阅|额度|屏保|游戏攻略/iu;
export const impactRelation = /\b(?:requires?|necessitates?|forces?|drives?|affects?|impacts?|due to|because|in response to|result(?:s|ing)? in|lead(?:s|ing)? to|enables?|reduces?|increases?|limits?|lockstep|therefore|hence)\b|要求|需要|迫使|推动|影响|由于|因此|导致|带来|降低|提高|限制|相应调整/iu;
export const speculativeImpact = /\b(?:could|might|may|potentially|possibly)\b|可能|或将|有望/iu;

export const nonIndustryTitle = /\b(?:how to|installation guide|setup guide|running local LLMs|getting started with)\b|\b(?:hands[ -]on|installing)\b.{0,60}\b(?:software|Ollama|LLMs?|Windows|Linux)\b|使用教程|安装指南|配置教程|开箱|优惠券|限时促销/iu;
