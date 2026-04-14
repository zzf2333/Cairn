type: decision
domain: observability
decision_date: 2024-11
recorded_date: 2024-11
summary: 可观测性从 Prometheus/Grafana 迁移至 OpenTelemetry → Datadog；实现追踪、指标、
  日志统一
rejected: Prometheus + Grafana + Jaeger 自托管方案——2024-09 生产事故暴露出三系统分离
  架构的严重缺陷：告警延迟 23 分钟，MTTD（平均故障发现时间）长达 4 小时，追踪与
  指标无法关联，排查路径割裂。三套系统各自运维（Prometheus 告警规则、Grafana Dashboard、
  Jaeger 存储）对小团队负担过重，且跨系统跳转严重影响排查效率。
reason: Datadog 提供关联的追踪、指标和日志，统一的 Alertmanager 消除了告警延迟问题。
  OTel SDK 保持厂商中立，未来可切换后端而无需修改应用代码。迁移后消除了 3 套独立
  系统的运维负担，单一平台降低了事故排查的认知切换成本。
revisit_when: Datadog 月费超过 $2,000 且自托管方案在团队规模下具备可行的运维能力，
  或 OTel 生态出现成本更优的托管后端替代选项
