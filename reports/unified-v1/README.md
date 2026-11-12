# 两业务统一标签 v1 回放

本目录是 `news-filter-lab` 的离线程序对照，范围只有通信与数据中心、汽车电子；未推送到 GitHub，未启动模型。`holdout-input.json` 固定了 9 篇未参与调规则的原文，用于之后同输入对比指定模型，不能把历史 Codex 阅读当作 Qwen 输出。

`program-30`、`program-48`、`program-holdout-9` 各有 CSV 和 JSON。逐篇字段包括原判定、新判定、领域、主事件、阶段、主体、对象、原文段落和证据、业务关系、首页候选、资料质量与变更原因。旧结果仅作对照，不能自动算作标准答案。程序本身不发布网页；`homepageCandidate` 不是网站实际首页去向。

复跑命令（在本仓库根目录，需 Node 24）：

```sh
node experiments/news-screening/replay-unified.mjs outputs/news-tagging/review-30-2026-11-12.json reports/unified-v1/program-30.json
node experiments/news-screening/replay-unified.mjs outputs/news-screening/audit/4c92e2cb37ce/baseline.json reports/unified-v1/program-48.json
node experiments/news-screening/replay-unified.mjs reports/unified-v1/holdout-input.json reports/unified-v1/program-holdout-9.json
```

标签契约来自 `experiments/unified-tagging.mjs`，网站仓库有字节相同的副本。这个文件不是安装 `feeds.fun` 服务，也不会产生 API 费用；模型路径由 `experiments/news-tagging/` 的提示词与枚举准备，但本次没有调用。
