---
domain: observability
hooks: ["observability", "metrics", "tracing", "logging", "OTel", "Datadog", "alert", "monitor"]
updated: 2024-11
status: stable
---

# observability

## current design

OpenTelemetry SDK (Node.js) for traces and metrics, exported to Datadog via OTLP. Structured JSON logging via pino, correlated to traces using trace-id injection. Three dashboards: API latency (SLO: P99 < 200ms), error rate (SLO: < 0.5% over 5min), and DB query time (SLO: P95 < 50ms). Alerts fire to PagerDuty on SLO breach for > 3 consecutive minutes.

## trajectory

2022-12 console.log + manual Cloudwatch queries — single service
2023-01 Added structured pino logging → searchable in Cloudwatch
2023-06 First production incident (DB pool exhaustion) — no metrics → added custom Prometheus-format metrics, scraped by Grafana
2023-11 Evaluated Datadog vs Grafana stack → chose Datadog
2024-11 Migrated from Prometheus/Grafana to OpenTelemetry → Datadog → current state

## rejected paths

- Prometheus + Grafana self-hosted: evaluated as a cost-saving measure vs Datadog. Grafana stack requires dedicated ops effort for HA, retention policies, and alertmanager config. At team size 6 with 1 platform-ops, Datadog SaaS is worth the ~$800/month cost to avoid operational overhead.
  Re-evaluate when: dedicated SRE team (≥ 2) or Datadog costs exceed $3,000/month
- Custom structured logging only (no traces): evaluated as "good enough" after adding pino. Correlated traces dramatically reduced mean-time-to-diagnosis on the 2023-06 incident from ~4 hours to ~20 minutes. The investment in OTel was validated by this incident.
  Re-evaluate when: never — correlated traces are load-bearing for on-call response

## known pitfalls

- Do NOT add high-cardinality labels to metrics (e.g., user-id, request-id as dimensions) — Datadog custom metrics are billed per unique timeseries. High-cardinality labels have caused $2,000+ bill spikes in two past incidents.
- Do NOT log PII (email, phone, full name) in structured logs — logs are retained for 90 days and are searchable by all engineers. Scrub at ingestion point, not at query time.
- Trace sampling is at 20% for normal traffic, 100% for error spans. Do NOT set sampling to 100% globally — at 3M req/day this would exceed Datadog's ingest quota by ~15×.

## open questions

- Real User Monitoring (RUM) for frontend — currently no visibility into client-side errors
- SLO alerting on DB query time is P95, not P99 — may miss tail latency issues for specific queries
