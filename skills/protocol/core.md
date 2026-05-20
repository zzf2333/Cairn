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
