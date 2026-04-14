type: transition
domain: observability
decision_date: 2024-11
recorded_date: 2024-11
summary: Migrated observability from Prometheus/Grafana to OpenTelemetry → Datadog; unified traces, metrics, logs
rejected: Continuing with Prometheus + Grafana self-hosted stack — evaluated after a 4-hour
  production incident (2024-09: Redis memory saturation) revealed gaps: no correlated traces,
  Grafana alertmanager misconfiguration delayed PagerDuty notification by 23 minutes, and
  Prometheus retention policy had expired the relevant metrics window before the incident was
  fully diagnosed. Extending the self-hosted stack to add distributed tracing (Jaeger/Zipkin)
  would have required a new service deployment plus Grafana datasource integration. Evaluated
  Prometheus + Grafana + Jaeger as a unified stack but the operational surface (3 separate
  systems, 3 retention configs, 3 alert pipelines) was unmanageable at 1 platform-ops.
reason: Datadog provides correlated traces + metrics + logs in a single pane with a managed
  alertmanager and PagerDuty integration that works out of the box. The 2024-09 incident post-mortem
  showed that mean-time-to-diagnosis with correlated traces would have been ~20 minutes vs the
  actual 4 hours. At ~$800/month for Datadog, the cost is justified by on-call time savings alone.
  OpenTelemetry SDK is vendor-neutral — if we move away from Datadog, we change only the exporter.
revisit_when: Datadog costs exceed $3,000/month (current: ~$800/month) OR a dedicated SRE team
  (≥ 2) joins who prefer managing the self-hosted stack
