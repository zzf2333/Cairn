# Compression

> When the same kind of decision has been made the same way enough times, it stops being a decision and starts being who you are.

---

## What compression is

**Compression** is the engine by which repeated patterns in Blood become candidate DNA traits. It is the process by which a project earns its personality — not by declaring it, but by accumulating evidence that the personality is already there.

The mechanism:

```
Blood events accumulate            CompressionEngine runs at session_end
─────────────────────              ─────────────────────────────────────
                                            ↓
  evt_021: "reject GraphQL"        searches for repeated patterns:
  evt_044: "reject new ORM"        - same domain category
  evt_087: "reject MongoDB"        - same kind of effect (avoid_suggestion)
  evt_104: "reject Redis"          - similar reasoning shape
  evt_124: "reject ElasticSearch"
  ... 18 more like these                    ↓
                                   ≥ min_evidence (3) ✓
                                   ≥ min_timespan_months (3) ✓
                                   confidence ≥ 0.6 ✓
                                            ↓
                                   stg_dna_simplicity_bias_<ts>.yaml
                                   (waits for cairn_dna_accept)
                                            ↓
                                   if accepted: identity.yaml.traits.simplicity_bias
```

The path is deliberately gated. A trait that emerges from 23 rejections over 14 months is a different statement than one inferred from 3 rejections in a week. Cairn's strategic trait defaults err strict — min_evidence ≥ 3, min_timespan ≥ 3 months, confidence ≥ 0.6 — because **wrong DNA silently distorts every future decision**.

Cairn also has a fast-cycle lane for active projects. It proposes **emerging** project-specific traits from dense repeated corrections, session summaries, rejected paths, and staged clusters. These candidates are not active DNA; they must still be human-ratified before they affect routing.

---

## Trait types

CompressionEngine has two classes of candidates:

- **Known traits** such as `simplicity_bias` and `infra_aggressiveness`. These are consumed by TrustRouter / ChallengeEngine.
- **Project-specific emerging traits** such as "script-based validation discipline" or "Leader/Worker boundary sensitivity". These are surfaced for human ratification and documentation before any routing behavior depends on them.

Only ratified known traits modulate behavior today. Project-specific traits are still useful: they give the team a reviewable name for repeated project behavior without pretending the router understands it yet.

---

## Why "compression"

The name is precise. Compression takes many concrete events and reduces them to a single higher-level claim:

- *Lossy*. The individual events are not deleted — they remain in Blood — but the trait does not contain them. It contains the *abstraction* of them.
- *Reversible only through reevaluation*. You can't decompress a trait back into its source events; you can only revoke the trait and let the same compression run again if/when reality justifies.
- *Bounded*. Compression doesn't summarize all of Blood. It only emits trait candidates when a specific shape recurs.

This is information-theoretic compression in the strict sense: many bits → fewer bits, preserving the predictive content.

---

## The human ratification gate

CompressionEngine **never** writes directly to `identity.yaml`. Every candidate it surfaces goes to `.cairn/dna/staged/<id>.yaml` first:

```yaml
id: "stg_dna_simplicity_bias_1715234567890"
trait_name: "simplicity_bias"
level: "high"
confidence: 0.78
evidence_events:
  - "evt_021"
  - "evt_044"
  - "evt_087"
  - ... (20 more)
reasoning: "23 rejections of complex tooling over 14 months consistently chose boring tools"
proposed_at: "2026-05-17T08:00:00Z"
review_status: "pending"
```

Project-specific candidates use the same shape, with a free-form `trait_name` and evidence that may include session IDs as well as blood event IDs.

`cairn_dna_accept({ id })` promotes the candidate. `cairn_dna_reject({ id, reason })` records the rejection so the same pattern doesn't re-surface immediately.

The asymmetry is intentional: **the cost of accepting a wrong trait is higher than the cost of rejecting a right one**. A wrong trait silently biases every future decision; a rejected right one just means CompressionEngine waits for more evidence and tries again.

---

## What a "ratified" trait actually does

Once `simplicity_bias` is in `identity.yaml.traits` with level `high`, every new signal passes through DNA modulation in TrustRouter:

```
incoming signal: "rejected new dependency on RabbitMQ"
  ↓
Skeleton domain: infra
  ↓
DNA: simplicity_bias=high applies
       infra_aggressiveness=low applies (if also emerged)
  ↓
modulation: +1 gravity (the trait nudges toward stricter treatment)
  ↓
result: G1 → G2, signal routed to staged for human review
```

The visible effect on the AI: when `cairn_context` returns, the AI sees:

```yaml
dna:
  relevant_traits:
    - name: "simplicity_bias"
      level: "high"
      implication: "lean toward simpler/boring tools"
```

And when proposing a solution, the AI knows: this project doesn't just *say* it prefers simplicity. The Blood log *proved* it. Propose accordingly.

---

## The reevaluation_mode override

DNA traits aren't permanent. When CalibrationEar detects the project's recent activity contradicting an emerged trait (e.g., simplicity_bias=high but the team added 5 new infra components last month), it raises drift warnings. When drift warnings accumulate, the **safety valve** flips:

```yaml
reevaluation_mode: true
```

In this mode, **all traits stop modulating routing**. TrustRouter's DNA modulation step short-circuits. `cairn_context` surfaces `dna.reevaluation_mode: true` and `paused_traits[]` so the AI knows the personality is paused.

The team then:

1. Reviews the drift evidence (`cairn dna show`)
2. Decides per trait: keep / adjust level / reject
3. Runs `cairn dna reevaluate` to exit the mode

Full mechanics in [`../iv-self/reevaluation.md`](../iv-self/reevaluation.md).

---

## Why this is "earned personality, not declared personality"

A principles document — "we value simplicity," "we move fast" — is a *declaration*. It's true the moment it's written. It stays true even when the team's actual behavior diverges.

DNA is **observable**. It's true when the evidence supports it and false when it doesn't. A team that "values simplicity" but consistently approves complex tooling won't get `simplicity_bias` — the compression won't find the pattern.

This is the same difference as between someone *saying* they're kind and someone *acting* kindly across a year of decisions. Cairn measures the second thing.

---

## Failure modes

- **Trait noise from short timeline** — 3 rejections in a week look like a pattern but are circumstance. Mitigation: known traits keep the min_timespan_months threshold; fast-cycle traits remain staged and inactive until human review.
- **Trait reified from a confused mode change** — team switched from `lightweight` to `institutional` and decisions look different post-switch. Mitigation: CompressionEngine uses raw event count, not mode-weighted; mode change is itself a captured event.
- **Reject loop** — a real trait keeps being proposed and rejected. Mitigation: rejected candidates have a cooldown before re-surfacing; review accumulated rejections in `cairn doctor` output.

---

## See also

- [`../ii-anatomy/dna.md`](../ii-anatomy/dna.md) — what an emerged trait actually contains
- [`../iv-self/calibration.md`](../iv-self/calibration.md) — the drift-detection that gates the safety valve
- [`../iv-self/reevaluation.md`](../iv-self/reevaluation.md) — what happens when traits and reality diverge
- [`decay-and-resurrection.md`](./decay-and-resurrection.md) — the other half of cognitive lifecycle
