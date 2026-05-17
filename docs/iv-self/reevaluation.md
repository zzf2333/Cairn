# Reevaluation

> When a project's stated personality and its lived behavior have diverged enough, the right thing is not to override one with the other. It is to stop pretending the disagreement isn't there.

---

## The problem reevaluation_mode solves

A project has an emerged DNA trait: `simplicity_bias: high`, with `evidence_count: 23` from rejections over 14 months. The system uses this trait to modulate TrustRouter — incoming signals about complex tooling get +1 gravity.

Then the project grows. Compliance requirements arrive. The team adds Kafka, a service mesh, a complex auth gateway, a multi-region replica setup. Five new infrastructure components in a single quarter, each ratified, each landed as Blood.

The trait, ratified 14 months ago, says the project leans against complex tooling. The lived reality says the project just deliberately introduced five complex tools.

This is **DNA drift**. The trait isn't necessarily wrong — maybe it still applies in some domains, maybe it's flat-out obsolete, maybe its level should drop from `high` to `medium`. Cairn doesn't try to guess. It does something more honest:

> **Stop using the trait until the team decides what to do about it.**

That stop is `reevaluation_mode`.

---

## What flipping `reevaluation_mode: true` actually does

```yaml
# .cairn/dna/identity.yaml
status: "emerged"
traits:
  simplicity_bias: { level: "high", confidence: 0.91, ... }
  infra_aggressiveness: { level: "low", confidence: 0.85, ... }
reevaluation_mode: true     # the load-bearing line
```

When this flag is `true`:

1. **TrustRouter skips DNA modulation entirely.** The DNA step (step 6 in the routing pipeline) short-circuits. Signals route based only on gravity, trauma, and governance — no trait nudges.

2. **`cairn_context` surfaces the pause.** The activation result includes:
   ```yaml
   dna:
     relevant_traits: []
     reevaluation_mode: true
     paused_traits:
       - { name: "simplicity_bias", level: "high" }
       - { name: "infra_aggressiveness", level: "low" }
   ```
   The Host AI now *knows* the personality is paused. It is expected to give balanced, neutral recommendations — not blindly continue as if the traits applied, and not pretend the project has no personality.

3. **`cairn doctor` reports the state prominently.** The metrics output flags `DNA reevaluation: ACTIVE`. The team sees it on every diagnostic.

4. **Drift signals continue to accumulate.** CalibrationEar doesn't stop watching just because the valve is open. Additional drift evidence is recorded for review.

The mode is, by design, **inconvenient**. It signals visibly that the project's cognitive layer is in an unresolved state. That visibility is the point.

---

## How the valve opens

The valve is triggered automatically, not manually. CalibrationEar's `dna_drift` channel counts contradictions between a trait and recent activity. Each contradiction increments `trait.drift_warning_count`. When the count crosses a mode-dependent threshold:

| Mode | Drift threshold |
|------|-----------------|
| `lightweight` | 3 |
| `standard` | 5 |
| `institutional` | 8 |

…the safety valve flips `reevaluation_mode: true` on the next `cairn_session_end`.

Three drift warnings under lightweight is enough. The mode is suspicious of weak signals; it flips fast. Institutional waits for more evidence before disrupting routing. The asymmetry matches the cognitive mode philosophy: lightweight is fast and skittish; institutional is patient and slow to change.

---

## How the valve closes

Only manually. `cairn dna reevaluate` is the exit:

```bash
cairn dna reevaluate
```

The CLI walks the team through each paused trait:

```
Trait: simplicity_bias (current: high, confidence: 0.91)
Drift warnings: 5 (last: 2026-04-22)

Recent contradicting events:
  - evt_201: introduced Kafka (G2, 2026-03-15)
  - evt_215: added service mesh (G3, 2026-03-22)
  - evt_228: complex auth gateway accepted (G2, 2026-04-01)

Options:
  [k] Keep trait at current level (5 drift warnings remain; valve re-trips faster)
  [a] Adjust level (high → medium / low)
  [r] Reject trait (remove from identity.yaml, audit-log the removal)

Decision:
```

Each trait gets its own decision. Once all decisions are made, the flag flips back:

```yaml
reevaluation_mode: false
```

And routing resumes with the updated DNA.

This is a real act. The team is explicitly choosing what the project's personality should look like now, given the evidence. The audit log records each decision.

---

## Why not just "ignore the warnings"

A naive design would let the team dismiss drift warnings without action. "Yeah, we know, keep the trait." `reevaluation_mode` rejects that path because:

1. **Cognition has to align with reality** or it stops being trustworthy. A trait that's been contradicted 5 times in a month and still actively modulating routing is *the AI giving advice based on a fiction*.

2. **The cost of pausing is small.** TrustRouter still works without DNA modulation. The system degrades gracefully — it just isn't using personality as one of its modulating forces. Other signals (gravity, trauma, governance) all continue.

3. **The cost of *not* pausing is unbounded.** Wrong DNA silently biases every future decision. Without a valve, the bias compounds invisibly.

The valve forces the conversation. The conversation forces the alignment. The alignment is what makes the next ratified trait trustworthy.

---

## The three outcomes of reevaluation

When the team runs `cairn dna reevaluate`, each paused trait ends in one of three states:

**1. Kept** — the team decides the trait still applies. Drift warnings are acknowledged but the trait survives at current level. CalibrationEar will keep watching; if drift continues, the valve re-trips faster.

**2. Adjusted** — the team agrees the trait was too strong / too weak. Level changes (`high` → `medium`). Confidence may also drop. CompressionEngine treats this as an explicit override and won't immediately re-propose the original level even if evidence accumulates.

**3. Rejected** — the team decides the trait is wrong. It's removed from `identity.yaml`. CompressionEngine records the rejection so the same trait doesn't immediately re-emerge from the same evidence.

Each outcome is a real act. Each is audit-logged. Each is reversible (the audit log shows the full history; a future team can revisit the decision).

---

## The philosophical claim

Reevaluation is the architectural answer to "what do you do when your encoded knowledge and your lived behavior disagree?"

A bad answer: pick one and override the other. ("Trust the trait — the team is wrong." Or: "Trust the activity — the trait is wrong.")

A good answer: **suspend the encoded knowledge, surface the disagreement, force the reconciliation**. The team's act of reevaluating is itself a high-value piece of cognition — that's why the audit log records each adjustment. Next time the team revisits, they see the prior reasoning.

This is the same pattern as a postmortem: the *act* of reckoning with the failure is more valuable than the specific finding, because it institutionalizes the reckoning itself.

---

## Failure modes

- **Valve flapping** — drift warning hits threshold, team reaffirms, drift continues, valve re-trips immediately. Mitigation: after reaffirmation, drift warnings reset and the threshold doubles for the next trip — the system gets harder to trip after a confirmed reaffirmation.
- **Valve ignored** — `reevaluation_mode` stays `true` for weeks because nobody runs `cairn dna reevaluate`. Mitigation: `cairn doctor` reports it loudly; `cairn_context` surfaces it on every activation so the Host AI keeps reminding the user.
- **Drift threshold too sensitive** — too many false positives, valve trips on noise. Mitigation: mode-tunable; institutional waits longer; tune downward only with care.

---

## See also

- [`calibration.md`](./calibration.md) — where the drift signals come from
- [`trust-router.md`](./trust-router.md) — what skips DNA modulation when the valve is open
- [`../ii-anatomy/dna.md`](../ii-anatomy/dna.md) — what the traits actually contain
- [`../iii-life/compression.md`](../iii-life/compression.md) — how traits emerge in the first place
