# Capillaries

> Capillaries are where blood actually reaches the cells. Blood flowing through arteries is invisible to the tissue it serves; capillaries make it usable, locally.

---

## What it is

**Capillaries** are the per-domain projection of Blood. For each domain in `config.yaml.domains`, three YAML files at `.cairn/domains/<domain>/`:

- `constraints.yaml` — active constraints scoped to this domain
- `accepted_debt.yaml` — debts the team consciously chose to live with
- `rejected_paths.yaml` — directions that have been tried or evaluated and ruled out

These are **derived**, not authored. BloodEngine auto-syncs them every time a relevant Blood event lands or changes. You should never hand-edit them — they regenerate from Blood.

---

## Why a separate projection

Blood is rich and global. Each event is 40 fields. The full Blood directory of an old project is hundreds of files.

When the AI is about to write a function in the `data` domain, it doesn't need *every* Blood event. It needs the answer to:

- "What constraints apply *here*?"
- "What debts has the team accepted *here*?"
- "What paths have been ruled out *here*?"

Capillaries are that **focused, ready-to-consume** view. The activation path uses them directly:

```
cairn_context({ task })
  → skeleton match → domains
  → load each domain's capillaries
  → fold their constraints/debts/rejections into the result
```

Without capillaries, every activation would have to load all of Blood and filter on the fly. With them, the activation is O(domains touched), not O(blood size).

---

## What real ones look like

```yaml
# .cairn/domains/data/constraints.yaml
domain: "data"
constraints:
  - id: "c_ledger_acid"
    text: "Ledger storage must be ACID; no eventually-consistent stores"
    source_event: "evt_087"
  - id: "c_no_orm_for_ledger"
    text: "Ledger queries are raw SQL; ORM banned for ledger tables"
    source_event: "evt_104"
```

```yaml
# .cairn/domains/data/accepted_debt.yaml
domain: "data"
debts:
  - id: "d_cache_invalidation"
    text: "Skip cache invalidation for /products; reads are rare"
    source_event: "evt_124"
    revisit_when: ["cache miss rate > 5%", "products updated > 1/min"]
```

```yaml
# .cairn/domains/data/rejected_paths.yaml
domain: "data"
paths:
  - id: "p_mongodb_ledger"
    path: "MongoDB for ledger data"
    reason: "see evt_087 — sharding corrupted ledger writes"
    source_event: "evt_087"
  - id: "p_orm_ledger"
    path: "Prisma / TypeORM for ledger queries"
    reason: "ORM-generated SQL hid the bug from evt_087; raw SQL only"
    source_event: "evt_104"
```

Field names are deliberate: `debts` (not `items`), `paths` (not `items`). The schema enforces this. A common early-stage bug is writing `items:` — the file parses successfully but produces empty arrays, masking constraints invisibly. CalibrationEar catches this; `cairn doctor --fix` quarantines it.

---

## The "auto-synced" contract

When a new Blood event lands with `affects.domains: ["data"]`:

```
BloodEngine.commit(event)
  ↓
DomainStore.syncFromBlood("data")
  ↓
re-derives constraints.yaml / accepted_debt.yaml / rejected_paths.yaml for "data"
  ↓
writes atomically (write + rename)
```

Same when an event is archived (`health.state = stale`) or downgraded — capillaries re-derive without that event's contribution.

There is no caching, no manual sync. The contract is: **if Blood changed, capillaries are correct by the time the next read happens**.

---

## Why this is its own organ, not a query view

A reasonable engineering reflex says: "this should be a SQL view, not a stored projection." That reflex is wrong here, for three reasons:

1. **Git-tracked.** A SQL view doesn't live in git. Capillary YAML files do, which means PR reviews show capillary changes as a diff. "This PR adds a new rejected path under `data`" is visible in plain text in code review.

2. **Degraded-mode usable.** When the `cairn` CLI is unavailable and the AI is reading `.cairn/views/output.md` directly (or even the raw YAML), capillaries are flat, simple, and don't require executing a query engine.

3. **Schema-validated.** Each capillary file is a typed Zod schema. The discipline of "this is real data with a real shape" propagates outward — you can write a small script that reads `accepted_debt.yaml` and produces a debt-aging report; nobody had to design an API for that.

The cost is a write amplification on every Blood change. That cost is bounded — domains are O(10), capillary files are O(30), each is small — and dwarfed by the activation-time benefit.

---

## Philosophy: information has to be *local* to be used

The phrase "the project knows X" is meaningless if X is buried in the 87th yaml under blood/ and nobody asks the right question. Knowledge that exists is not the same as knowledge that is **reachable from where the decision is being made**.

Capillaries are how Cairn enforces that locality. Every domain has its own three-yaml summary of what cognition applies *here*. The AI working on `data` does not need to know that `auth` exists. It needs the `data` capillaries, in their full and current shape, in milliseconds.

This is also why `views/output.md` exists separately — a *human*-shaped projection for the degraded mode. Same underlying Blood; different audience; different shape; both auto-derived.

---

## Failure modes

- **Capillary drift** — schema is wrong (e.g., field renamed in Blood) and capillaries silently stop syncing. `cairn doctor --fix` catches this by re-deriving and comparing.
- **Capillary inflation** — domain is too broad; capillary files grow into hundreds of constraints. Mitigation: split the domain (Skeleton edit), or accept that this domain genuinely has 200 constraints.
- **Hand-edited capillary** — someone bypasses the contract. Next Blood change overwrites their edit. Don't do this. (The system doesn't try to detect it explicitly; the auto-sync just wins.)

---

## See also

- [`blood.md`](./blood.md) — the source of truth that capillaries project
- [`skeleton.md`](./skeleton.md) — how domains get declared in the first place
- [`../iii-life/capture-and-ratify.md`](../iii-life/capture-and-ratify.md) — the path that lands new constraints in capillaries
- [`../v-intervene/tend.md`](../v-intervene/tend.md) — when to use `cairn doctor --fix` if capillaries look wrong
