# Cairn Runtime Core

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
