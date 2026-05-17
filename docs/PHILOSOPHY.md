# Philosophy

> Why Cairn exists. The "what to build" is downstream of this.

---

## The shift: from code scarcity to cognition scarcity

For decades, software engineering has been organized around one bottleneck: **the cost of producing code**. Git, CI/CD, Cloud, Observability, IaC, Testing — every layer of modern infrastructure exists to make code cheaper, faster, more reliable to write.

AI now collapses that bottleneck. A capable model can:

- Generate new modules end-to-end
- Refactor across files
- Migrate architectures
- Provision infrastructure
- Invent abstractions

The implication is not that humans get faster. It's that **code stops being scarce**. What becomes scarce instead is something the industry never built infrastructure for:

> **Long-term, stable engineering cognition.**

The set of things a project *knows* about itself — what was tried, what failed, what tradeoffs were chosen, what scars remain — does not get cheaper just because code does.

---

## The cognitive collapse

When code is abundant but cognition is scarce, you get a specific failure mode:

```
Code Abundance  ×  Cognitive Scarcity  =  Cognitive Collapse
```

It looks like this in practice:

- AI suggests a library that was rejected six months ago, for reasons the team forgot to write down
- A refactor undoes a hard-won workaround that exists for a production incident no one remembers
- The same architectural argument is re-litigated every quarter
- Junior engineers (human or AI) cannot tell load-bearing code from accidental code
- Trauma — real engineering scars from failures — is invisible to any new agent

The codebase keeps growing. The shared understanding behind it does not.

---

## What is "cognition," operationally?

Cognition in this sense is not memory in the chat-history meaning. It is the **structured, addressable, durable record of what a project has learned about itself**. Specifically:

- **History path dependence** — what was attempted, what was discarded, in what order
- **Trauma memory** — incidents that left scars and now bias decisions
- **Tradeoff understanding** — why X over Y, not just X
- **Organizational reality** — constraints that come from team size, ownership, deadlines
- **Technical debt awareness** — which debt was accepted on purpose vs leaked in
- **Architectural boundaries** — which lines must not cross
- **Project personality** — emergent biases that shape every micro-decision

A model can read code and tell you *what* the system is. It cannot, from the code alone, tell you *why the system became what it is*. That gap is where Cairn lives.

---

## Cairn is not a memory system

The naive framing — "give the AI a memory" — leads to chat-log buckets, vector databases, "remember this for next time." That solves recall, not cognition. Recall without structure is hoarding.

Cairn is a **cognitive thermodynamics system**: an active runtime that:

- **Captures** cognition from real engineering activity (commits, conversations, code-reality drift)
- **Routes** raw signal through a trust pipeline (TrustRouter) that filters noise and weights by gravity
- **Stages** uncertain captures for human ratification
- **Compresses** repeated patterns into emergent personality (DNA)
- **Decays** unused cognition so the project doesn't drown in old context
- **Resurrects** archived cognition the moment it becomes relevant again
- **Calibrates** itself against code reality so cognition can't silently drift from truth

The verbs are active. Cognition is not stored; it is *maintained* — against entropy.

---

## The project as a cognitive organism

Cairn treats a software project as a **path-dependent cognitive organism**, with anatomy:

| Subsystem | Role | Analogy |
|-----------|------|---------|
| **Skeleton** | Stable domain ownership map | Bones |
| **Capillaries** | Per-domain constraint detail | Capillaries |
| **Blood** | Stream of evolution events | Blood — flowing, oxygenating |
| **DNA** | Emergent personality traits | Genome |
| **Gravity** | Decision weight axis (G0–G3) | Mass |
| **Governance** | Human-ratified approval gate | Conscious decision |

These are not metaphors layered on a database. They are the operational structure that makes the system work: Skeleton indexes Blood for retrieval, Blood feeds Compression which proposes DNA, DNA modulates TrustRouter which routes new Signals, calibration detects when DNA has drifted from reality and triggers reevaluation — a closed loop.

---

## Three principles

### 1. Durable Cognition

Cognition must outlive the people, the AI agents, and the chat sessions that produced it. It lives as YAML on disk, in git history, alongside the code it describes. A new agent — human or AI — can read `.cairn/` and inherit the project's accumulated learning without re-experiencing every old mistake.

### 2. Decision Gravity

Not every decision matters equally. A naming choice in a test file is not a database migration. Cairn uses four gravity levels (G0–G3) to scale process to weight. G0 noise is dropped at the door; G3 project-defining constraints always require human ratification. The cost of governance scales with the weight of the decision, not the volume of activity.

### 3. Cognitive Lifecycle

Cognition is born, lives, ages, and can die. Cairn explicitly models lifecycle:

- **Capture** — raw signal → staged candidate
- **Confirm** — human ratification → Blood event
- **Activate** — read at decision time → records a hit
- **Decay** — unused over time → archived
- **Resurrect** — relevant again → returned to active
- **Compress** — repeated → DNA trait candidate
- **Drift** — code reality diverges → calibration signal
- **Reevaluate** — pressure too high → safety valve flips DNA

A constraint that no one bumps into for 18 months is probably dead, and pretending otherwise is *worse* than forgetting — it makes the system look stricter than it is.

---

## What Cairn is not

| Cairn is not | Because |
|--------------|---------|
| A vector database of chat | Recall ≠ cognition; structure matters more than coverage |
| An ADR repository | ADRs are passive — read when humans remember to. Cairn is queried actively by the AI on every decision |
| A linter | Cairn does not enforce style; it informs choices that don't have a single right answer |
| A documentation generator | Docs describe the system. Cairn records *why the system became this way* |
| A replacement for human judgment | Final ratification is always human; AI proposes, Cairn structures, humans decide |

---

## Compared to ADRs

Architecture Decision Records (ADRs) are the closest existing concept. The differences:

| Axis | ADRs | Cairn Evolution Events |
|------|------|------------------------|
| Audience | Humans, read on demand | AI, queried on every decision |
| Lifecycle | Written once, rarely revisited | Decay / resurrection / compression / safety valve |
| Granularity | Major architectural choices | Any decision worth G1+ — including rejections |
| Trauma | Postmortems live elsewhere | First-class `trauma: true` flag with gravity uplift |
| Drift | Manual upkeep | `CalibrationEar` detects code-reality drift automatically |
| Emergence | None | Patterns compress into DNA traits |
| Source | Hand-authored | Captured from git + conversation; AI drafts, human ratifies |

ADRs are not wrong. They are the same idea seen one step earlier, before AI made cognition the bottleneck. Cairn is the operational, AI-native form of the same impulse.

---

## What "good" looks like

A project running Cairn for a year should show:

- 50–200 Blood events covering decisions large and small, with clear rejection traces
- 1–3 DNA traits that emerged from real patterns, ratified by humans
- A handful of trauma events tied to real incidents, never decayed
- `cairn_context` responding to "should we introduce X?" with five sentences a human author would actually agree with
- New contributors (and new AI agents) onboarding by reading `.cairn/views/output.md` rather than asking around

The win condition is not that AI gets smarter. It is that **the project stops losing what it learned**.

---

## See also

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the philosophy becomes a system
- [`SCHEMA.md`](./SCHEMA.md) — what the on-disk artifacts actually look like
- [`GLOSSARY.md`](./GLOSSARY.md) — terms used everywhere
- [`internal/philosophy.zh.md`](./internal/philosophy.zh.md) — original Chinese draft (source of intent for this English doc)
