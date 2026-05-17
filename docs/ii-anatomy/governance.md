# Governance

> The final decision is always human. Everything before that is the system removing every reason humans had to skip the decision.

---

## What it is

**Governance** is the approval ladder. Every signal that enters Cairn passes through a 3-tier status progression:

| Tier | Set by | Meaning |
|------|--------|---------|
| **`agent_proposed`** | Host AI on `cairn_signal` call | "AI saw a signal worth capturing" |
| **`system_validated`** | TrustRouter | "Cairn's machinery agrees it's worth recording" — dedup'd, gravity-adjusted, trauma-checked, DNA-modulated |
| **`human_ratified`** | User via `cairn_stage_accept` (or auto, for low-gravity in lightweight mode) | "A human signed off; this is now durable cognition" |

Plus storage at `.cairn/governance/`:

- `policy.yaml` — the approval threshold per cognitive mode
- `audit.yaml` — append-only log of every accept / reject / drop

---

## Why governance is its own organ

A naive system would either:

1. **Auto-confirm everything** — cognition fills with noise, becomes worthless within weeks
2. **Require human review for everything** — review burden is unbearable, system gets bypassed

Cairn's response: **scale the threshold with the weight of the decision and with the project's chosen overhead tolerance**.

The first knob is gravity (see [`gravity.md`](./gravity.md)). The second is **`cognitive_mode`**:

| Mode | Governance threshold | Decay window | DNA min evidence | Audit detail |
|------|---------------------|--------------|------------------|--------------|
| `lightweight` | G3 only requires approval | 30 / 60 days | 5 | minimal |
| `standard` | G2+ requires approval | 90 / 120 days | 3 | medium |
| `institutional` | G1+ requires approval | 180 / 240 days | 3 | full |

Cognitive mode is **not** a function of project size. A 3-person side project can be `institutional` (high care). A 50-person company project can be `lightweight` (move fast, accept that some context is lost). It is a function of **how much governance overhead the team is willing to pay** in exchange for cognition durability.

---

## What `policy.yaml` actually contains

```yaml
cognitive_mode: "standard"
per_tool_overrides: {}      # reserved for 0.5+ — per-tool quotas
```

Minimal on purpose. The policy is mostly *derived* — from cognitive_mode, gravity, and trauma flags — rather than statically declared. This keeps the policy file small and rare-to-edit; the real intelligence is in TrustRouter.

---

## The audit log

`.cairn/governance/audit.yaml` is **append-only**. Every governance decision lands here:

```yaml
- ts: "2026-05-17T10:00:00Z"
  actor: "user"
  action: "stage_accept"
  target: "evt_pending_042"
  detail: "ratified into blood; promoted from staged"

- ts: "2026-05-17T10:05:00Z"
  actor: "user"
  action: "dna_reject"
  target: "stg_dna_infra_aggressiveness_..."
  detail: "premature — only 4 events, want more signal"

- ts: "2026-05-17T10:10:00Z"
  actor: "system"
  action: "drop_g0"
  target: "(transient)"
  detail: "duplicate of evt_087; merged"

- ts: "2026-05-17T10:15:00Z"
  actor: "system"
  action: "auto_confirm"
  target: "evt_125"
  detail: "G1, lightweight mode auto-confirms"
```

Three kinds of actor:

- **`user`** — explicit human ratification
- **`system`** — auto-confirm, auto-archive, dedup-merge, drop-G0
- **`AI`** — proposed via `cairn_signal` (visible at `agent_proposed` stage)

The audit log is **the receipt**. Anything that touched the project's cognition has a row here, forever. You can answer "why did this constraint enter Blood?" by reading the audit log row for the accept event.

---

## The three-tier path, end-to-end

A new constraint declaration in a `standard` mode project:

```
Host AI calls cairn_signal({
  signal_type: "constraint_declaration",
  details: { what: "no Redis", reason: "ops cost too high" }
})
  ↓
Stamped: governance_status = "agent_proposed"
  ↓
TrustRouter:
  - dedup → not a duplicate
  - gravity proposed: G2
  - trauma adjacency: no
  - DNA: simplicity_bias=high → +0 (already aligned)
  - final: G2
  - destination: staged (G2 needs human ratification in standard mode)
  ↓
Stamped: governance_status = "system_validated"
Written to: .cairn/staged/evt_pending_xxx.yaml
  ↓
User runs: cairn_stage_accept({ id: "evt_pending_xxx" })
  ↓
Stamped: governance_status = "ratified"
Promoted: .cairn/blood/evt_xxx.yaml
Audit log: { actor: "user", action: "stage_accept", target: "evt_pending_xxx" }
Capillaries: re-derived for affected domains
Views: regenerated
  ↓
DONE — durable cognition
```

Each step is a recorded transition. Each transition is observable. Each can be replayed from the audit log alone.

---

## When governance is *not* invoked

Some events get auto-confirmed directly into Blood, no staging:

- G0 events: dropped (audit-only)
- G1 events under any cognitive mode: auto-confirmed
- G1 / G2 events under `lightweight` mode: auto-confirmed
- Calibration signals that *re-confirm* an existing event: merge, no new staging

The principle: **process scales with weight**. A noise-level decision gets a noise-level path. A project-defining decision gets human review.

---

## The contract with human reviewers

A staged event is presented to the human with everything they need to decide in five seconds:

- **What** was decided / rejected
- **Why** (the `reasoning` field)
- **Rejected alternatives** explicitly
- **Behavior effect** (avoid / prefer / warn / require_review)
- **Trauma flag** if set
- **Routing reason** ("DNA simplicity_bias raised gravity to G2")
- **One-click accept / reject**

If review takes longer than a coffee sip, the team will eventually skip it. Cairn's job is to make the cost of *not* reviewing higher than the cost of reviewing.

---

## Reject is not refusal — it's data

A rejection is not "this signal goes to /dev/null." It's a recorded act:

```yaml
- ts: "2026-05-17T10:00:00Z"
  actor: "user"
  action: "stage_reject"
  target: "evt_pending_099"
  detail: "premature — too narrow a basis to capture as project-wide"
```

The same exact signal arriving again next month will dedup against this rejection. The team will not be re-asked. This is how Cairn respects the reviewer's time — every reject is "no, and don't ask me again *for this reason*."

---

## Failure modes

- **Review queue inflation** — staged piles up because no one ratifies. `cairn doctor --metrics` surfaces `staged backlog: N`. The remedy is usually mode adjustment (drop from `institutional` to `standard`) or batched review.
- **Auto-confirm overreach** — `lightweight` mode confirms G1 + G2; noisy stuff enters Blood. Mitigation: increase mode strictness, accept the review cost.
- **Silent audit gap** — audit file corrupted or hand-edited. Mitigation: `cairn doctor --fix` detects unparseable audit; quarantines + emits warning.

---

## See also

- [`gravity.md`](./gravity.md) — the weight axis governance routes against
- [`../iv-self/trust-router.md`](../iv-self/trust-router.md) — the gate that stamps `system_validated`
- [`../iii-life/capture-and-ratify.md`](../iii-life/capture-and-ratify.md) — the end-to-end loop
- [`../v-intervene/tend.md`](../v-intervene/tend.md) — how to handle a review queue that piles up
