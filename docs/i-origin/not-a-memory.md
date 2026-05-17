# Not a Memory System

> "Cairn is a memory plugin" is the wrong sentence. Memory is recall. Cairn is cognition. They are not the same thing.

---

## The framing trap

When people first hear "long-term memory for AI," they reach for the nearest analog:

- A vector database of chat history
- An embedding store with retrieval
- A knowledge graph
- A wiki the AI can read

Each of these is a **recall system**: given a query, return relevant past content. Recall is a real and useful thing. It is also **not what this layer is for**.

Recall without structure is hoarding. Hoarding is worse than forgetting when the agent is making decisions on the margin — and decisions on the margin are most of what AI coding agents do.

---

## What recall systems miss

Imagine a perfect recall system. Every conversation, every commit message, every PR comment, every Slack thread is indexed. Ask "should we use Redis here?" and it returns the twelve most semantically similar moments from the past three years.

Now you are the AI. You have twelve snippets. They are inconsistent with each other (some pro, some con). You don't know which was binding. You don't know if any of them have been overridden since. You don't know which had gravity (a team-wide decision) and which were one engineer's preference. You don't know if a *related but unmentioned* trauma applies. You don't know if the project's overall taste has shifted in the meantime.

You return a confident answer. It is wrong.

That is the failure mode of recall-as-cognition. **The retrieval succeeded. The decision failed.**

---

## The seven things cognition needs that recall doesn't give

A cognition layer has to do all of these, simultaneously, before recall is useful:

| | What recall does | What cognition needs |
|---|---|---|
| **Capture** | Whatever was said | Distinguish signal from chatter |
| **Trust** | All sources equal | Source confidence + verification status |
| **Gravity** | Flat | G0 (noise) → G3 (project-defining) |
| **Lifecycle** | Stored forever | Decay → resurrection → compression |
| **Drift** | Static against reality | Calibration against current code |
| **Personality** | None | DNA traits emerging from repeated patterns |
| **Approval** | None | Human ratification gates for high-gravity changes |

Strip any of these out and you fall back to recall. Recall is sediment. Cognition is process.

---

## Cairn is not a database

It is convenient to describe Cairn as "files on disk" because the files are real (`.cairn/`, git-tracked YAML). But the files are not the system. The files are the *export format*. The system is the runtime:

- TrustRouter that filters noise
- Decay engine that ages cognition
- Resurrection engine that revives the relevant
- Compression engine that surfaces personality
- Calibration ear that checks against reality
- Safety valve that pauses traits when they drift

Take any of these away and the files become a slow Notion. Add them and the files become something different in kind — an **active maintenance layer for engineering cognition**.

---

## Comparisons, point by point

| | Vector DB of chat | ADR repository | Cairn |
|---|---|---|---|
| Granularity | Free text | Major decisions only | Any decision G1+, including rejections |
| Audience | Humans search; AI sometimes | Humans, when remembered | AI, queried at decision time |
| Lifecycle | Stored forever | Stored forever | Decay → resurrect → compress → reevaluate |
| Drift handling | Manual | Manual | Automated via CalibrationEar |
| Personality | None | None | DNA traits emerge from repeated patterns |
| Trauma | None | Postmortems separately | First-class flag, never decays, raises challenge sensitivity |
| Compared-to-reality | None | Manual review | Continuous |
| Gravity | None | None | G0–G3 explicit |
| Governance | None | Sometimes | 3-tier ratification gate per cognitive_mode |
| Code-adjacent | Sometimes | Loose | Always (git-tracked, in repo) |

Each row is a thing recall systems and ADR repos cannot do, that a project running for two years needs at least once a week.

---

## Cairn is not a linter

A linter says "this code violates a rule." It applies to syntactic and shallow semantic checks where there is a single right answer.

Cairn applies where there is **not** a single right answer — where the same suggestion could be correct in one project and disastrous in another, and the difference lives in the project's history, not in any general principle. The output of `cairn_context` is not enforcement. It is **informed advisory**: "in this project, this direction has been closed before, here is why, here is what was tried instead." The AI still has to make a call. Humans still have to ratify. Cairn is the substrate that makes those calls and ratifications informed.

---

## Cairn is not a replacement for human judgment

Every high-gravity event passes through `human_ratified` governance. Every DNA trait must be human-ratified before it modulates routing. Every emerged personality trait is revocable. The system is *built* around the assumption that the final call is human.

The win is not "AI replaces human judgment." The win is "human judgment is no longer the bottleneck for *encoding* what humans decided — that part becomes ambient."

---

## Where the word "memory" goes wrong

The word *memory* implies a passive retrieval surface. The right metaphor for what Cairn does is **maintenance** — the ongoing, active work of keeping a structure alive against entropy, the way a forest is maintained, the way a body is maintained, the way a long-running project is maintained by the humans who care about it.

Cognition is something a project *does*, not something a project *has*. Cairn is what makes the doing possible after the original humans have moved on.

---

## See also

- [`code-abundance.md`](./code-abundance.md) — why this distinction matters now
- [`cognitive-collapse.md`](./cognitive-collapse.md) — the failure mode this prevents
- [`../iv-self/`](../iv-self/) — the self-checking machinery (TrustRouter, calibration, safety valve) that makes cognition cognition and not recall
