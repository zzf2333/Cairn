# Trauma

> A team that has bled doesn't have an opinion. It has a scar. The system has to treat the two differently.

---

## The distinction

A preference is a soft pattern: "we generally favor X over Y." It can be argued with, reevaluated, eventually flipped.

A scar is hard. It comes from a specific incident with specific cost — a 3 AM page, a data loss, a billing error, a security incident, a customer apology call. The team has *paid* for the knowledge. The knowledge is therefore weighted differently.

Cairn distinguishes these with `trauma.is_trauma: true` on the Evolution Event. The flag is small. The behavioral implications are large.

---

## What a trauma event looks like

```yaml
id: "evt_087"
time: "2024-11-03"
domain: "data"
type: "incident_record"

gravity:
  level: "G3"

source:
  type: "incident"
  refs:
    - { type: "postmortem", id: "PM-2024-014" }

subject:
  name: "mongodb"

trigger: "Sharding migration corrupted ledger writes during failover"
decision_or_change: "Remove MongoDB; migrate ledger to Postgres strict serializable"

behavior_effect:
  type: "avoid_suggestion"
  instruction: "Do not propose MongoDB or document-store DBs for ledger data."

lifecycle:
  validity: "strategic"
  decay_policy: "never"        # the load-bearing line

trauma:
  is_trauma: true
  severity: "high"             # low | medium | high
  sensitivity_multiplier: 1.8  # raises challenge sensitivity in adjacent decisions
```

Two fields do the work: `trauma.is_trauma` and `lifecycle.decay_policy: "never"`. Together they mean: this event will not decay, will not auto-confirm into noise, and will raise the bar on every related decision.

---

## The five rules trauma triggers

When `trauma.is_trauma: true`, TrustRouter and the lifecycle engines apply five rules:

**1. Never auto-confirms.** Even at G1 in `lightweight` mode, trauma events always pass through `staged`. The "human ratifies trauma" rule is non-negotiable. The team has to *agree* this is scar tissue, not preference.

**2. Gravity floor of G2.** Trauma's `gravity.level` cannot be below G2. If a Host AI proposes G1 for a signal that ends up trauma-flagged, TrustRouter raises it.

**3. Never decays.** `decay_policy: "never"` exempts the event from `DecayEngine`. An event from 2024 about data loss in the ledger module is just as active in 2027 as the day it was written. This is the explicit refusal of "we forgot why we don't do that."

**4. Activation priority.** When `cairn_context` retrieves Blood for a task, trauma events sort *first* in the results, regardless of recency. Their presence is the first thing the AI sees.

**5. Domain-wide sensitivity uplift.** A trauma event in `data` raises the **challenge sensitivity** of every adjacent decision in `data` — meaning, signals that would be `suggestion` strength become `reflective_challenge`, signals that would be `reflective_challenge` become `hard_constraint`. The multiplier is `trauma.sensitivity_multiplier` (default 1.5, can be set 1.0–2.0).

That last rule is the most important and most subtle. Trauma doesn't just make *the specific rejection* stricter. It makes the *whole domain* more vigilant. A team that has had a data-loss incident in `data` should be skittish about *anything* novel in `data`, not just the specific tool that caused the original loss.

---

## How trauma is set

Three paths:

**1. AI-proposed during `cairn_init_commit`.** If the AI is analyzing a project for the first time and sees evidence of postmortems / incidents / "we tried X and it was a disaster" patterns, it proposes `trauma: true` on the relevant events. Human ratifies during the dry-run review.

**2. AI-proposed during `cairn_signal`.** A turn where the user says "we tried MongoDB and it took down billing for 6 hours" is a trauma signal. The AI proposes `trauma: { is_trauma: true, severity: "high" }`. TrustRouter routes to staged; human ratifies.

**3. CLI escalation.** `cairn blood trauma <id>` flips an existing event to trauma. Used when a non-trauma event reveals its true weight later (e.g., what looked like a preference turns out to have an incident behind it).

In all three paths, **the human has to explicitly accept**. Trauma is not auto-detected from prose alone. The cost of false-positive trauma (incorrectly hardening a domain) is real; the system errs on requiring confirmation.

---

## Why trauma is a *first-class* flag, not just "gravity = G3"

A G3 event is heavy. A G3 trauma event is *heavier in a different way*:

- G3 says "this is project-defining"
- Trauma says "this is project-defining *because we already paid the price once*"

The difference matters operationally:

| Concern | G3 (no trauma) | G3 (trauma) |
|---------|---------------|-------------|
| Can decay | Yes (slowly) | No (never) |
| Can auto-confirm | No | No (same) |
| Activation priority | High | Highest |
| Challenge multiplier on domain | 1.0 | `sensitivity_multiplier` (≈ 1.5–2.0) |
| Visible to AI | Yes | Yes, with `trauma_history` annotation |
| Visible to user in `cairn doctor` | Yes | Yes, separately listed |

The annotation "this is a trauma event from a specific incident" gets surfaced in `cairn_context` output — the AI doesn't just see "no MongoDB"; it sees "no MongoDB *because of a real production failure*." The provenance is part of the signal.

---

## The philosophical stake

Soft cognition can be argued away. Hard cognition cannot — without the team explicitly *deciding* to put themselves back in the position to bleed again. That second decision is a real act, and it should be visible.

Trauma is Cairn's mechanism for distinguishing the two. When a future engineer (or AI agent) wants to argue *"but we should reconsider MongoDB,"* the trauma flag forces them to engage with the specific incident, not the abstract "we don't use MongoDB" preference. They have to reckon with the postmortem. They have to propose specifically what's different now.

If the answer is good, the team can flip the trauma flag (via `cairn dna reevaluate`-style review). Reevaluation is allowed. **Forgetting is not.**

---

## Failure modes

- **Trauma inflation** — every rejection gets marked trauma; the domain becomes paralyzed. Mitigation: human ratification gate; `cairn doctor` shows trauma-event-count per domain; CalibrationEar warns if a domain has > 5 trauma events.
- **Trauma blindness** — real incidents don't get captured as trauma because the AI didn't detect the incident pattern. Mitigation: the Host AI's protocol explicitly checks for "did this involve a real incident / data loss / customer harm?"; CLI `cairn blood trauma <id>` is the manual escape hatch.
- **Trauma scope creep** — a trauma about MongoDB-in-ledger raises sensitivity for all of `data`, including unrelated submodules. Mitigation: narrow `trauma.domain` (or split the domain in Skeleton); the multiplier is intentionally bounded.

---

## See also

- [`../ii-anatomy/gravity.md`](../ii-anatomy/gravity.md) — the weight axis trauma interacts with
- [`../iv-self/trust-router.md`](../iv-self/trust-router.md) — where the trauma rules are applied
- [`decay-and-resurrection.md`](./decay-and-resurrection.md) — the lifecycle trauma exempts itself from
- [`../v-intervene/tend.md`](../v-intervene/tend.md) — how to manually mark or unmark trauma
