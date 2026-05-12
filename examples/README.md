# Cairn Examples

| Example | Project type | Memory entries | Stage | Key demo |
|---|---|---|---|---|
| [`saas-18mo/`](saas-18mo/) | 18-month SaaS product | 4 entries (YAML) | growth | Full structure: memory, views, config, state, session record |

### saas-18mo

A 2-person SaaS at the `growth` stage. Complete `.cairn/` directory demonstrating:

- **4 structured YAML memory entries**: state management transition (Zustand over Redux), tRPC rejection, auth coupling debt, growth stage transition
- **Auto-generated views**: `output.md` with no-go/stack/debt, 3 domain summaries, stage advisory
- **Config + State**: `config.yaml` with trust policy, `state.yaml` with stage snapshot
- **Session record**: example session in `sessions/`
- **Empty signal/staged pools**: `signals/` and `staged/` with `.gitkeep`

```
saas-18mo/.cairn/
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
