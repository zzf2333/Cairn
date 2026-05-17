# Trust Router

> Every signal that becomes cognition passes through here. There is no other door.

---

## The role

**TrustRouter** is the single gate every signal traverses on its way into Cairn. The decisions it makes are not glamorous, but they are what separates this system from a recall layer:

- Filter noise without losing signal
- Recognize duplicates before they double-count
- Apply trauma rules
- Apply DNA modulation
- Hand the final disposition to governance

If TrustRouter is sloppy, everything downstream gets noise dressed as cognition. If it is too strict, real signal gets dropped. Most of Cairn's intelligence is concentrated here.

---

## The full path

```
incoming signal (from cairn_signal | GitEar | CalibrationEar)
  ↓
1. SAFETY: schema-validate the signal shape
  ↓
2. DEDUP: does an existing Blood event match (domain, subject.name, type)?
     yes → merge into existing, return; audit drops the duplicate
     no  → continue
  ↓
3. PROPOSED GRAVITY: stamp the gravity the Host AI proposed
                     (or default for non-conversational sources)
  ↓
4. GOVERNANCE FLOOR: cognitive_mode determines the auto-confirm threshold
                     (lightweight: G2-, standard: G1-, institutional: G0-)
                     if below floor → auto-confirm to Blood, audit, return
  ↓
5. TRAUMA ADJACENCY: any trauma event in the same domain with avoid_suggestion?
                     yes → +1 gravity (floor of G2 for trauma-adjacent signals)
  ↓
6. DNA MODULATION: any emerged trait applies to this signal's shape?
                   yes → ±1 gravity per trait
                   if reevaluation_mode is true → skip this step entirely
  ↓
7. FINAL GRAVITY: stamp the resolved gravity
  ↓
8. ROUTING DECISION:
     G0 → dropped (audit log records it; not stored)
     G1 → blood   (auto-confirmed)
     G2 → staged  (governance_required: human_ratified under standard+)
     G3 → staged  (always human_ratified)
  ↓
9. AUDIT: append the routing decision with routing_reason to audit.yaml
```

Nine steps, every signal, every time. The order is fixed.

---

## Why dedup is step 2

Dedup before governance, gravity, trauma, DNA. The reason: if this signal is a duplicate, the smarter version of the question is "should we update the existing event?" not "should we create a new one?"

Specifically, dedup is keyed on `(domain, subject.name, type)`:

- Same `domain` (the same organ)
- Same `subject.name` (the same thing being decided)
- Same `type` (decision / rejection / debt_acceptance / etc.)

A second signal matching that triple merges into the existing event. The merge:

- Updates `updated_at`
- Appends to `source.refs` (so you can trace back to all the times this was reaffirmed)
- Re-evaluates gravity (re-confirmed events can rise but not fall — relevance is monotonic on re-confirm)

The audit log records the merge:

```yaml
- ts: ...
  actor: "system"
  action: "merge"
  target: "evt_087"
  detail: "duplicate signal merged; refs +1"
```

Without dedup, every conversation that mentions an old constraint would create a new Blood event. The directory would inflate, the AI would see duplicates in `cairn_context` output, and the human would lose trust in the system.

---

## Why trauma adjacency is step 5

After governance floor, before DNA. The placement matters:

- **Before governance** would let trauma escalate signals that should have auto-confirmed. Right behavior is: if you're trying to auto-confirm something near a trauma, don't.
- **After DNA** would let DNA modulation override trauma. Wrong order — trauma is harder evidence than emergent personality.

So: governance can shortcut to auto-confirm. Trauma blocks the shortcut. DNA can only further modulate what trauma already escalated. The asymmetry is intentional.

---

## Why DNA modulation is step 6

DNA is the softest of the four modulating forces. It's emergent (statistical), revocable (safety valve), and tunable (cognitive mode controls thresholds).

Putting DNA last means it adjusts within the bounds the other rules already set. If trauma raised the signal to G2, DNA can't drop it to G1. If governance auto-confirmed at G1, DNA never ran. If reevaluation_mode is true, DNA modulation is skipped entirely — the project knows its personality is suspect right now.

When DNA modulates:

- `simplicity_bias: high` + signal is "introduce complexity" → +1 gravity (harder review)
- `simplicity_bias: high` + signal is "remove complexity" → +0 (aligned, no modulation)
- `infra_aggressiveness: low` + signal is "add new infra dependency" → +1 gravity
- `infra_aggressiveness: high` + signal is "add new infra dependency" → -1 gravity (project leans toward it)

Maximum modulation is ±1 per trait. With two traits, max combined is ±2. Bounded.

---

## The `routing_reason` field

Every staged event carries a `routing_reason` string explaining why it landed where it did:

```yaml
routing_reason: "DNA simplicity_bias=high raised gravity G1→G2; G2 needs human ratification under standard mode"
```

This is the **receipt**. When the human reviewer looks at a staged entry, they see exactly which rule(s) brought it there. No magic, no opaque "the system thinks this is important." If they disagree with the routing decision, they reject *with knowledge of why TrustRouter said yes*.

`routing_reason` is also what makes the system debuggable. A bug report of "this should have auto-confirmed" can be answered by reading the reason. A bug report of "this should have been dropped" same.

---

## Why this is "trust," not "rule"

The router is doing **judgment**. Every rule has knobs (cognitive mode, gravity, trauma multiplier, DNA confidence). The rules can disagree (DNA wants to lower, trauma wants to raise). The router resolves the conflict and produces a single output.

The "trust" in TrustRouter is the trust the rest of the system places *in TrustRouter's resolution*. Once it stamps a final gravity and chooses a destination, no other engine second-guesses. BloodEngine writes what was routed. CapillaryStore re-derives. ViewsEngine regenerates. They all trust the router's output as authoritative.

The price of that trust is that TrustRouter has to be **principled, deterministic, and auditable**. The audit log is the proof. The `routing_reason` is the proof. The nine-step path is the proof.

---

## Failure modes

- **Dedup miss** — two phrasings of the same constraint don't dedup because subject.name differs. Mitigation: `subject.aliases` field; Host AI protocol asks for synonyms; CalibrationEar's `no_go_violation` channel catches when duplicates *would have* deduped if structured better.
- **Routing inversion** — trauma adjacency raises gravity but DNA modulation accidentally lowers it back down. Mitigation: rule ordering (trauma is step 5, DNA is step 6); DNA modulation is bounded ±1.
- **Governance shortcut over trauma** — a low-gravity trauma-adjacent signal auto-confirms. Mitigation: trauma adjacency raises gravity *before* the governance check is re-evaluated.

These are real failure shapes. The reverse-regression suite (`tests/scenarios/`) has scenarios for each.

---

## See also

- [`../ii-anatomy/governance.md`](../ii-anatomy/governance.md) — the approval ladder TrustRouter terminates into
- [`../ii-anatomy/gravity.md`](../ii-anatomy/gravity.md) — the weight axis everything is stamped against
- [`calibration.md`](./calibration.md) — the other major engine that feeds TrustRouter
- [`reevaluation.md`](./reevaluation.md) — the safety valve that short-circuits DNA modulation
