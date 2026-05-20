# Cairn Skill

Cairn stores project decisions, rejections, and constraints in `.cairn/`. Interact through MCP tools only.

## Required

Read and follow `protocol/core.md` — the runtime protocol for every technical session.

## Reference (consult when needed)

- `protocol/runtime-rules.md` — constraint processing, DNA, trauma, debt, stage, reevaluation, degraded mode
- `protocol/escalation-model.md` — challenge levels and response templates
- `protocol/tool-contracts.md` — parameter schemas and return values for all 16 tools
- `protocol/minimal-intervention.md` — when to skip lifecycle steps
- `protocol/reasoning-examples.md` — behavioral examples
- `compliance/anti-patterns.md` — common failure modes

## Initialization

If `cairn_init_status()` returns `not_initialized` / `empty_scaffold` / `partial`:

Steps in order: config → skeleton → blood → dna → stage.
For each: analyze → `dry_run: true` preview → user confirms → commit → check next.
Blood auto-confirms during init. DNA traits staged for human review.

## Review Queues

Never auto-accept. Both require human ratification:

- **Staged events**: `cairn_stage_list()` → present → `cairn_stage_accept/reject`
- **DNA candidates**: `cairn_dna_list()` → present → `cairn_dna_accept/reject`

## Diagnostics

- `cairn_status()` — system state snapshot
- `cairn_doctor()` — consistency validation (side effect: auto-resurrects G0/G1 archived events)

## Language

Signal details follow the project's existing language. Field names and tool parameters stay English.
