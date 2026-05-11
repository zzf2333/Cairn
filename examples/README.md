# Cairn Examples

## v2 Examples

| Example | Project type | Memory entries | Stage | Key demo |
|---|---|---|---|---|
| [`saas-18mo-v2/`](saas-18mo-v2/) | 18-month SaaS product | 4 entries (YAML) | growth | Full v2 structure: memory, views, config, state, session record |

### saas-18mo-v2

A 2-person SaaS at the `growth` stage. Complete v2 `.cairn/` directory demonstrating:

- **4 structured YAML memory entries**: state management transition (Zustand over Redux), tRPC rejection, auth coupling debt, growth stage transition
- **Auto-generated views**: `output.md` with no-go/stack/debt, 3 domain summaries, stage advisory
- **Config + State**: `config.yaml` with trust policy, `state.yaml` with stage snapshot
- **Session record**: example session in `sessions/`
- **Empty signal/staged pools**: `signals/` and `staged/` with `.gitkeep`

```
saas-18mo-v2/.cairn/
├── config.yaml
├── state.yaml
├── memory/
│   ├── mem_2023_03_state_mgmt_zustand.yaml
│   ├── mem_2023_09_trpc_rejection.yaml
│   ├── mem_2024_01_auth_debt.yaml
│   └── mem_2024_09_growth_stage.yaml
├── views/
│   ├── output.md
│   ├── stage.md
│   └── domains/
│       ├── api-layer.md
│       ├── auth.md
│       └── state-management.md
├── signals/
├── staged/
└── sessions/
    └── sess_2024_09_15.yaml
```

---

## v1 Examples (Legacy)

These examples use the v1 three-layer Markdown format. Kept as reference for v1 → v2 migration.

| Example | Project type | History entries | Stage | Key demo |
|---|---|---|---|---|
| [`saas-18mo/`](saas-18mo/) | 18-month SaaS product | 4 entries | early-growth | Basic three-layer structure; state management + auth decisions |
| [`api-service-2yr/`](api-service-2yr/) | 2-year API service | 9 entries | scale | Multiple rejections; accepted debt with `revisit_when`; stale domain |

Each v1 example has a Chinese mirror (`-zh/` suffix).
