# Gravity

> A decision about how to name a test variable does not weigh the same as a decision to deprecate a database. Treating them the same is the most expensive mistake a memory system can make.

---

## What it is

**Gravity** is the decision-weight axis. Four levels:

| Level | Name | Examples |
|-------|------|----------|
| **G0** | Noise | Variable rename. Code style. Typo correction. Routine bug fix. |
| **G1** | Local detail | Function-level choice. One module's logging format. Test fixture decision. |
| **G2** | Module-scoped decision | Domain-level pattern. New library used in one domain. Module's caching strategy. |
| **G3** | Project-defining constraint | Architectural rule. Trauma-driven rejection. Compliance constraint. Cross-domain invariant. |

Every signal that enters TrustRouter gets stamped with a gravity level. Every Blood event carries its gravity in `gravity.level`. Every governance decision uses gravity to choose its approval threshold.

Gravity is the dial that lets Cairn say "this matters more" without falling back on "everything matters."

---

## Why a flat memory is wrong

The naive memory design treats every captured fact equally. Add to a vector store, retrieve, return.

The problem with flat memory:

- A small project produces thousands of small decisions. Storing all of them at "important" weight means none of them is important. The valuable ones drown.
- An AI consuming flat memory either re-ranks heuristically (slow, often wrong) or treats all results as equal (always wrong).
- Humans burn out reviewing low-stakes items at high-stakes intensity.

Gravity is the rejection of flatness. It says: **the cost of process should scale with the cost of getting the decision wrong**.

---

## How gravity routes

In TrustRouter, gravity is what selects the destination:

```
Signal arrives
  ↓
Dedup ✓
  ↓
Trauma adjacency? → +1 gravity
  ↓
DNA modulation? → ±1 gravity (if a trait applies)
  ↓
Final gravity stamped
  ↓
─ G0 ──→ dropped (audit log records the drop)
─ G1 ──→ blood (auto-confirmed, mode permitting)
─ G2 ──→ staged (needs human ratification under `standard`/`institutional`)
─ G3 ──→ staged (always)
```

The exact "G2 → staged vs auto-confirmed" line moves with `cognitive_mode`:

| Mode | G2 threshold | G3 threshold |
|------|--------------|--------------|
| `lightweight` | auto-confirm | staged |
| `standard` | staged | staged |
| `institutional` | staged | staged |

See [`../iv-self/trust-router.md`](../iv-self/trust-router.md) for the full routing decision flow.

---

## How gravity is initially assigned

The Host AI proposes a gravity level on every `cairn_signal` call, guided by the protocol in `skills/cairn/SKILL.md`:

- "User rejected X with a stated reason" → typically G2 (G3 if the reason involves incident / compliance / structural decision)
- "User mentioned past attempt at X" → G1 (raise via TrustRouter if it merges with an existing G2 event)
- "User stated a project-wide constraint" → G3
- "User accepted technical debt" → G1 or G2 depending on scope

TrustRouter does not blindly trust the proposed gravity. Adjustments happen automatically:

- **Trauma adjacency** raises gravity by one
- **DNA modulation** can raise or lower by one
- **Governance floor** prevents gravity from being lower than the cognitive mode allows for the signal type

---

## The trauma + gravity rule

Trauma events have a **floor**: gravity is always **G2 or higher**. Even if a Host AI proposes "G1 — minor preference," if the event has `trauma.is_trauma: true`, TrustRouter raises it to G2 minimum. This is because trauma exists precisely *because* the team underweighted something once and paid for it — Cairn refuses to make the same mistake twice.

---

## Why four levels

Not three (too coarse, "important" becomes a meaningless bucket). Not five (the middle bucket becomes a dumping ground). Four gives:

- A bottom that is *actually dropped* (G0)
- A bottom-active that auto-confirms locally (G1)
- A middle that requires human review under standard mode (G2)
- A top that always requires human review (G3)

The asymmetry is deliberate. Most events are G1. G2 is where most human review effort goes. G3 is rare — when it happens it's an event the team wants to take seriously.

---

## Gravity in the wild

Looking at a real `.cairn/blood/` directory after a year of dogfood:

| Gravity | Typical share | What's in it |
|---------|---------------|--------------|
| G0 | ~5% (dropped, audit-only) | False starts, dedup victims |
| G1 | ~60% | Tactical local decisions; quietly maintained |
| G2 | ~30% | Module-scoped patterns; the bulk of human review |
| G3 | ~5% | Architectural rules, trauma, compliance |

If the distribution is wildly different — say 50% G3 — the team is over-stamping. CalibrationEar warns; gravity inflation is a real failure mode.

---

## What gravity is not

- **Not popularity.** A G3 event is not "the AI cares a lot." It's "this is structurally load-bearing."
- **Not certainty.** A G3 event can still be revoked through reevaluation if the project's reality shifts.
- **Not permanence.** Gravity can decay: a G2 event idle for the decay window can downgrade to G1, and a G1 to G0 (archive).

Gravity is **how strict to be right now**, given current evidence and current state. Like literal gravity, it is real, scalar, and context-dependent.

---

## Failure modes

- **Gravity inflation** — too many events stamped G3, governance burden explodes. Mitigation: CalibrationEar warns when G3 share crosses a threshold.
- **Gravity sandbagging** — AI consistently proposes low gravity to avoid staged review. Mitigation: trauma adjacency + governance floor + audit log review.
- **Gravity decoupled from reality** — a G3 event becomes irrelevant; it stays G3 because no one runs the maintenance pipeline. Mitigation: `cairn_session_end`'s decay pass; resurrection check.

---

## See also

- [`../iv-self/trust-router.md`](../iv-self/trust-router.md) — the routing decision tree gravity drives
- [`../iii-life/decay-and-resurrection.md`](../iii-life/decay-and-resurrection.md) — how gravity changes over time
- [`governance.md`](./governance.md) — the approval ladder gravity intersects with
- [`../vi-coordinates/glossary.md`](../vi-coordinates/glossary.md#gravity) — quick reference
