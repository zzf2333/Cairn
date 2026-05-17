# Enter

> A software project is not a pile of code. It is a path-dependent cognitive organism. Cairn is the layer that keeps that organism's memory alive after every session ends.

---

This is not a "memory plugin for AI." It is a different stance on what software engineering is becoming.

For decades, the bottleneck of software was **how cheaply you could produce code**. AI dissolves that bottleneck. What it does not dissolve — what it cannot dissolve — is the slow, expensive accumulation of **why** a project became what it is: what was tried, what failed, what scars remain, what tradeoffs were chosen and why. That is cognition. And as code becomes infinite, cognition becomes the only scarce thing left.

Cairn treats a project as a living organism with skeleton, blood, DNA, capillaries. The Host AI is a passing visitor. Cairn is what stays.

---

## How to read this

There are six volumes. Read in order on your first pass; jump on returns.

| | |
|---|---|
| **[i. Origin](./i-origin/)** | Why this exists — the shift from code scarcity to cognition scarcity, the failure mode it prevents, and what Cairn deliberately is *not*. |
| **[ii. Anatomy](./ii-anatomy/)** | The organs — skeleton, blood, DNA, capillaries, gravity, governance. Each subsystem gets one page. |
| **[iii. Life](./iii-life/)** | The lifecycle — capture, ratification, decay, resurrection, compression, trauma. How cognition is born, ages, dies, and sometimes returns. |
| **[iv. Self](./iv-self/)** | The reflexivity — TrustRouter, calibration, reevaluation. How the organism checks itself against reality. |
| **[v. Intervene](./v-intervene/)** | How you actually engage — install, the AI protocol, maintenance. The practical surface. |
| **[vi. Coordinates](./vi-coordinates/)** | Reference — schema, glossary, stability, performance, migration. Look up on demand. |

---

## Three claims, in order of strangeness

**1. Memory is not cognition.** A vector database of chat history gives you recall. It does not give you the structured, addressable, decaying, drift-aware substrate that lets an AI agent walk into a year-old codebase and *make the right decisions immediately*. The difference matters.

**2. Forgetting is part of the design.** A constraint nobody bumps into for 18 months is probably dead. Pretending otherwise makes the system look stricter than it is, which is worse than forgetting. Cairn explicitly models decay → resurrection → compression as a closed loop, not as a feature people remember to run.

**3. The AI is not the user.** The human who reads `.cairn/views/output.md` is one user. The AI that calls `cairn_context` before every response is the *primary* user. Cairn's surfaces are tuned for the second case first.

If any of those three are uncomfortable, you are in the right place — they are the load-bearing claims.

---

## Two supported hosts, deliberately

Today Cairn is first-class on **Claude Code** and **Codex**. Other MCP hosts will return in the 1.x line, after each can pass the same reverse-regression bar.

This is not a limitation. It is a refusal to grow the supported surface faster than the supported quality.

---

## Where now

- New here? → [`i-origin/cognitive-collapse.md`](./i-origin/cognitive-collapse.md). The failure mode you have already lived.
- Want to install? → [`v-intervene/enter.md`](./v-intervene/enter.md).
- Want the architecture map? → [`ii-anatomy/`](./ii-anatomy/) is the whole organism in six pages.
- Want one term defined? → [`vi-coordinates/glossary.md`](./vi-coordinates/glossary.md).
