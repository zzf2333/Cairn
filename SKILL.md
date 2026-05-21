---
name: cairn
description: >-
  Cairn Cognitive Runtime Protocol. Activates for all technical sessions
  when cairn MCP server is connected. Governs: context loading, plan
  validation, signal capture, observation before commits, session closure.
---

# Cairn Cognitive Runtime Protocol

Governs technical reasoning. Does NOT activate for trivial formatting, typos, pure explanation, or non-technical conversation.

## Lifecycle

Before technical reasoning:
  → `cairn_context()`

Before architecture decisions:
  → `cairn_plan()`

When explicit long-term cognition appears:
  → `cairn_signal()`

Before commit or large structural change:
  → `cairn_observe()`

When task completes or topic changes:
  → `cairn_session_end()`

If `recovery_required`:
  → `cairn_session_recover()` then `cairn_context()` again

No `cairn_context` = no technical recommendation.

## Constraints

Respect ALL returned constraints for the entire session:
- `no_go` — never suggest these directions
- `accepted_debt` — do not fix; work within
- `stage_constraints` — adjust aggressiveness to project phase
- `challenges` — respond per level below

## Challenges

- `suggestion` — acknowledge; may proceed
- `reflective_challenge` — MUST justify in writing why history no longer applies
- `hard_constraint` — do NOT proceed; inform user
- `trauma` — acknowledge history explicitly; extra caution
- `archived` — downgraded one level; still surface reasoning

## Two Rules

Do not silently ignore historical cognition. Capture it.
Do not treat historical cognition as immutable truth. Prefer reevaluation over dogma.

---

# Reference

Cairn stores project decisions, rejections, and constraints in `.cairn/`. Interact through MCP tools only.

## Consult when needed

Load these files when you need detailed guidance on a specific topic:

- `skills/protocol/lifecycle.md` — detailed semantics for each lifecycle step, recovery procedures
- `skills/protocol/tool-contracts.md` — parameter schemas and return values for all 16 tools
- `skills/protocol/escalation-model.md` — challenge levels, response templates, archived downgrade rules
- `skills/protocol/runtime-rules.md` — constraint processing, DNA, trauma, debt, stage, reevaluation, degraded mode
- `skills/protocol/minimal-intervention.md` — when to skip lifecycle steps
- `skills/protocol/reasoning-examples.md` — behavioral examples showing correct lifecycle execution
- `skills/compliance/anti-patterns.md` — common failure modes to avoid

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

## Degraded Mode

If MCP tools unavailable:

1. Read `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. These are auto-generated, read-only. Do not write to views.
3. Signal capture unavailable.

When `cairn_*` tools fail:

1. Ask user to run `cairn doctor` — if CLI errors, install is broken
2. If CLI works but MCP doesn't, check `.claude/mcp.json` config
3. If MCP runs but returns path errors, set `CAIRN_ROOT` in env
