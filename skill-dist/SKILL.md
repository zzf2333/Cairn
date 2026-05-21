---
name: cairn
description: >-
  Cairn Cognitive Runtime Protocol. Activates for all technical sessions.
  Governs: context loading, plan validation, signal capture, observation
  before commits, session closure. Script-backed — runs via CLI.
---

# Cairn Cognitive Runtime Protocol

Governs technical reasoning. Does NOT activate for trivial formatting, typos, pure explanation, or non-technical conversation.

## Lifecycle

Before technical reasoning:
  → Run: `node scripts/cairn-context.js --task "<task>"`

Before architecture decisions:
  → Run: `node scripts/cairn-plan.js --task "<task>"`

When explicit long-term cognition appears:
  → Run: `node scripts/cairn-signal.js --type <type> --what "<what>" [--domain <d>] [--reason "<r>"]`

Before commit or large structural change:
  → Run: `node scripts/cairn-observe.js --summary "<summary>" [--candidates-file <path>]`

When task completes or topic changes:
  → Run: `node scripts/cairn-session-end.js --summary "<summary>" [--domains <d1,d2>]`

If `recovery_required` in context response:
  → Run: `node scripts/cairn-session-recover.js`
  → then re-run `cairn-context.js`

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

# Signal Types

| Conversation Pattern | --type value |
|---|---|
| User rejects your suggestion with a reason | `user_rejection` |
| User references past attempt ("we tried X before") | `historical_reference` |
| User states a constraint ("we never use Redis") | `constraint_declaration` |
| A significant technical decision is made | `decision` |
| Technical debt explicitly accepted | `debt_acceptance` |
| User says "not in this phase" / "not now" | `stage_constraint` |

When NOT to signal:
- Routine bug fixes, formatting, documentation edits
- Vague statements without clear constraint implications
- Information already captured in a previous signal this session

---

# Reference

Cairn stores project decisions, rejections, and constraints in `.cairn/`. Scripts call the `cairn` CLI under the hood.

## Consult when needed

Load these files when you need detailed guidance on a specific topic:

- `skills/protocol/lifecycle.md` — detailed semantics for each lifecycle step, recovery procedures
- `skills/protocol/escalation-model.md` — challenge levels, response templates, archived downgrade rules
- `skills/protocol/runtime-rules.md` — constraint processing, DNA, trauma, debt, stage, reevaluation
- `skills/protocol/minimal-intervention.md` — when to skip lifecycle steps
- `skills/protocol/reasoning-examples.md` — behavioral examples showing correct lifecycle execution

## Initialization

If context returns `interaction_hint: "needs_init"`, the project needs initialization.
Run `cairn init` in the terminal, then follow the guided setup.

## Review Queues

Never auto-accept. Both require human ratification:

- **Staged events**: `cairn review` → present to user → `cairn stage accept/reject`
- **DNA candidates**: `cairn dna list` → present to user → `cairn dna accept/reject`

## Diagnostics

- `cairn status` — system state snapshot
- `cairn doctor` — consistency validation

## Language

Signal details follow the project's existing language. Field names and tool parameters stay English.

## Degraded Mode

If `cairn` CLI is unavailable:

1. Read `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. These are auto-generated, read-only. Do not write to views.
3. Signal capture unavailable.
