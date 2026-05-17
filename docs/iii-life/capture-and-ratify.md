# Capture and Ratify

> Cognition starts as noise. Most of it stays noise. The interesting work is the filter, not the capture.

---

## The shape of the loop

```
Raw signal              →    Filtered signal           →   Durable cognition
(everything possible)        (TrustRouter consents)        (human ratified)

  cairn_signal()                  staged/                       blood/
  GitEar scan                  (or dropped)                  audit.yaml
  CalibrationEar
```

Three sources flow in. One central gate filters. Two destinations exit: discarded (with an audit trail) or held for ratification (with the AI ready to consume immediately on next read, but explicitly marked as un-ratified until a human signs).

This page walks the loop end-to-end.

---

## Where signals come from

### Conversation signals (`cairn_signal`)

The Host AI watches the human's words during normal coding conversation and calls `cairn_signal` when a pattern matches. The skill protocol enumerates the patterns:

| Conversation looks like | signal_type |
|------------------------|-------------|
| "I don't think we should use X" + reason | `user_rejection` |
| "We tried X 6 months ago, didn't fit" | `historical_reference` |
| "We never use X" | `constraint_declaration` |
| "Let's go with X" + reasoning | `decision` |
| "Yeah, X is messy, but we'll fix it post-MVP" | `debt_acceptance` |
| "Not now, we're focused on stability" | `stage_constraint` |

The AI does **not** signal: routine bug fixes, formatting, vague statements, duplicates within session, implementation details. Over-signaling is as bad as under-signaling.

### Git signals (`GitEar`)

At `cairn_session_end`, `GitEar` scans commits since the previous session's anchor. It looks for:

- **Reverts** — `Revert "feat: ..."` patterns suggest a tried-and-rejected direction
- **Refactors** — `refactor: ...` suggests a corrected approach
- **Features** with high churn — frequent edits after merge suggest the original feat was contested

These produce conservative signals — git history is signal-poor compared to conversation. But it catches what the AI forgot to capture in real time.

### Calibration signals (`CalibrationEar`)

On `cairn_session_end`, `CalibrationEar` runs four checks comparing code to cognition:

1. **no_go_violation** — Blood says "don't do X"; the code now does X
2. **skeleton_drift** — files have moved between domains compared to skeleton declarations
3. **debt_resolution** — accepted_debt items have been silently paid down
4. **dna_drift** — recent activity contradicts a stable DNA trait

Each emits a signal that flows back through TrustRouter. Cognition that has been silently resolved gets archived; cognition that has been silently violated raises new staged events.

---

## The TrustRouter pass

Every signal — from any of the three sources — passes through TrustRouter:

```
incoming signal
  ↓
1. Dedup       → already in Blood? merge instead.
  ↓
2. Governance  → below the auto-confirm floor? confirm directly.
  ↓
3. Trauma      → near a trauma domain? +1 gravity.
  ↓
4. DNA         → trait applies? modulate ±1 gravity.
  ↓
5. Destination → final gravity selects: dropped | blood (auto) | staged.
```

Full mechanics in [`../iv-self/trust-router.md`](../iv-self/trust-router.md). The relevant fact for this page: **most signals end in `staged`**, not `blood`. Auto-confirmation is the exception, not the default — even in `lightweight` mode, only G1 events auto-confirm. Anything with weight pauses for a human.

---

## What "staged" feels like

When a signal lands in `staged`, the AI **can already see it** on the next `cairn_context` call (it shows up under `pending` in the context output). The AI is expected to inform the user that there's something waiting.

A typical staged entry:

```yaml
id: "evt_pending_042"
draft_event:
  # ... the full 40-field Evolution Event, ready to promote ...
review_status: "pending"
routing_reason: "DNA simplicity_bias raised gravity to G2; needs human ratification"
gravity: "G2"
governance_required: "human_ratified"
created_at: "2026-05-17T10:00:00Z"
```

The `routing_reason` is the receipt — the human reviewer sees exactly *why* TrustRouter chose to stage this rather than auto-confirm it. That makes the review honest: "the system thinks this is G2 because the project's simplicity_bias trait raised it from G1."

---

## The ratification act

`cairn_stage_accept({ id })` is the load-bearing call. It:

1. Validates the staged entry against EvolutionEvent schema
2. Promotes the `draft_event` to `.cairn/blood/<id>.yaml`
3. Removes the staged file
4. Triggers BloodEngine to re-derive affected capillaries
5. Triggers ViewsEngine to regenerate views
6. Appends to `audit.yaml`: `{ actor: user, action: stage_accept, target: <id> }`

The promotion is atomic at the file level (write + rename) but spans multiple files; corruption mid-promote would leave inconsistent state. `cairn doctor --fix` handles that case — see [`../v-intervene/tend.md`](../v-intervene/tend.md).

`cairn_stage_reject({ id, reason })` is just as load-bearing. The reason is recorded so the same signal arriving next month dedups against the rejection:

```yaml
- ts: "2026-05-17T10:00:00Z"
  actor: "user"
  action: "stage_reject"
  target: "evt_pending_042"
  detail: "premature — too narrow a basis to capture as project-wide"
```

Reject is data, not refusal.

---

## What makes this loop different from "just file an issue"

- **No friction.** Capture happens in conversation. The AI's `cairn_signal` call doesn't interrupt the user.
- **Pre-filtered.** TrustRouter discards obvious noise before it ever reaches a human.
- **Structured by design.** What lands in `staged` has the same schema as what lands in `blood` — the human reviewer is approving the *final form*, not draft prose.
- **Auditable.** Every transition is logged. "Why did this enter Blood" has a SQL-shaped answer.
- **Idempotent.** Duplicate signals merge. The same rejection captured twice doesn't create two rejections.

A bug tracker collects, prioritizes, and forgets. This loop collects, *filters*, and *durably encodes*.

---

## Failure modes

- **Capture silence** — AI doesn't call `cairn_signal` despite the protocol asking for it. Dogfood findings (`tests/scenarios/_findings.md`) and the reverse-regression suite (`tests/scenarios/`) are the early-warning system.
- **Staged accumulation** — humans don't ratify. Mitigation: surface count in `cairn doctor --metrics`, mode-tune to reduce staging volume, consider batching review at session_end.
- **Premature promotion** — humans accept without reading. Mitigation: `routing_reason` makes the receipt visible; `dna_reject` rate per reviewer is a soft signal of carefulness.

---

## See also

- [`../iv-self/trust-router.md`](../iv-self/trust-router.md) — the filter mechanics
- [`decay-and-resurrection.md`](./decay-and-resurrection.md) — what happens to Blood events over time
- [`../v-intervene/protocol.md`](../v-intervene/protocol.md) — the rules the Host AI follows for when to signal
- [`../ii-anatomy/governance.md`](../ii-anatomy/governance.md) — the three-tier ladder this loop traverses
