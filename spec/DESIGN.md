[中文](DESIGN.zh.md) | English

# Cairn — Design Document

> Status: Three-layer architecture finalized.

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

## Design Principles

### Constraint system, not documentation system

Every piece of information in Cairn must be capable of changing an AI's suggestion.
If removing a line would not affect what the AI recommends, that line should not exist.

This is a stricter bar than documentation. Documentation can record context, background,
and rationale for human readers. Cairn records only what actively constrains AI
behavior: what directions are off-limits, what the current trade-off priorities are,
what domains need additional context before the AI can give a useful answer.

Information that cannot change AI behavior — historical context for its own sake,
rationale that does not affect future decisions — belongs in a project wiki or ADR,
not in Cairn.

### Not ADR

ADRs and Cairn are complementary, not competing. They serve different audiences with
different goals.

An ADR is written for a human developer who will read it carefully, understand nuance,
and apply judgment. It can be long, narrative, and exploratory. It records the reasoning
process and preserves organizational memory for people.

A Cairn entry is structured for AI consumption. It uses short, machine-parseable fields.
It focuses on what the AI should do differently as a result of knowing this information.
It must fit within token budgets that make it practical to inject into AI context at
every session.

The same decision can and should appear in both places. The ADR captures the full
reasoning for the team. The Cairn entry captures the behavioral constraint for the AI.
They will look different because they serve different purposes.

### Tool-agnostic data layer

The `.cairn/` directory contains only Markdown files with structured text. It has no
dependency on any specific AI tool, editor plugin, or platform. The data follows the
project in version control like any other file.

The behavior layer — the Skill files that tell each tool how to read Cairn — is
tool-specific, but only the behavior specification differs. The underlying data is
always the same three-layer structure. A project can switch from Claude Code to Cursor
without migrating any data. A team using multiple tools simultaneously reads from the
same `.cairn/` directory.

---

## Why Three Layers?

The first instinct when building a constraint system is to use a single file. One file
is simple: the AI reads it, the human edits it, done. The problem with a single file
is that different types of information have fundamentally different usage patterns.

Global constraints need to be present at the start of every session, which means they
must be small enough to inject without consuming significant context budget. A 5,000-
token file injected every session is not practical. But if you aggressively truncate to
fit token limits, you lose the detail that makes constraints useful when planning
complex work.

The three-layer architecture resolves this by matching injection timing to information
granularity.

### Layer 1: `output.md` — Always-on global constraints

`output.md` is injected at the start of every AI session, automatically, without any
explicit request. It answers: what are the non-negotiable constraints that apply to
everything in this project right now?

This layer must be small by design (target 500 tokens, hard limit 800). That constraint
is intentional: anything too large to fit here belongs in a deeper layer. The discipline
of keeping `output.md` small forces prioritization. If it keeps growing, that is a signal
that some constraints are domain-specific and should live in `domains/` instead.

The information here is binary: either it applies globally to every session, or it does
not belong in Layer 1.

### Layer 2: `domains/*.md` — Planning-time domain context

Domain files are the critical middle layer. They are injected on demand when the AI is
working on planning, architecture, or technology selection in a specific area of the
codebase — not at session start, and not only when explicitly queried.

The problem they solve: `output.md` can say `- tRPC (REST integration cost)` in a
single line. That is enough to prevent the AI from proposing tRPC. But if the AI is
helping design a new API endpoint, one line is not enough context. The AI needs to know
the full trajectory of API layer decisions, what was tried, why specific alternatives
were rejected, what the current known pitfalls are, and what design questions remain
open.

Reading the full `history/` record at planning time is also not the answer. Raw history
entries are detailed and uncompressed — useful for precise lookups, not for establishing
working context quickly.

Domain files are pre-compressed design context. They synthesize the relevant history
into a form the AI can use immediately: current state, trajectory, rejected paths with
re-evaluation conditions, known pitfalls, and open questions. They are written once from
accumulated history entries, and overwritten (not appended) as the project evolves.
Each file stays in the 200–400 token range. They do not grow over time.

### Layer 3: `history/*.md` — Full raw record for precise queries

History files store the complete, original record of every significant decision event.
They have no token limit. They are not injected automatically or during planning — they
are queried by the AI when it needs to look up a specific past decision in full detail.

The distinction between Layer 2 and Layer 3 is compression. Domain files are derived
summaries; history files are the source material. Domain files can become outdated as
the project evolves; history files are append-only and immutable. When the AI needs to
cite the exact reason tRPC was rejected in September 2023, or understand the full
context of a debt acceptance decision, it reads the history entry directly.

### What three layers enable

The combination produces a qualitative difference in AI context quality. Consider the
AI working on an API layer design task:

- From `output.md`: one line saying tRPC is off-limits, one hook pointing to the domain
  file.
- From `domains/api-layer.md`: the full trajectory from bare Express routes through Zod
  validation to the tRPC trial and revert, the current REST + OpenAPI state, rejected
  paths with re-evaluation conditions, the known pitfalls around rate limiting and error
  format inconsistency, and the open question about versioning strategy.
- From `history/` if needed: the complete record of the tRPC experiment — what was
  tested, what the integration costs were, exactly why the decision was made to revert.

The AI doing API layer design with this context has information comparable to a
developer who has been working on this project for 18 months. Without Cairn, the same
AI has access to the current code and no history at all.

---

## The `rejected` Field Is the Most Important Field

Every history entry in Cairn's Layer 3 has a `rejected` field that records what
alternatives were considered and not chosen. It is marked as the most critical field
in the format specification, and it is required even for `decision` and `transition`
entry types — not just for `rejection` entries.

The reason is specific to how AI assistants work.

AI models are trained to be helpful. When asked for a solution, they will produce
what looks like a good solution given the information available. They do not have
access to the reasoning that already eliminated certain solutions. As a result, AI
assistants reliably re-propose directions that were previously considered and ruled out,
because from their perspective, those directions look like reasonable answers.

The `rejected` field directly addresses this. Recording "we considered tRPC and here
is why we did not adopt it" makes that reasoning available to the AI. The AI can now
treat that direction as one that has already been evaluated rather than a fresh option.

This matters even for decisions where the primary record is the thing chosen, not the
things rejected. When a team decides to use Zustand for state management, the fact that
they also considered Redux and Jotai and ruled them out for specific reasons is
information the AI needs — otherwise it will keep suggesting those alternatives as
improvements. The `rejected` field makes the "not chosen" paths as explicit as the
chosen path.

It also serves a second function: the `Re-evaluate when:` condition that accompanies
each rejected path in domain files gives the AI a model for when a rejection should be
revisited. "We rejected tRPC because of migration cost for existing clients" implies a
different re-evaluation condition than "we rejected tRPC because it does not fit our
team's mental model." Recording the condition makes the constraint time-bounded rather
than permanent.

---

## Adoption Model: Init + Reactive

Cairn's adoption model is designed around a single insight: the cost of maintaining a
constraint system must be lower than the cost of not having one. A system that requires
active upkeep as a separate workflow will be abandoned. Cairn is built to be maintained
reactively — updated in response to things that are already happening, not as a
proactive documentation effort.

### Init: one-time historical inventory

`cairn init` is run once when a project adopts Cairn. Its goal is to establish an
initial state in 30 minutes — complete enough to be useful, but not expected to be
exhaustive.

The init process selects the relevant domains for the project, fills in `output.md`
with the current phase and known constraints, generates the Skill adapter files for
the tools the team uses, and creates the empty directory structure for `domains/` and
`history/`. Domain files are intentionally left empty at init time. They are generated
from history entries after enough entries accumulate, not written from scratch.

The guiding principle for init is: it is better to be incomplete than to record
something inaccurate. An empty `rejected paths` section is more useful than a
fabricated rejection reason.

### Reactive: five trigger events

After init, Cairn is updated only when specific events occur. The model is explicit:
do not maintain Cairn proactively. Wait for something to happen that is worth recording,
then record it.

The five trigger events are:

**A. The AI proposes a direction you have already rejected.** This is the most common
trigger, and it is also the most valuable. When the AI suggests something the team
already ruled out, that is evidence that the ruling-out is not captured in Cairn. Record
a `rejection` history entry, add the direction to `output.md`'s `no-go` section if it
is likely to come up again, and update the relevant domain file.

**B. A significant technical decision is made.** After the team makes an important
architectural or technology choice, record it as a `decision` or `transition` history
entry. Update `output.md`'s `stack` section if the active technology changed, and
update the relevant domain file.

**C. An experiment was tried and abandoned.** Failed experiments are often more valuable
to record than successful ones. The paths that did not work are exactly what the AI is
most likely to suggest. Record the `experiment` entry with emphasis on why the approach
was abandoned. Update the domain file's `rejected paths` section.

**D. A known deficiency is deliberately accepted.** When the team explicitly decides
not to fix a known problem — usually for prioritization reasons — record a `debt-accepted`
history entry and add the debt to `output.md`. This prevents the AI from treating the
fix as an obvious improvement and incorporating it into unrelated suggestions.

**E. The project enters a new phase.** Phase transitions affect the reasoning mode for
all AI suggestions. A team in stability mode should not receive suggestions optimized
for speed. Record a `transition` history entry and update `output.md`'s `stage` section.

### Why this model works

The reactive model creates a positive feedback loop. When the AI violates a constraint
that is not yet in Cairn (trigger A), recording it makes the AI less likely to violate
that constraint in the future. Over time, the set of captured constraints grows to cover
the directions the AI actually tends to suggest incorrectly for this specific project.

The system calibrates itself to the project's actual pain points rather than requiring
the team to anticipate what should be documented in advance. The AI's mistakes become
the specification for what Cairn should contain.

---

## Tool Compatibility

The `.cairn/` directory is the data layer. It is pure Markdown, version-controlled with
the project, and has no dependency on any specific tool. Any AI assistant that can read
files can read Cairn.

The behavior layer has two components:

1. **`.cairn/SKILL.md`** — the full operating protocol, copied from `skills/claude-code/SKILL.md`
   at `cairn init` time. Tells the AI when to read each layer, how to interpret constraints,
   when and how to write back to history/domains/output.md, and the complete FORMAT REFERENCE.
   AI assistants read this once per session. Users never edit it.

2. **Adapter guide blocks** — 12-line blocks written into each AI tool's config file
   (`.claude/CLAUDE.md`, `.cursor/rules/cairn.mdc`, etc.) pointing to `.cairn/SKILL.md`.
   Generated by `cairn init`. Regenerated at any time by `cairn init --refresh-skills`.

Adapter guide block locations:

| Tool | Location |
|------|----------|
| Claude Code | `.claude/CLAUDE.md` (managed block) |
| Cursor | `.cursor/rules/cairn.mdc` |
| Windsurf | `.windsurfrules` (managed block) |
| Cline / Roo Code | `.clinerules` (managed block) |
| GitHub Copilot | `.github/copilot-instructions.md` (managed block) |
| Codex CLI | `AGENTS.md` (managed block) |
| Gemini CLI | `GEMINI.md` (managed block) |
| OpenCode | `AGENTS.md` (managed block) |

The behavioral contract across all adapters is the same: read `output.md` at session
start; read domain files when hooks match; query history on demand; write back to
`.cairn/` directly using native file tools after task completion. The guide block
format differs per tool; the semantics do not.

---

## Roadmap

Cairn is developed in three phases.

**Phase 1 — Protocol.** Complete. Deliverables are the format specification
(`spec/FORMAT.md`), this design document, Skill adapter files for the five supported
tools, a real project example with 18+ months of history across all three layers, and
an interactive `cairn-init.sh` shell script. Success criteria: a team of three or more
can independently run `cairn init` and get a working setup without additional explanation;
recorded `no-go` entries reliably prevent the AI from re-suggesting those directions;
domain file context visibly improves AI suggestion quality during planning.

**Phase 2 — CLI.** Complete. A `cairn` command-line tool with four subcommands:
`cairn init` (bootstrap — creates `.cairn/` skeleton, copies `SKILL.md`, installs
guide blocks into AI tool configs; supports `--refresh-skills`, `--global`, `--upgrade`
flags), `cairn doctor` (read-only health checks with optional `--json` output),
`cairn version`, and `cairn help`. The CLI is bootstrap-only; all ongoing memory
maintenance is done by the AI directly using its native file tools (Read/Write/Edit).

**Phase 3 — MCP Server.** Complete. A Model Context Protocol server (`mcp/`) that
exposes structured access to all three layers via typed tool calls: `cairn_output()` to
read `output.md`, `cairn_domain(name)` to read a specific domain file,
`cairn_query(domain, type?)` to search history entries, `cairn_write_history(entry)` to
write a new history entry directly to `.cairn/history/`, `cairn_doctor()` to run health
checks and return structured JSON results, and `cairn_match(keywords)` for precise
hooks-based domain matching without AI inference. The MCP layer serves AI clients that
cannot use file tools directly. See `mcp/README.md` for configuration.
