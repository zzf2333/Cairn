# Cognitive Collapse

> The failure mode is not loud. It looks like productivity. That is what makes it bad.

---

## You have already lived this

A team's project has been alive for three years. Five engineers, two PMs, one principal who has been there since the beginning. AI agents have been allowed in for the last fourteen months.

It is a Tuesday. A new contributor — human or AI — opens a ticket: *"Add caching for the `/products` endpoint."*

The AI reads the codebase. It is competent. It sees Express, it sees Postgres, it sees no existing cache layer. It generates a clean implementation with Redis. Maybe even tests.

The team reviews. Someone says: *"We can't use Redis. We rejected it last November after the ops team explained the on-call cost. Use in-process LRU."*

The AI updates the PR. Implementation switches to LRU. Merged. Two weeks later: same project, different ticket, different conversation, same AI agent, different session. *"Add caching for the `/orders` endpoint."* The AI proposes Redis again.

No one is at fault. The AI did not have access to the rejection. The rejection lived in:

- A Slack thread that scrolled away
- A meeting where it was decided out loud
- The principal's head, where it still lives, but the principal is on PTO
- A line in the ops team's runbook that nobody reads

This loop — *team rejects X → AI re-proposes X → team rejects X again* — is the visible surface of a deeper failure.

---

## The deeper failure

Software projects accumulate cognition in three layers:

| Layer | Contents | Property |
|-------|----------|----------|
| **Surface** | Code, tests, configs | Machine-readable, AI can read it |
| **Mid** | Commit messages, ADRs, postmortems | Human-readable, AI mostly can't query it |
| **Deep** | Reasons for rejections, accepted debts, scar tissue from incidents, emergent biases | Lives in human heads + lost meetings |

Code is what the project *is*. The mid and deep layers are why the project *became* this. Without them, every new agent — human or AI — has to either:

1. Re-discover the deep layer by making the same mistakes again, or
2. Pretend it doesn't exist and produce competent, *contextually wrong* work

AI is competent enough at (2) to make (1) deniable. That is the trap. Your output looks great. The code compiles, the tests pass, the PR ships. You only notice when production breaks for a reason that was foreseen, written down somewhere, and forgotten.

---

## The shape of the collapse

> **Code Abundance × Cognitive Scarcity = Cognitive Collapse**

When code production is fast and cognition production is slow, the gap between them widens with every commit. The codebase grows; the shared understanding of *why* the codebase looks this way does not.

Symptoms, in escalating order:

1. **Re-litigation** — same architectural question gets debated quarterly
2. **Trauma blindness** — incidents replay because their lessons aren't addressable
3. **Debt confusion** — accidental debt and accepted debt become indistinguishable
4. **Onboarding rot** — new contributors (especially AI) take longer to ramp despite better tools
5. **Suggestion arbitrage** — AI proposes whatever the broader internet considers idiomatic, regardless of project history
6. **Personality drift** — the project's accumulated taste evaporates with every team turnover

The endgame is a codebase that is technically sound and historically amnesic.

---

## Why the obvious fixes don't fix it

**"Just write better ADRs."** ADRs are written when humans remember to write them, for decisions humans deem worth recording. The granularity is wrong; the rate is wrong; the cardinality of decisions an AI cares about is two orders of magnitude higher than what gets ADR'd.

**"Just give the AI a vector database of chat history."** Recall is not cognition. A bag of past conversations doesn't tell the AI *which* rejection is currently binding, what its gravity is, whether it has been revisited, whether trauma applies, whether DNA modulates the call. Recall returns everything; cognition returns *the right thing for this decision now*.

**"Just write a CLAUDE.md."** Static instructions don't decay, don't compress, don't get challenged by reality. They become wallpaper.

**"Better prompts."** Compression of human judgment into pre-session instructions. Bounded by the human's recall in that moment. Same root limit.

The right fix is not to make the existing channels smarter. It is to add a new channel — one that is **active, structured, decaying, drift-aware, and queried at decision time** — and accept that this is a different kind of infrastructure layer from anything currently in the toolchain.

---

## What Cairn changes

Concretely: in the same scenario from the top of this page,

- `cairn_signal` was called when the team rejected Redis last November
- TrustRouter stamped it as G3, trauma-adjacent (the on-call cost was incident-driven), and routed it to `staged`
- A human ratified it within a day; it became Blood event `evt_087`
- When the new "/orders caching" ticket arrives, the AI calls `cairn_context` first
- Cairn returns `no_go: [{ what: 'redis', reason: 'rejected 2024-11 for on-call cost; see evt_087' }]` + a `simplicity_bias: high` DNA trait
- The AI proposes in-process LRU on the first turn, citing the constraint

The loop closes before the conversation starts. The team stops paying re-litigation tax.

This is the win condition. Not "the AI is smarter." The AI is the same. The project just **stopped losing what it learned**.

---

## See also

- [`code-abundance.md`](./code-abundance.md) — why this is the new scarcity, and why now
- [`not-a-memory.md`](./not-a-memory.md) — what Cairn is *not*, and why memory ≠ cognition
- [`../iii-life/capture-and-ratify.md`](../iii-life/capture-and-ratify.md) — the loop that turns the November rejection into a queryable constraint
