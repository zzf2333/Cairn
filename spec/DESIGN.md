[中文](DESIGN.zh.md) | English

# Cairn — Design Document

> Status: Dynamic memory engine architecture.

---

## Naming

A cairn is a stack of rocks left by hikers at trail junctions and summits. Before GPS,
climbers marked their progress by piling stones at critical points: this route goes
through, that ridge is a dead end, turn here. Later travelers did not need to rediscover
every wrong turn. The judgment of everyone who came before was already stacked at the
side of the path.

That is the role Cairn plays for AI coding assistants.

Every time an AI enters a project, it arrives like a climber who has never been on this
mountain before — capable, well-equipped, but with no knowledge of which directions were
tried and abandoned, which areas have hidden dangers, and where the project currently is
in its journey. Cairn stacks the project's accumulated decisions at the trailside in a
structured form: this technical direction was tried and did not work; this module has a
known trap, route around it; the project is in a stability phase now, not the time for
large changes.

Each rejection record is one stone. Each known pitfall is one stone. Each phase
transition is one stone. The more complete the cairn, the less likely anyone who comes
after — whether a new human developer or an AI starting a fresh session — is to go off
course.

---

## The Problem

Software projects accumulate constraints. Every architectural decision is shaped by the
history of decisions that came before it: the technology stack already in place, the
trade-offs already accepted, the directions already evaluated and ruled out. This
dependency on prior choices is called **path dependency**.

AI coding tools cannot perceive path dependency. They have no memory between sessions.
Each conversation starts from zero — the AI has access to the current code, but not to
the reasoning behind it. The result is a recurring pattern:

- The AI proposes tRPC. The team tried tRPC eight months ago and reverted after two
  weeks. The AI does not know this.
- The AI suggests refactoring the auth module. The team deliberately accepted the
  current auth coupling as debt until the team grows. The AI does not know this.
- The AI recommends a microservices split. The team has no ops capacity and explicitly
  ruled this out. The AI does not know this.

Each of these is not an AI failure in the conventional sense. The model is reasoning
correctly given the information it has. The problem is structural: the information it
needs does not exist in a form the AI can use.

Documentation exists, but documentation is written for humans. Architecture Decision
Records (ADRs) describe what was decided. They do not tell an AI what to avoid
proposing, under what conditions a past rejection might be worth revisiting, or what
the active constraints are right now. Reading a 20-page ADR at the start of every
session is not a realistic workflow.

The result is that AI assistants behave like a developer who joined the team today and
has not yet been onboarded — technically competent, but repeatedly suggesting things
that were settled long ago. Every session is the first day.

---

## Existing Tools and Their Gaps

Several tools address parts of this problem. None solve it completely.

**Memory Bank (Cline community)** uses six Markdown files to record a project's current
state — stack, architecture, progress. This solves "what the project is" but provides a
static snapshot with no timeline, no concept of project age, and no rejection records.

**Cursor Rules / CLAUDE.md / Copilot Instructions** are distributed system prompts that
tell the AI "how to write code." They do not capture "why this way" — which decisions
carry which trade-offs, which alternatives were already eliminated.

**ADRs** have rejection records, but they are formal documents written for humans. The
format is heavy, solo developers rarely maintain them, and they were never designed as
AI-consumable context.

**The common problem across all these approaches: they require manual human maintenance.**
Once the maintenance cost rises even slightly, nobody writes them. Three months later
the files rot and the system effectively ceases to exist.

---

## Dual-Ear Design

### Why two signal sources

The signals that matter for project memory are distributed across two fundamentally
different channels. Neither channel alone provides a complete picture.

### Git ear: what happened, but not why

The Git ear observes code-level facts. It detects:

- **Reverts** — a direction was tried and rolled back
- **Dependency changes** — packages appeared then disappeared, or were replaced
- **Large-scale file movement** — major restructuring events
- **Commit frequency trends** — acceleration, deceleration, stability
- **New contributors** — team composition changes

These are objective project evolution facts. Git records all of them. But Git cannot
tell you *why* a revert happened, *why* a dependency was removed, or *why* the team
restructured. The reasoning behind the action is invisible to Git.

### Conversation ear: why, but not what

The conversation ear captures what users say during AI interactions:

- **User rejections** — "don't suggest that, we tried it"
- **Historical references** — "we did this before and it failed"
- **Constraint declarations** — "we're in a funding sprint, no big refactors"
- **Decisions** — "we're going with Zustand for state management"
- **Debt acceptance** — "we know auth is coupled, we're accepting it for now"

These are the highest-value constraint signals, but they exist only in conversations
between humans and AI. Git contains none of them.

### The combination

With only the Git ear, you know what happened but not why.
With only the conversation ear, you know what was said but not what actually changed
in the code.

Both ears together produce the complete picture needed to capture path dependency:
the Git ear provides the factual substrate, the conversation ear provides the
reasoning layer, and the combination produces memory entries that carry both evidence
and intent.

---

## Trust Router: Why Not Fully Automatic

### The core argument: Mnemonic Sovereignty

Fully automatic memory writing is dangerous. A single incorrect no-go entry acts like
a corrupted system prompt — it amplifies through every subsequent AI suggestion. The
danger is not just inserting one wrong entry, but that the error gets promoted to high
weight through summarization, reflection, or experience memory mechanisms.

This concern has formal grounding. Research on mnemonic sovereignty (arXiv 2604.16548)
warns explicitly: the risk lies not in the individual bad entry but in its propagation
through the memory system.

Cairn's position: **any memory that changes AI global behavior must not be written
fully automatically.**

### L0–L3: four trust levels

| Level | Name | Storage | Behavior |
|-------|------|---------|----------|
| L0 | Drop | None | Noise, duplicates, low confidence — discard |
| L1 | Candidate | `signals/` | Accumulate, wait for corroboration |
| L2 | Staged | `staged/` | Queued for human review |
| L3 | Auto-write | `memory/` | Written automatically under strict conditions |

### How signals flow through levels

```
Signal enters Trust Router
  │
  ├→ Duplicate? → Merge into existing entry → L0/merge
  │
  ├→ Triggers hard L2 rule? → staged/ (regardless of source reliability)
  │
  ├→ Matches L2 condition? → staged/
  │
  ├→ Matches L3 condition? → memory/ → trigger views regeneration
  │
  ├→ Confidence ≥ medium → L1 (signals/)
  │
  └→ Confidence < medium → L0 (drop)
```

When L1 candidates sharing the same domain and subject accumulate to 3 or more
(L1_ACCUMULATION_THRESHOLD), they automatically upgrade to L2.

### Hard rules: never automatic

These conditions always route to L2, regardless of source reliability or confidence:

- Adding a global no-go
- Stage transitions
- Any `behavior_effect` with `scope == global`
- Any item in the `never_auto` configuration list

### L3 conditions: when auto-write is permitted

Auto-write requires all of:

- Source is verifiable (e.g., `git-revert` or `git-dependency`)
- Scope is `local` (affects one domain, not global behavior)
- No conflict with existing memory entries
- Not on the `never_auto` list

Example: a Git revert is detected for a local dependency change. The source is
objective (Git evidence), the scope is local, and there are no conflicts. This can
be auto-written as an L3 entry.

Counterexample: a user says "we should never use GraphQL." This affects global
behavior. Regardless of confidence, it must go through L2 review.

---

## Stage Advisory Engine

### A unique capability

Among all surveyed tools and academic papers, **none perform automatic project stage
inference from project signals.** The same technical suggestion has completely different
answers depending on stage: during exploration, introducing a new dependency for rapid
validation is fine; during maturity, the same action requires strong justification. But
existing AI tools have no concept of which stage a project is in.

### Rule-based v0.1 implementation

The stage engine synthesizes multiple signals:

- **Project age** — months since first commit
- **Commit frequency trend** — accelerating, stable, decelerating
- **Dependency change rate** — how often dependencies are added or removed
- **New file ratio** — proportion of recently created files

### Four stages

| Stage | Characteristics | AI guidance |
|-------|----------------|-------------|
| **Exploration** | Young project, high dependency churn, rapid iteration | Favor speed, tolerate experiments |
| **Growth** | Increasing commits, stabilizing dependencies | Balance speed and stability |
| **Maturity** | Low new-file ratio, stable architecture | Require justification for new dependencies |
| **Maintenance** | Declining commit frequency, minimal changes | Prioritize stability, minimize risk |

### Advisory only

The stage engine's output is strictly advisory. When confidence is below threshold
(0.5 in v0.1), no hard constraints are produced. Stage determination only becomes a
formal constraint after human confirmation via `cairn_status(action: 'stage_confirm')`. Until then,
guidance uses suggestive language ("consider," "balance") rather than prohibitive
language ("do not," "never").

Stage transitions always route through L2 — they require human review before updating
`state.yaml`.

---

## Memory / Views Separation

### The problem with conflating source and projection

### Data Model

Cairn strictly separates the two concerns:

**`memory/` is source data (Source of Truth).** Each memory is a YAML file containing
full provenance tracking, confidence scores, and `behavior_effect` declarations. This
is what humans review.

**`views/` is automatically generated projection.** `output.md`, `domains/*.md`, and
`stage.md` are all aggregated from `memory/` files. The AI consumes views; humans
review source data. Views can be regenerated from memory at any time without loss.

### Why this separation matters

**Preventing memory corruption.** If a view file becomes stale or is accidentally
modified, regenerating it from `memory/` restores correctness. The source of truth is
never the rendered view.

**Git diff clarity.** YAML memory files produce structured, field-level diffs that are
far easier to review than Markdown prose changes. A reviewer can see exactly which
field changed (`confidence`, `behavior_effect`, `revisit.status`) rather than parsing
free-text differences.

**Degraded mode.** The `views/` format is compatible with Skill adapter files. When the
MCP server is not running, adapters can read `views/` directly as a fallback.

### Generation rules

Views are regenerated whenever `memory/` changes:

- `views/output.md` — Extracts global no-gos, active stack decisions, accepted debt,
  domain hooks, and stage advisory. Target 500 tokens, hard limit 800.
- `views/domains/*.md` — Groups memory entries by domain. Generates trajectory,
  rejected paths, known pitfalls, and open questions. Target 300 tokens per file,
  hard limit 500.
- `views/stage.md` — Renders current stage advisory with evidence and guidance.

All view files carry a generated header:

```markdown
<!--
Generated by Cairn. Do not edit manually.
Source: .cairn/memory/*.yaml
Last generated: 2026-05-11T10:30:00+09:00
-->
```

---

## Design Principles

### 1. Every module exists, but depth is controlled

Cairn ships all core modules from day one — Git ear, conversation ear, Trust Router,
Stage Advisory Engine, Memory Engine, Views Engine. But each module's intelligence
depth in v0.1 uses rules, not LLMs. Git ear does pattern matching. Stage inference
uses rule-based heuristics. Trust Router uses if-else logic.

The architecture is complete on day one. Intelligence deepens over subsequent versions.

> Do not delete modules, reduce depth.

### 2. Architecture is full, permissions are strict

The system skeleton is complete, but L3 auto-write conditions are deliberately strict.
The default posture is conservative: when in doubt, route to L2 for human review. As
the system proves reliable through real-world use, L3 conditions can be gradually
relaxed.

> Do not reduce architecture, control permissions.

### 3. Human review authority is non-bypassable

Any memory that changes AI global behavior — global no-gos, stage transitions, global
`behavior_effect` entries — must pass through L2 human review. No configuration change,
no accumulated confidence score, and no automated process can bypass this gate.

### 4. Facts and speculation are separated

`cairn_plan` is a read-only advisory tool. It never writes to `signals/`, `staged/`,
or `memory/`. AI planning speculation is not project factual memory. If plan output
could produce memory, the system would conflate "what the AI guessed" with "what
actually happened."

### 5. Progressive trust, no skipping levels

A signal starts at L1 (candidate), accumulates corroborating evidence, may upgrade to
L2 (staged for review), and enters `memory/` only after review or L3 qualification.
There is no mechanism to jump from raw signal to permanent memory in a single step
without meeting strict conditions.

---

## The `rejected` Field Remains the Most Important Field

Every memory entry carries a `rejected` field that records what alternatives were
considered and not chosen. This is the most critical field.

AI models are trained to be helpful. When asked for a solution, they produce what looks
like a good answer given available information. They cannot access the reasoning that
already eliminated certain solutions. As a result, AI assistants reliably re-propose
directions that were previously considered and ruled out.

The `rejected` field directly addresses this. Recording "we considered tRPC and here is
why we did not adopt it" makes that reasoning available to the AI. The `revisit.when`
conditions that accompany each rejection give the AI a model for when a rejection
should be reconsidered — making constraints time-bounded rather than permanent.

The `rejected` field has additional structure: it lives in YAML source data
with explicit `behavior_effect` declarations, making its constraint role machine-
verifiable rather than dependent on AI interpretation of prose.

---

## Adoption Model: From Reactive to Continuous

### Continuous Capture

Cairn automates the capture step. Instead of requiring the
user to notice a trigger event and manually record it, the dual-ear system detects
signals continuously:

- The Git ear scans for reverts, dependency changes, and structural shifts every time
  the server starts.
- The conversation ear captures rejection signals, constraint declarations, and
  decisions as they occur in natural AI interaction.

The user's role shifts from "write the memory" to "review the memory." The five trigger
events still describe when meaningful memory should exist — but the mechanism for
getting from event to memory is now automated rather than manual.

### Auto-initialization (bootstrap)

On first MCP tool call, if no `.cairn/` directory exists, the server automatically:

1. **Detects project metadata** — project name from directory, start date from first commit
2. **Rule-based Git scan** — analyzes git history for candidate signals (reverts,
   dependency removals, replacements, major restructurings)
3. **Creates `.cairn/` structure** — config, state, and all subdirectories

The guiding principle remains: incomplete is better than inaccurate. An entry with
`[TODO]` in its `reason` field is more honest than a fabricated justification.

---

## Tool Compatibility

Cairn operates as an MCP server using stdio transport. Any AI tool that supports
the Model Context Protocol can use Cairn natively through typed tool calls:
`cairn_context()`, `cairn_signal()`, `cairn_session_end()`, `cairn_status()`,
`cairn_review()`, `cairn_memory()`, `cairn_plan()`, and `cairn_doctor()`.

For AI tools that do not support MCP, the `views/` directory provides a degradation
path. Because `views/` provides Markdown projections, Skill adapter files work as a
fallback when the MCP server is unavailable. The AI reads views as static files — it
loses real-time signal capture and Trust Router integration but retains access to the
accumulated constraint context.

Supported tool configurations:

| Tool | MCP Support | Fallback |
|------|-------------|----------|
| Claude Code | Native MCP | views/ via CLAUDE.md |
| Cursor | Native MCP | views/ via cairn.mdc |
| Cline / Roo Code | Native MCP | views/ via .clinerules |
| Windsurf | Native MCP | views/ via .windsurfrules |
| GitHub Copilot | — | views/ via copilot-instructions.md |
| Codex CLI | — | views/ via AGENTS.md |
| Gemini CLI | — | views/ via GEMINI.md |

The runtime model: the MCP server starts when the AI tool opens a project and exits
when the project closes. Each project runs its own server instance — no global daemon,
no database, no cloud dependency. Like a language server (LSP), it is project-scoped
and session-lived.

---

## Roadmap

### Current Phase — Dynamic Memory Engine

Transforms Cairn from a static file format into an active memory system. Core
deliverables:

- Dual-ear signal capture (Git + conversation)
- Trust Router with L0–L3 graduated admission
- YAML-based memory store with full provenance tracking
- Automated views generation from memory source data
- Rule-based Stage Advisory Engine
- Eight MCP tools forming the complete read-capture-review-constrain loop
- Auto-initialization (bootstrap) on first MCP tool call with Git history analysis
- `cairn_review` MCP tool for AI-mediated memory admission

v0.1 ships all modules with rule-based intelligence. Subsequent versions deepen each
module's capability without changing the architecture.

### Future versions

- **v0.2** — Signal quality: enhanced Git ear patterns, deduplication, candidate
  accumulation
- **v0.3** — Stage engine: multi-dimensional signals, confidence improvements
- **v0.4** — Plan engine: history × stage × domain cross-reasoning
- **v0.5** — Memory maintenance: stale detection, conflict graphs, archive policies
- **1.0** — Autonomous project memory: long-running validation, quantifiable AI
  improvement, stable API
