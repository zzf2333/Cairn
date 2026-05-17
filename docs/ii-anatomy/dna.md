# DNA

> Personality is not declared. It is *earned*. By the time a project's DNA emerges, you can read it off the rejection log.

---

## What it is

**DNA** is the project's emergent personality. A single file at `.cairn/dna/identity.yaml` holding zero, one, or several **traits** — each one a compressed pattern from repeated Blood events.

Today, two traits are consumed by the engine:

- **`simplicity_bias`** — low / medium / high. How strongly the project prefers boring tools over novel ones.
- **`infra_aggressiveness`** — low / medium / high. How willing the project is to introduce infrastructure.

More traits (`risk_tolerance`, `velocity_preference`, `coupling_tolerance`, ...) are planned for the 0.5 line.

DNA is not declared at project start. It **emerges** when the same kind of decision has been made the same way enough times that the pattern becomes its own first-class fact.

---

## What a real one looks like

```yaml
status: "emerged"
traits:
  simplicity_bias:
    level: "high"
    confidence: 0.91
    reasoning: "23 rejections over 14 months consistently chose boring tools"
    evidence_count: 23
    drift_warning_count: 0
    last_updated: "2026-04-30"
  infra_aggressiveness:
    level: "low"
    confidence: 0.85
    reasoning: "Only 2 new infra components in 18 months; rejected 7"
    evidence_count: 9
    drift_warning_count: 0
    last_updated: "2026-04-15"
reevaluation_mode: false
compression_threshold:
  min_evidence: 3
  min_timespan_months: 3
  min_confidence: 0.6
```

Reading guide:

- `level` is the strength dial. `high` means the trait actively modulates routing — a "new dependency" rejection gets its gravity raised because the trait says the project leans away.
- `evidence_count` is the count of Blood events that contributed to surfacing this trait.
- `confidence` is a number from CompressionEngine, gated by the cognitive mode's threshold (default `0.6`).
- `drift_warning_count` is how many times CalibrationEar has noticed the trait disagreeing with recent activity. When it climbs, the safety valve gets primed.
- `reevaluation_mode: true` (not shown above) globally pauses all traits — see [`../iv-self/reevaluation.md`](../iv-self/reevaluation.md).

---

## How DNA emerges

The path from "a rejection happened" to "the project has a DNA trait" is deliberately slow and deliberately gated:

```
Blood event 1: rejected complex ORM → manual SQL                              (gravity G2)
Blood event 5: rejected new microservice → keep monolith                      (gravity G2)
Blood event 9: rejected GraphQL → kept REST                                   (gravity G3)
                              ...
Blood event 23: rejected Redis cache → in-process LRU                         (gravity G2)
                              ↓
              [CompressionEngine] notices 23 events tagged affects.dna: true
                              ↓
              evidence_count ≥ min_evidence (3) ✓
              timespan ≥ min_timespan_months (3) ✓
              confidence ≥ 0.6 ✓
                              ↓
              writes stg_dna_simplicity_bias_<ts>.yaml to .cairn/dna/staged/
                              ↓
              waits for cairn_dna_accept (human ratification)
                              ↓
              promoted to identity.yaml.traits.simplicity_bias
```

Two things to notice:

1. **A human ratifies every emerged trait, always.** No automatic promotion. The penalty for accepting a wrong trait is too high — it silently distorts every future routing decision.
2. **Emergence is mathematical, not declarative.** No one wrote "we prefer simplicity." The engine *computed* it from the actual rejection log.

This is the difference between a "principles" document (which everyone has, no one reads, and decays into wallpaper) and DNA (which is a live, evidence-bound, revocable claim).

---

## How DNA is used

When TrustRouter receives a new signal, after dedup and governance checks, it consults DNA:

```
incoming signal: "rejected new dependency on RabbitMQ"
  ↓
Skeleton domain: infra
  ↓
DNA traits applicable: simplicity_bias=high, infra_aggressiveness=low
  ↓
modulation: +1 gravity level (trait nudges the call toward more strict treatment)
  ↓
result: signal routed to staged at G2 instead of G1
```

Visible in `cairn_context` output:

```yaml
dna:
  relevant_traits:
    - name: "simplicity_bias"
      level: "high"
      implication: "lean toward simpler/boring tools"
```

So the AI doesn't just see "this project rejected X." It sees "this project leans against X-shaped things in general." That second statement is what makes the AI propose the right *alternative* on its first try.

---

## The four philosophical claims under DNA

**1. Personality is empirically observable.** Two engineers can describe the same project differently. The Blood log cannot. If it shows 23 rejections of complexity, the project is biased toward simplicity, regardless of what the README claims.

**2. Personality is revocable.** A trait is not a permanent feature. The team can grow into needing complexity (scale, regulation, team size) — and CalibrationEar will surface the drift, the safety valve will pause the trait, and the team will reevaluate.

**3. Personality emerges late.** A 3-month-old project doesn't have DNA. A 3-year-old one does. Cairn refuses to fake this — `status: "not_yet_emerged"` is a legitimate state and not a failure.

**4. The wrong DNA is worse than no DNA.** Every modulation away from the right answer is a bet. Wrong bets compound. Hence: human ratification mandatory; safety valve always armed; drift surfaces loudly.

---

## Where DNA lives, where it doesn't

| Lives | Doesn't |
|-------|---------|
| `.cairn/dna/identity.yaml` (the ratified file) | Anywhere a human types it manually |
| `.cairn/dna/staged/*.yaml` (candidates awaiting ratification) | In a principles document |
| `.cairn/dna/imprint.yaml` (inherited from a parent project on fork) | In a tagline or mission statement |

Imprint is interesting: when project B is forked from project A that had emerged DNA, B inherits A's DNA as an *imprint* — visible to AI agents but **not** active modulation until B's own evidence emerges. New project, ancestral memory.

---

## Failure modes

- **Trait noise** — too few events / too short timespan produces a flaky candidate. Mitigation: thresholds per cognitive_mode; rejection writes a rejection record so the same noise doesn't re-surface.
- **Drift blindness** — project evolves; DNA doesn't update. Mitigation: CalibrationEar's `dna_drift` channel + safety valve.
- **Overconfidence** — a high-confidence trait modulates too aggressively. Mitigation: confidence ≥ 0.6 is a floor; modulation strength is bounded; trauma rules can override.

---

## See also

- [`../iii-life/compression.md`](../iii-life/compression.md) — the mechanics of how Blood patterns become DNA candidates
- [`../iv-self/reevaluation.md`](../iv-self/reevaluation.md) — the safety valve that pauses traits when they drift
- [`gravity.md`](./gravity.md) — what DNA modulates
- [`../vi-coordinates/schema.md`](../vi-coordinates/schema.md) — field reference for `identity.yaml`
