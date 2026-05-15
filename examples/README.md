# Cairn Examples

| Example | Project type | Blood events | Stage | Key demo |
|---|---|---|---|---|
| [`saas-18mo/`](saas-18mo/) | 18-month SaaS product | 3 events | growth | Full V3 structure: skeleton, blood, DNA, domains, views |

### saas-18mo

A 2-person SaaS at the `growth` stage. Complete `.cairn/` directory demonstrating V3 architecture:

- **Skeleton**: 3 domain nodes (api-layer, auth, state-management) with ownership boundaries
- **Blood events**: Zustand migration (transition), tRPC rejection (no-go), auth debt acceptance
- **DNA**: Emergent personality — high simplicity_bias, low infra_aggressiveness
- **Domain capillaries**: Rejected paths (tRPC in api-layer), accepted debt (session cleanup in auth)
- **Auto-generated views**: `output.md` with no-go/stack/debt, 3 domain summaries, stage advisory
- **Config + State**: V3 config with cognitive_mode, state with stage snapshot
- **Governance**: Standard cognitive mode policy

```
saas-18mo/.cairn/
├── config.yaml
├── state.yaml
├── skeleton/
│   ├── api-layer.yaml
│   ├── auth.yaml
│   └── state-management.yaml
├── blood/
│   ├── evt_zustand_migration.yaml
│   ├── evt_trpc_rejection.yaml
│   └── evt_auth_debt.yaml
├── dna/
│   └── identity.yaml
├── domains/
│   ├── api-layer/rejected_paths.yaml
│   └── auth/accepted_debt.yaml
├── governance/
│   └── policy.yaml
├── views/
│   ├── output.md
│   ├── stage.md
│   └── domains/
│       ├── api-layer.md
│       ├── auth.md
│       └── state-management.md
├── staged/
├── signals/
│   ├── raw_git/
│   ├── raw_calibration/
│   └── raw_conversation/
└── sessions/
```
