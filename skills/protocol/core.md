# Cairn Runtime Core

Governs technical reasoning. Does NOT activate for trivial formatting, typos, pure explanation, or non-technical conversation.

## Lifecycle

Before technical reasoning:
  → `cairn context --task "<task>" --json`

Before architecture decisions:
  → `cairn plan --task "<task>" --json`

When explicit long-term cognition appears:
  → `cairn signal --type <type> --what "<what>" --json`

Before commit or large structural change:
  → `cairn observe --summary "<summary>" --json`

When task completes or topic changes:
  → `cairn session-end --summary "<summary>" --json`

If `recovery_required`:
  → `cairn session-recover --json` then `cairn context` again

No context = no technical recommendation.

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
