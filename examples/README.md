# Cairn Examples

Two complete three-layer `.cairn/` examples demonstrating different project shapes and histories.

| Example | Project type | History entries | Stage | Key demo |
|---|---|---|---|---|
| [`saas-18mo/`](saas-18mo/) | 18-month SaaS product | 4 entries (2023–2024) | early-growth | Basic three-layer structure; state management + auth decisions |
| [`api-service-2yr/`](api-service-2yr/) | 2-year API service | 9 entries (2023–2024) | scale | Multiple rejections; accepted debt with `revisit_when`; `cairn doctor` finds stale domain |

Each example ships with a Chinese mirror (`-zh/` suffix) using bilingual `hooks:` arrays.

## saas-18mo

A 2-person SaaS at the `early-growth` stage. Covers:
- State management transition (Zustand over Redux)
- tRPC experiment and rejection
- Accepted auth coupling debt
- Stage transition (MVP → early-growth)

```
saas-18mo/.cairn/
├── output.md                       (stage: early-growth, 3 no-go rules)
├── domains/api-layer.md            (stable, hooks-synced)
├── domains/auth.md                 (active, hooks-synced)
├── domains/state-management.md     (stable, hooks-synced)
└── history/                        (4 entries)
```

**Try it:**
```bash
cd examples/saas-18mo && cairn status
cd examples/saas-18mo && cairn doctor
```

## api-service-2yr

A 6-person API service at the `scale` stage. Designed to demonstrate:
- **6+ rejection-flavored entries** (GraphQL, Kong, Prisma, gRPC, Kafka, AWS API Gateway)
- **2 accepted debt entries** with explicit numeric `revisit_when` conditions (`RATE-GLOBAL-ONLY`, `SQL-NO-ORM`)
- **3 stage transitions** (Redis migration, Kong → middleware, Prometheus → Datadog)
- **Intentional stale domain**: `rate-limiting` has `updated: 2024-03` but history entries recorded in 2025-04 — `cairn doctor` flags it as stale

```
api-service-2yr/.cairn/
├── output.md                       (stage: scale, 5 no-go rules)
├── domains/api-gateway.md          (stable)
├── domains/rate-limiting.md        (active, intentionally stale — updated: 2024-03)
├── domains/observability.md        (stable)
├── domains/db-layer.md             (stable)
└── history/                        (9 entries, 2023-02 → 2024-12)
```

**Try it:**
```bash
cd examples/api-service-2yr && cairn status
cd examples/api-service-2yr && cairn doctor
# doctor will flag: rate-limiting stale, "microservices split" no-go unsupported
```
