# Decay and Resurrection

> Forgetting is part of the design. A constraint nobody bumps into for eighteen months is probably dead. Pretending otherwise is worse than forgetting.

---

## Two failure modes Cairn refuses

**Failure mode 1: Eternal memory.** Every captured event lives forever, at full weight. Over time the project's cognition fills with stale rules, contradicted intuitions, and rules that were true for the team three years ago and nobody else. New AI agents face a wall of constraints that no longer apply. Worse — the system *looks* strict, so people start ignoring it.

**Failure mode 2: Aggressive forgetting.** Events age out fast to keep things lean. The "ledger must be ACID" rule from a real production incident in November 2024 disappears in 2026 because nobody touched the ledger module last quarter. Then someone proposes MongoDB for the ledger, the rule is gone, the incident replays.

Cairn rejects both by making the lifecycle explicit:

```
captured → ratified → activated → (idle) → stale → resurrected
                                                ↓
                                            archived
```

Each transition has a rule. Each rule has a tunable window. The whole thing runs on every `cairn_session_end`.

---

## Decay: how events age

`DecayEngine` runs on every session_end and evaluates each Blood event:

- **Last activated** — when was this event last loaded by `cairn_context`?
- **Last updated** — when was the event itself last modified?
- **Lifecycle policy** — does the event opt out of decay? (e.g. trauma events have `decay_policy: "never"`)

If an event has not been activated for `decayStaleDays` (mode-dependent: 30 / 90 / 180), it is **archived**:

```yaml
# .cairn/blood/evt_old.yaml
health:
  state: "stale"           # was "ok"
  reason: "unused for 95 days"
```

If activation has dropped sharply (it was active, now it's idle), it can be **downgraded** — gravity drops by one level. A G2 becomes G1, a G3 becomes G2. The event is still active, but treated as less weighty.

A G0 cannot be downgraded further; it is archived directly.

Trauma events are exempt. They never decay. They never downgrade. Their job is to remain at full strength forever.

---

## Why archiving is "stale," not deletion

Archived events stay in `.cairn/blood/`. They're not deleted. Their `health.state` flips to `stale`. They:

- Do **not** influence `cairn_context` results in normal activation
- Do **not** modulate TrustRouter routing
- Do **not** count toward DNA evidence
- **Do** remain in git history forever
- **Do** track `recent_hits` (in `state.activation_log.recent_hits`)

That last point is the bridge to resurrection.

---

## Resurrection: when forgotten things come back

`ResurrectionEngine` watches archived events for unexpected reactivation. The activation graph records each event's `recent_hits` — how many times it's been touched in the last window.

When an archived event accumulates **≥ 5 hits in 30 days**, it becomes a **resurrection candidate**. This means: the project is once again asking questions for which this archived event has answers. The system noticed.

Resurrection has two paths:

- **Auto-resurrect** for G0 / G1 events at `system_validated` level. `cairn doctor` does this. The event flips back to `health.state: "resurrected"`, gravity restored.
- **Manual review** for G2+ events. They surface as candidates in `cairn doctor` output, awaiting human ratification.

A resurrected event is not exactly the same as a fresh event. It's marked:

```yaml
health:
  state: "resurrected"
  reason: "reactivated 5+ times in 30 days; was stale since 2025-09"
lifecycle:
  resurrection_count: 1
```

`resurrection_count` ≥ 1 is information. An event that has been resurrected twice is "tried to die twice, kept being relevant" — the system knows it matters more than the calendar suggested.

---

## The philosophical claim

Most memory systems treat forgetting as failure. Cairn treats it as **information**. The fact that nobody touched a constraint for six months tells you something — it's likely no longer load-bearing. Cairn encodes this by lowering its strength, not by erasing it.

The fact that an archived constraint suddenly gets queried five times in a month also tells you something — the project is back in territory where this constraint matters. Cairn encodes this by reactivating it.

The two halves are the same insight: **relevance is a function of use, not a function of authorship date**. Decay-then-resurrect is how the system tracks relevance instead of pretending all captured cognition is equally relevant forever.

---

## Tuning per cognitive mode

The decay windows are not universal. They scale with cognitive_mode:

| Mode | `decayStaleDays` | `decayUnusedDays` |
|------|------------------|-------------------|
| `lightweight` | 30 | 60 |
| `standard` | 90 | 120 |
| `institutional` | 180 | 240 |

A `lightweight` project forgets fast — appropriate for short-lived experiments. An `institutional` project keeps things alive longer — appropriate for compliance / regulated / long-tail-critical projects.

The threshold is in `mcp/src/constants.ts.COGNITIVE_MODE_PARAMS`. Tuning per project is possible (custom `cognitive_mode`-equivalent values) but not exposed via config yet; on the 0.5 roadmap.

---

## The "view of an archived event" question

Sometimes you want to *see* archived cognition without resurrecting it:

- `cairn blood list --include-stale` (CLI) — lists all events including `stale`
- `cairn_context` can be called with explicit retrieval flags (planned for 0.5) to include archived events as advisory

Most of the time, archived events are below the line. They show up only when reactivation suggests they should.

---

## Failure modes

- **Decay too fast** — important events archive before the team can re-encounter them. Mitigation: tune cognitive_mode upward, or mark high-stakes events with `decay_policy: "never"`.
- **Decay too slow** — the project becomes a museum, every old idea still at full strength. Mitigation: tune cognitive_mode downward; trust the resurrection mechanism to catch the rare exceptions.
- **Resurrection false positive** — an archived event reactivates due to a coincidence (someone unrelated touched a similar keyword). Mitigation: high threshold (5 hits / 30 days); human review for G2+.
- **Resurrection blind spot** — a resurrection-worthy event never auto-resurrects because hit count is one short. Mitigation: `cairn doctor` shows the near-misses as candidates the team can manually elevate.

---

## See also

- [`../iv-self/calibration.md`](../iv-self/calibration.md) — the other channel by which archived cognition can be re-evaluated against reality
- [`compression.md`](./compression.md) — what happens when many Blood events of similar shape accumulate
- [`trauma.md`](./trauma.md) — the events that opt out of decay entirely
- [`../v-intervene/tend.md`](../v-intervene/tend.md) — how `cairn doctor` surfaces resurrection candidates
