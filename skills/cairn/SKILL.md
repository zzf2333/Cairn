---
name: cairn
description: >-
  Cairn Cognitive Runtime Protocol. Activates for all technical sessions
  when cairn CLI is installed. Governs: context loading, plan
  validation, signal capture, observation before commits, session closure.
---

# Cairn Cognitive Runtime Protocol

Governs technical reasoning. Does NOT activate for trivial formatting, typos, pure explanation, or non-technical conversation.

## Lifecycle

Before technical reasoning:
  → Run: `cairn context --task "<task>" --json`

Before architecture decisions:
  → Run: `cairn plan --task "<task>" --json`

When explicit long-term cognition appears:
  → Run: `cairn signal --type <type> --what "<what>" [--domain <d>] [--reason "<r>"] --json`

Before commit or large structural change:
  → Run: `cairn observe --summary "<summary>" --json`

When task completes or topic changes:
  → Run: `cairn session-end --summary "<summary>" --json`

If `recovery_required` in context response:
  → Run: `cairn session-recover --json`
  → then re-run `cairn context`

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

---

# Reference

Cairn stores project decisions, rejections, and constraints in `.cairn/`. Interact through the `cairn` CLI.

## Consult when needed

Load these files when you need detailed guidance on a specific topic:

- `protocol/lifecycle.md` — detailed semantics for each lifecycle step, recovery procedures
- `protocol/escalation-model.md` — challenge levels, response templates, archived downgrade rules
- `protocol/runtime-rules.md` — constraint processing, DNA, trauma, debt, stage, reevaluation, degraded mode
- `protocol/minimal-intervention.md` — when to skip lifecycle steps
- `protocol/reasoning-examples.md` — behavioral examples showing correct lifecycle execution
- `compliance/anti-patterns.md` — common failure modes to avoid

## Initialization

If context returns `interaction_hint: "needs_init"`, the project needs initialization.
Run `cairn init` in the terminal, then follow the guided setup.

Steps in order: config → skeleton → blood → dna → stage.
Blood auto-confirms during init. DNA traits staged for human review.

## Review Queues

Never auto-accept. Both require human ratification:

- **Staged events**: `cairn review` → present to user → `cairn stage accept/reject`
- **DNA candidates**: `cairn dna list` → present to user → `cairn dna accept/reject`

## Diagnostics

- `cairn status` — system state snapshot
- `cairn doctor` — consistency validation (side effect: auto-resurrects G0/G1 archived events)

## Language

Signal details follow the project's existing language. Field names and tool parameters stay English.

## Degraded Mode

If `cairn` CLI is unavailable:

1. Read `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. These are auto-generated, read-only. Do not write to views.
3. Signal capture unavailable.

