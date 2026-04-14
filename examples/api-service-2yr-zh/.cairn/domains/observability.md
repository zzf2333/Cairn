---
domain: observability
hooks: ["observability", "metrics", "tracing", "logging", "OTel", "Datadog", "alert", "monitor", "可观测性", "监控", "追踪", "日志", "告警"]
updated: 2024-11
status: stable
---

# observability

## current design

使用 OpenTelemetry SDK（Node.js）采集 traces 和 metrics，通过 OTLP 导出至 Datadog。结构化 JSON 日志由 pino 输出，通过 trace-id 注入与 traces 关联。三个仪表板：API 延迟（SLO：P99 < 200ms）、错误率（SLO：5 分钟内 < 0.5%）、数据库查询时间（SLO：P95 < 50ms）。SLO 连续违反 3 分钟触发 PagerDuty 告警。

## trajectory

2022-12 console.log + 手动 Cloudwatch 查询 — 单一服务
2023-01 新增 pino 结构化日志 → 可在 Cloudwatch 中搜索
2023-06 首次生产事故（数据库连接池耗尽）——无指标 → 新增自定义 Prometheus 格式指标，由 Grafana 抓取
2023-11 评估 Datadog vs Grafana 技术栈 → 选择 Datadog
2024-11 从 Prometheus/Grafana 迁移至 OpenTelemetry → Datadog → 当前状态

## rejected paths

- Prometheus + Grafana 自建：作为 Datadog 的成本节省方案评估。Grafana 技术栈需要专属运维人员处理高可用、数据保留策略和 alertmanager 配置。在团队规模 6 人仅 1 名平台运维的情况下，Datadog SaaS 的约 800 美元/月成本物有所值。
  Re-evaluate when: 有专属 SRE 团队（≥ 2 人），或 Datadog 费用超过 3,000 美元/月
- 仅结构化日志（无 traces）：在新增 pino 后作为"够用"方案评估。在 2023-06 事故中，关联 traces 将诊断时间从约 4 小时缩短至约 20 分钟。OTel 的投入已被这次事故验证。
  Re-evaluate when: 永不 — 关联 traces 对值班响应是承重支柱

## known pitfalls

- 禁止为 metrics 添加高基数标签（如用户 ID、request-id 作为维度）——Datadog 自定义指标按唯一时间序列计费。高基数标签已在两次事故中造成超 2,000 美元的账单峰值。
- 禁止在结构化日志中记录 PII（邮箱、电话、全名）——日志保留 90 天且所有工程师均可搜索。应在采集点脱敏，而非在查询时过滤。
- Trace 采样率：正常流量 20%，错误 span 100%。禁止将全局采样率设为 100%——在 300 万次请求/天的量级下会超出 Datadog 摄入配额约 15 倍。

## open questions

- 前端 RUM（Real User Monitoring）——当前对客户端错误无可见性
- 数据库查询时间 SLO 告警基于 P95 而非 P99 — 可能遗漏特定查询的尾延迟问题
