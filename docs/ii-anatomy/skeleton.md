# Skeleton

> Bones do not move. They give everything else a place to attach.

---

## What it is

The **Skeleton** is the project's domain ownership map. One YAML file per declared domain at `.cairn/skeleton/<domain>.yaml`. Each file declares:

- What this domain **owns** (capabilities, files, behaviors)
- What it **does not own** (so the boundaries are addressable, not implicit)
- Its **causal_keywords** — the activation index, used by `cairn_context` to match incoming tasks
- Its **dependencies** on other domains
- Its **archetype** (`service`, `library`, `gateway`, ...)

Skeleton is the most stable layer of cognition. Domain boundaries change once a year, not once a sprint.

---

## Why it has to exist

Without a Skeleton, there is no way to *route* incoming questions. Every Blood event, every constraint, every DNA trait is scoped to one or more domains. When the AI asks `cairn_context({ task: "add caching to the orders endpoint" })`, Cairn needs to:

1. Decide which domain(s) this task touches
2. Pull only the cognition relevant to those domains

Without step 1, step 2 collapses into "return everything," which collapses back into recall, which is what we are trying not to be (see [`../i-origin/not-a-memory.md`](../i-origin/not-a-memory.md)).

Skeleton is the **causal index**. It is also the answer to "where does this thing belong?" when a piece of cognition arrives without obvious scope.

---

## What a real one looks like

```yaml
domain: "api"
role: "primary"
owns:
  - "Public REST endpoints"
  - "Request/response shapes"
  - "Rate limiting decisions"
does_not_own:
  - "Database schema"        # owned by data
  - "Auth tokens"            # owned by auth
causal_keywords:
  - "api"
  - "endpoint"
  - "REST"
  - "/v1/"
  - "rate limit"
dependencies:
  - "data"
  - "auth"
files:
  - "src/api/**"
  - "src/middleware/**"
archetype: "service"
last_updated: "2026-04-01"
```

Reading guide for that file:

- The `owns` / `does_not_own` pair is a **negative space declaration**. Most software docs forget the second half. Cairn requires it because the *seams between domains* are where cognition lives most heavily — what does *not* belong here is half the wisdom.
- `causal_keywords` are the entry points to the activation graph. If you ask "improve rate limiting," the token `rate` matches and the entire `api` domain is loaded.
- `files` is a soft hint, not a constraint. Files can belong to multiple skeletons in messy real projects.

---

## How it is used

```
task: "improve caching for the products endpoint"
        ↓
[ActivationEngine] tokenizes the task
        ↓
matches against every skeleton's causal_keywords
        ↓
loads matching skeletons → expands to their domain capillaries → traverses their Blood
        ↓
returns the focused context bundle
```

The match is currently exact-token. This is a known weakness — see [`../i-origin/`](../i-origin/) discussion of the bottleneck moving. Stemming, synonyms, and fuzzy matching are on the 0.5 line.

---

## The philosophy under the structure

A project's organs (data, api, auth, ui, infra, ...) are not a database schema. They are **the unit at which engineering judgment is local**. When someone says "we never use Redis," they almost always mean "we never use Redis *for caching in our data layer*" — not "we never use Redis for anything." Skeleton is what makes that scope explicit.

It is also the only layer where the human is expected to do significant **declaration** rather than capture. `cairn_init_commit` proposes a Skeleton from the codebase, but ratifying it is a real act of judgment — "yes, this is how I think about my project's organs." Once ratified, it provides the coordinate system everything else hangs on.

---

## What changes Skeleton

Skeleton changes when **domain boundaries change**:

- New service extracted → new skeleton file
- Two domains merged → one skeleton file absorbs the other
- A capability moves between domains → both `owns` lists update

Each of these is a high-gravity event. The Skeleton itself does not decay — it is structural, not eventful. When it changes, you change it deliberately (often via a `cairn_signal` that captures the architectural decision into Blood, then a manual skeleton edit).

---

## Failure modes

- **Skeleton too coarse** — `causal_keywords` are generic ("util", "helper"). Every task matches. Activation returns everything. Same as no skeleton.
- **Skeleton too narrow** — keywords are project-internal jargon. Tasks miss. Activation returns nothing. Same as no skeleton.
- **Skeleton out of date** — the codebase moved, the skeleton didn't. CalibrationEar emits `skeleton_drift` signals. See [`../iv-self/calibration.md`](../iv-self/calibration.md).

The right zoom level is one most teams find within their first month of dogfood.

---

## See also

- [`capillaries.md`](./capillaries.md) — the per-domain constraint detail Skeleton expands into
- [`blood.md`](./blood.md) — the events Skeleton routes you toward
- [`../v-intervene/enter.md`](../v-intervene/enter.md) — how the initial Skeleton gets proposed during `cairn_init_commit`
