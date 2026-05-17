# Calibration

> A cognition layer that doesn't check itself against reality is a religion. Calibration is what keeps Cairn honest.

---

## What it does

**CalibrationEar** runs on every `cairn_session_end`. Its job is to compare Cairn's claims about the project to what the project's code, git history, and recent activity actually say. When they disagree, it emits **calibration signals** that flow back through TrustRouter — so the cognition gets corrected, not silently invalidated.

Four kinds of signal:

| Signal | What it detects | Typical effect |
|--------|-----------------|----------------|
| `no_go_violation` | A Blood event says "don't do X." The code now does X. | Re-stage as G2+, force human review of either the rule or the code |
| `skeleton_drift` | Files have moved between skeletons compared to declared `files` patterns | Re-stage the affected skeleton(s) for refresh |
| `debt_resolution` | An accepted_debt item has been quietly paid off | Auto-archive the debt with `health.state: "stale"` and audit-log the resolution |
| `dna_drift` | Recent activity contradicts an emerged DNA trait | Increment `drift_warning_count`; can trigger the safety valve |

These are not warnings to humans. They are signals to the system — they re-enter TrustRouter and get routed like any other signal. The output is durable cognition updates, not log lines.

---

## Why this matters more than it sounds

Without calibration, every memory system has the same long-run failure mode: **cognition drifts away from reality, silently, with no recovery loop**.

A Blood event from 2024 says "the ledger module must not use ORM." In 2026, the team has migrated to a new framework, the ledger module is now using a thin ORM that doesn't have the original sharp edges, and nobody updated Blood. The constraint is now *factually wrong*. The AI is still following it. The team is paying a cost (slow ledger queries, no migration tooling) for a rule that is no longer correct.

CalibrationEar would catch this. The signal:

```yaml
type: "no_go_violation"
event_id: "evt_087"
detail: |
  Blood event says "no ORM for ledger" but `src/ledger/queries.ts`
  imports `@prisma/client`. Either the rule is stale or the code is.
```

This flows through TrustRouter. The team decides: keep the rule and revert the code, or update the rule and let the code stand. Either way, **cognition and reality re-align**.

The general principle: **if cognition can't be checked, it can't be trusted**. Calibration is the checker.

---

## The four signal types, in detail

### `no_go_violation`

Cairn keeps a list of "do not do X" events (`behavior_effect.type === "avoid_suggestion"`). CalibrationEar scans the code for evidence each constraint is being violated:

- Subject name appears in imports, package.json deps, infrastructure files
- Subject aliases match (`subject.aliases`)
- Heuristic file-content match in the relevant domain's files

When a violation is found, a calibration signal proposes re-staging the event for explicit reaffirmation or revocation. The team has to *decide* — they can't let the contradiction stand silently.

This is the most user-visible calibration signal and the most important.

### `skeleton_drift`

Skeleton files declare `files: [glob, glob, ...]`. When the codebase moves significantly — a domain's files migrate to a new directory, a new domain emerges in `src/` without a skeleton, files vanish — skeleton stops being an accurate causal index.

CalibrationEar checks:

- Files declared in each skeleton: do they still exist?
- Files in `src/` that don't match any skeleton: is there an undeclared domain?
- Files that match multiple skeletons: which one is the real owner?

When drift is detected, the affected skeletons get re-staged for refresh. Activation continues to work in the meantime — drift just means the index is becoming stale.

### `debt_resolution`

`accepted_debt` entries have `revisit_when: [...]` conditions. When the conditions are met (e.g., "cache miss rate > 5%" — measured externally and reported back), the debt is up for review.

A simpler form: when the code that *needs* the debt is no longer in the codebase (the function was removed, the module was deprecated), the debt has resolved itself by erasure. CalibrationEar archives these.

This is the channel that keeps the debt log honest — it doesn't grow forever just because everyone forgot to mark a debt as paid.

### `dna_drift`

A DNA trait says "simplicity_bias: high, evidence_count: 23." But recent Blood events tell a different story — 5 new infra components introduced last month, 3 complex tooling decisions made.

CalibrationEar counts the contradictions. When `drift_warning_count` crosses a threshold per cognitive mode, the **safety valve** flips. See [`reevaluation.md`](./reevaluation.md).

This is the most automated channel — a trait that's clearly wrong gets paused without waiting for human triggering. The team is informed in `cairn doctor` output and can decide what to do next.

---

## Calibration depth scales with cognitive mode

| Mode | Calibration depth |
|------|-------------------|
| `lightweight` | `no_go_violation` only — the most important channel |
| `standard` | `no_go_violation` + `skeleton_drift` |
| `institutional` | All four — full calibration |

The reason: calibration is expensive (full filesystem scan + analysis). A lightweight project might not want to pay that on every session_end. An institutional project considers calibration a load-bearing part of governance and pays the cost.

---

## The safety valve interaction

`dna_drift` is the input that feeds the **safety valve** in [`reevaluation.md`](./reevaluation.md). When it accumulates beyond the per-mode threshold, all DNA traits stop modulating routing until the team manually exits the mode.

The chain:

```
real activity diverges from emerged trait
  ↓
CalibrationEar emits dna_drift signal
  ↓
DNA trait's drift_warning_count +1
  ↓
threshold crossed?
  yes → safety valve: identity.yaml.reevaluation_mode = true
        all traits stop modulating in TrustRouter
        cairn_context surfaces dna.reevaluation_mode + paused_traits[]
        team is informed; cairn dna reevaluate to exit
```

The valve is *only* triggered by calibration, not by humans. Humans exit it; they don't enter it. This avoids the failure mode of someone manually disabling DNA "for now" and forgetting to re-enable it.

---

## Why "ear"

The internal name `CalibrationEar` and its sibling `GitEar` come from the metaphor: these are **passive listeners**, not active prescribers. They don't make decisions. They observe and signal. The decisions remain in TrustRouter → Governance.

This separation matters because it keeps the system auditable. Every decision has a single owner (TrustRouter). Calibration is *input*, not *output*. Its only job is to make sure TrustRouter sees the contradictions when they exist.

---

## Failure modes

- **Calibration false positive** — code looks like a violation but isn't (e.g., the `mongodb` string appears in a comment, not an import). Mitigation: heuristic conservatism; human ratification still required for re-staged events; rejection records the false positive so the same pattern doesn't re-signal.
- **Calibration blindness** — a real violation isn't detected because the subject name doesn't appear in any indexed form. Mitigation: `subject.aliases` field; expand alias coverage in dogfood.
- **Calibration cost explosion** — full scan on a 500k-line codebase is slow. Mitigation: depth scales with cognitive mode; `lightweight` mode does only the cheapest check; caching of file-content scans across sessions.

---

## See also

- [`trust-router.md`](./trust-router.md) — where calibration signals re-enter the system
- [`reevaluation.md`](./reevaluation.md) — what `dna_drift` triggers
- [`../iii-life/decay-and-resurrection.md`](../iii-life/decay-and-resurrection.md) — the other channel that keeps Blood relevant
- [`../v-intervene/tend.md`](../v-intervene/tend.md) — how to read calibration output in `cairn doctor`
