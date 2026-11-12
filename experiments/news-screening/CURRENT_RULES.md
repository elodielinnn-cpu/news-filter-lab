# 当前新闻筛选规则（2026-11-12）

## 两条实际存在的流程

| 流程 | 入口 | 当前作用 | 是否使用 AI |
| --- | --- | --- | --- |
| 每日云端抓取 | `.github/workflows/collect.yml` → `collect.py` → `rules.json` | 读取 RSS，主要按标题、摘要和少量正文关键词写入 `results/` | 否 |
| 两项业务试验 | `experiments/news-tagging/fetch-fresh.mjs` → `experiments/news-screening/screen.mjs` | 抓取正文，按汽车和通信／数据中心知识库输出入选、待定、排除及证据；不发布到网站 | 否 |

每日流程仍是旧实现：`rules.json` 包含消费电子，`collect.py` 没有使用两项业务知识库、事件证据门或主事件字段。不能把本次试验结果说成网站已采用的规则。`experiments/news-tagging/` 的 Qwen 打标是另一条独立的云端影子试验；本次 30 篇程序初筛没有调用它。

## 两项业务程序规则的执行顺序

1. **范围门**：只考虑汽车及通信／数据中心。标题命中手机、耳机、笔记本、游戏等消费电子词的文章直接排除；教程、安装指南和促销标题也排除。标题没有领域词时，才看摘要及正文前三段。定义在 `scope.mjs`。
2. **变化门**：从正文句子中找具体动作，分为部署供货、新品方案、合作、换供、订单产能、投资、需求成本、技术制造、政策风险等。只在标题／摘要发现线索而正文没有证实时，标为待定；正文不可读也标为待定，不把缺失内容当成已验证事实。定义在 `rules.mjs` 和 `screen.mjs`。
3. **对象与业务门**：先确定发生变化的对象，再在同句、相邻指代句或有明确因果的后文里寻找知识库产品。汽车和通信／数据中心产品来自 `config/luxshare-business-profile.json`，另补充公司介绍中有证据的产品。直接产品有明确变化可入选；上游或邻近产品须有正文明确影响到直接产品的链条，否则待定或排除。客户名称、GPU 名称或文章别处出现的产品词不能单独证明立讯供货。定义在 `scope.mjs` 和 `screen.mjs`。
4. **确定性门**：传闻、推测及含糊影响不自动入选，保留待定与证据。输出中的 `affectedProducts` 是业务范围匹配，**不是**已确认的客户或供应关系。

这套程序目前只给 `入选／待定／排除` 和首个命中的事件类型；没有真正的首页排序、完整去重和稳定的“整篇主要事件”提取。`入选` 也不等于现在就应登首页，还要考虑新闻价值、重复报道和发布时间。

## 本次 30 篇试跑口径

公开 RSS 与新闻归档形成的未重复候选清单位于 `experiments/news-tagging/sample-sources-2026-11-12.json`。39 个候选均抓到正文；从中选全部 4 篇入选、12 篇待定及 14 篇排除，构成 30 篇对照。程序输出和 AI 复核 CSV 保存在 `outputs/news-tagging/`（本地忽略目录）。AI 复核查阅导语、前几段及程序命中的证据，回答“按披露时价值是否进首页”和“主要事件是什么”；这不是同一批的独立人工标准答案，也不改变线上结果。

可复跑的程序命令：

```sh
NEWS_TAGGING_SOURCES=experiments/news-tagging/sample-sources-2026-11-12.json \
NEWS_TAGGING_MIN_ARTICLES=30 \
NEWS_TAGGING_FETCH_OUTPUT=outputs/news-tagging/fresh-2026-11-12.json \
node experiments/news-tagging/fetch-fresh.mjs
```

输出路径单独指定，避免覆盖已有的 `fresh-batch.json`。运行抓取需要联网；本地运行只用于验证，定时抓取仍应在云端。
