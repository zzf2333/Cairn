# Blood

> Blood is what flows. Each evolution event is a single oxygenated decision moving through the organism.

---

## What it is

**Blood** is the stream of confirmed evolution events. One YAML file per event at `.cairn/blood/<event_id>.yaml`. Each event is a 40-field record covering:

- **Origin** — who/what raised it, with what confidence
- **Substance** — what was decided, what was rejected, why
- **Effect** — `avoid_suggestion`, `prefer_approach`, `warn_before`, `require_review`
- **Scope** — which domain(s) it affects
- **Gravity** — G0 noise / G1 local / G2 module-scoped / G3 project-defining
- **Lifecycle** — strategic vs tactical, decay policy
- **Health** — `ok` (active) / `stale` (archived) / `resurrected`
- **Trauma** — scar-tissue flag with sensitivity multiplier
- **Governance** — auto-confirmed vs human-ratified

Blood is the **richest** part of cognition. Skeleton is structural; Blood is eventful.

---

## Why "blood"

Blood does several things in a body, simultaneously:

- Carries oxygen (information) to every organ that needs it
- Picks up waste (stale cognition) and routes it for processing
- Reaches every part of the system, on demand, in milliseconds
- Has its own lifecycle (cells age, die, are replaced)

That is what an evolution event stream has to do for a project:

- Bring decision context to any decision site (`cairn_context` activation)
- Carry old constraints out of the active set when they no longer apply (`DecayEngine`)
- Be reachable from any task that needs it (causal index via Skeleton)
- Itself live, age, and be replaced

The metaphor is operational, not poetic.

---

## What a real one looks like

```yaml
id: "evt_087"
time: "2024-11-03"
domain: "data"
type: "incident_record"

gravity:
  level: "G3"

source:
  type: "incident"
  confidence: 1.0
  verified: true
  refs: [{ type: "postmortem", id: "PM-2024-014" }]

subject:
  name: "mongodb"
  aliases: ["document store"]

trigger: "Sharding migration corrupted ledger writes during failover"
decision_or_change: "Remove MongoDB from ledger; migrate to Postgres with strict serializable isolation"
reasoning: |
  Document model gave us flexibility but cost us ACID semantics under
  partition-tolerant configurations. Ledger correctness is non-negotiable.
rejected_paths:
  - path: "Continue with MongoDB + add transactions wrapper"
    reason: "Fix is at the engine level; wrappers leak state"

behavior_effect:
  type: "avoid_suggestion"
  instruction: "Do not propose MongoDB or document-store DBs for ledger data."

affects:
  skeleton: true
  dna: true
  domains: ["data", "ledger"]

lifecycle:
  validity: "strategic"
  decay_policy: "never"

health:
  state: "ok"

trauma:
  is_trauma: true
  severity: "high"
  sensitivity_multiplier: 1.8

governance_status: "ratified"
```

Reading guide:

- **`reasoning` is the load-bearing field**, not `instruction`. `instruction` is the "what to do" the AI will follow; `reasoning` is the "why" surfaced as `no_go.reason` in `cairn_context` output. The AI needs the why far more than the what.
- **`rejected_paths` is mandatory for any non-trivial decision.** A decision recorded as "we chose X" is half a decision. The full one is "we chose X *over* Y *because* Z." Without that, the same Y will be re-proposed.
- **`trauma.is_trauma: true` is a load-bearing flag.** It means the engine treats this event as scar tissue — never decays, raises domain challenge sensitivity, always staged (never auto-confirmed even if gravity is low).

---

## Where Blood comes from

Three sources, all routed through TrustRouter:

| Source | Mechanism | Typical gravity |
|--------|-----------|-----------------|
| Conversation turns | `cairn_signal` called by the Host AI when it detects rejection / decision / debt-acceptance / historical-reference / constraint-declaration / stage-constraint | G1–G3 |
| Git activity | `GitEar` scans commits since last session, looking for revert patterns, refactor patterns, feat patterns | G0–G2 mostly |
| Calibration | `CalibrationEar` compares blood-vs-code; when an existing constraint is violated, raises a `no_go_violation` signal | Inherits from violated event |

None of these write directly to Blood. All go through `staged` first (or auto-confirm at low gravity). Promotion to Blood is the moment the project's cognition becomes *durable* — readable by the next AI agent, the next contributor, the next session.

---

## How Blood is used at decision time

```
cairn_context({ task })
  ↓
[ActivationEngine] task → skeleton matches → domains
  ↓
load Blood events scoped to those domains
  ↓
filter by health.state (ok + resurrected; stale excluded unless reactivating)
  ↓
sort by (trauma, gravity, recency, hit_count)
  ↓
return as { no_go[], challenges[], relevant_events[] }
```

The path is deliberately short. Latency is part of the design — see [`../vi-coordinates/performance.md`](../vi-coordinates/performance.md). At 1k events the activate p99 is ~15ms. That number is not incidental; it's what makes "call this before every response" viable.

---

## Why Blood files are git-tracked

This is a deliberate choice, against the convention of putting database-shaped state in `.gitignore`.

Reasons:

- **Cognition is project-bound.** It belongs to the repository, not to a developer's machine.
- **Diff is the audit log.** Every change to Blood shows up in git history with timestamps and authors.
- **Fork inherits.** When a project is forked, its accumulated cognition forks with it.
- **Branches preview.** A feature branch can include speculative Blood changes; review them in PR; merge or discard with the code.
- **Backups are free.** Wherever your code is backed up, your cognition is backed up.

The tradeoff: large projects produce many Blood files (hundreds, possibly low thousands over years). The directory remains text + small files; performance work in 0.4.0 ensures git operations on it stay fast.

---

## Failure modes

- **Blood inflation** — every conversation produces a signal, signals all auto-confirm, Blood directory bloats to thousands of low-value events. Mitigation: TrustRouter dedup, gravity-based filtering, decay.
- **Blood drought** — AI doesn't call `cairn_signal` despite the skill protocol asking it to. Mitigation: explicit triggers in `skills/*.md`, dogfood findings (`tests/scenarios/_findings.md`) to catch missed captures.
- **Reasoning rot** — `reasoning` field becomes "we decided X" with no actual reasoning. Mitigation: human ratification gate; CalibrationEar warns when events' `reasoning` is too short.

---

## See also

- [`gravity.md`](./gravity.md) — the four levels Blood events are stamped with
- [`capillaries.md`](./capillaries.md) — the per-domain projection of Blood
- [`../iii-life/`](../iii-life/) — the lifecycle Blood events go through
- [`../iv-self/trust-router.md`](../iv-self/trust-router.md) — the gate every Blood event passes through
- [`../vi-coordinates/schema.md`](../vi-coordinates/schema.md) — field-level reference for the 40 fields
