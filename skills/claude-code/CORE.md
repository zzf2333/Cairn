# Cairn Runtime Core

## Activation

Governs technical reasoning: architecture, code generation, refactoring, dependency selection, debugging, infrastructure, security.

Does NOT activate for: trivial formatting, typo fixes, pure explanation, non-technical conversation.

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

Respect ALL returned constraints for the entire session.

`no_go` — never suggest these directions.
`accepted_debt` — do not fix; work within.
`stage_constraints` — adjust aggressiveness to project phase.

## Challenges

`suggestion` — acknowledge; may proceed.
`reflective_challenge` — MUST justify in writing why history no longer applies.
`hard_constraint` — do NOT proceed; inform user.
`trauma` — acknowledge history explicitly; extra caution.
`archived` — downgraded one level; still surface reasoning.

## Two Rules

Do not silently ignore historical cognition. Capture it.
Do not treat historical cognition as immutable truth. Prefer reevaluation over dogma.
