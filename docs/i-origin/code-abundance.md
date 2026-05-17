# Code Abundance

> Every revolution in software has been about making code cheaper. AI is the first one that makes it *free*. The bottleneck moves.

---

## The shift

For thirty years, the discipline of software engineering organized itself around one question: **how do you produce code more cheaply, more reliably, more correctly**.

Git made history cheap. CI/CD made deployment cheap. Cloud made infrastructure cheap. IaC made provisioning declarative. Testing made correctness verifiable. Observability made failure visible. The IDE made writing fast.

Every tool we shipped had the same shape: *here is a way to make the production of code less painful*. The shared assumption — that code is the scarce, expensive thing — was so foundational that nobody named it.

Then AI arrived. Not as another productivity tool, but as something that **collapses the assumption itself**.

A capable model in 2026 can:

- Generate a module end-to-end from a paragraph
- Refactor across files without dropping references
- Migrate an architecture as a single tool call
- Provision infrastructure from intent
- Invent abstractions that weren't there a minute ago

The point is not that humans get faster. The point is that **code stops being scarce**. It becomes ambient. Generative. Disposable in a way it never was.

---

## What becomes scarce instead

When the supply of any one resource collapses, the bottleneck moves to whatever was downstream. Make iron cheap and the bottleneck moves to forging skill. Make forging cheap and it moves to design. Make design cheap and it moves to taste.

Make code cheap and the bottleneck moves to **the durable, structured record of why this codebase became this codebase** — what was tried, what failed, what tradeoffs were chosen, what trauma the team carries from past failures, what the project's emergent biases are.

That record is not in the code. The code is the *what*. The record is the *why*. And the *why* does not get cheaper just because the *what* did.

This is the new scarcity:

> **Long-term, stable engineering cognition.**

The set of things a project *knows about itself* — its path dependence, its accepted debts, its closed doors, its earned reflexes.

---

## Why nothing we built handles this

Look at the existing infrastructure:

| Tool | What it captures | Lifespan |
|------|------------------|----------|
| Git | Diffs between states | Forever, but inert — no semantics |
| Commit messages | Human prose | Read once if you're lucky |
| Code comments | Drift to false | Bit-rot |
| ADRs | Specific big decisions | Written once, rarely revisited |
| Postmortems | Specific incidents | Filed in Confluence, half-forgotten |
| Chat history | Everything and nothing | Searchable in theory, useless in practice |

None of these is *active*. None of them is *queried by the AI at decision time*. None of them *decays*, *resurrects*, *compresses*, or *calibrates against reality*. They are sediment. Cognition is a process, not sediment.

---

## What this means for tooling

The next decade of dev tooling will not be a sharper code editor. The frontier is downstream of code now. The bottleneck has moved.

Specifically, the next layer of infrastructure has to:

1. **Capture** cognition from real engineering activity, not from a "please write an ADR" workflow no one will follow
2. **Route** captured signal through trust gates — most of it is noise
3. **Stage** the uncertain stuff for human ratification, automatically
4. **Compress** repeated patterns into emergent personality
5. **Decay** unused cognition before it becomes false-positive overhead
6. **Resurrect** archived cognition the moment it becomes relevant again
7. **Calibrate** itself against the actual code so it can't quietly drift from truth

This is what Cairn is for. The seven verbs above are not features. They are the minimum surface for a system that takes the "cognition is scarce" claim seriously.

---

## See also

- [`cognitive-collapse.md`](./cognitive-collapse.md) — the failure mode you get without this layer
- [`not-a-memory.md`](./not-a-memory.md) — what Cairn is *not*, and why the distinction matters
- [`../ii-anatomy/`](../ii-anatomy/) — the operational form: skeleton, blood, DNA, capillaries
