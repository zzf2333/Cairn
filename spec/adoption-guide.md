[中文](adoption-guide.zh.md) | English

# Cairn Adoption Guide

This guide covers two phases of adopting Cairn:

- **Phase 1 — Init:** A one-time historical inventory. Target: 30 minutes to a working
  initial state.
- **Phase 2 — Reactive:** Long-term operation. Core principle: don't maintain proactively;
  let AI mistakes tell you what to record.

---

## Phase 1: Init — One-Time Historical Inventory

### Goal

Establish a working `.cairn/` directory in 30 minutes or less. The goal is a constraint
system that is good enough to change AI behavior today — not a complete archive of
every decision the project has ever made.

**Principle: incomplete is fine, wrong is not.**

An empty `## no-go` section is correct if you haven't identified any forbidden directions
yet. A `## no-go` section filled with guesses is worse than useless — the AI will treat
those entries as real constraints. Only record what you know to be true.

---

### Step 1: Choose Your Domains

The 11 standard domains available at init time:

| Key | Area |
|-----|------|
| `state-management` | Frontend state management |
| `api-layer` | API design and communication |
| `database` | Data storage |
| `auth` | Authentication and authorization |
| `frontend-framework` | Frontend framework |
| `testing` | Testing strategy |
| `deployment` | Deployment and infrastructure |
| `monitoring` | Monitoring and alerting |
| `architecture` | Overall architecture patterns |
| `performance` | Performance optimization |
| `security` | Security strategy |

**Select 3–7 domains that apply to your project.** You can also add custom domains in
`kebab-case` (e.g., `payments`, `data-pipeline`, `ml-inference`).

Once selected, the domain list is locked. The AI MUST NOT invent new domain keys when
writing history entries — it must use the keys you chose at init.

**Choosing guidance:**

For an early-stage project (solo developer, pre-product-market-fit), start with:
`api-layer`, `database`, `auth`, `deployment`

For a full-stack product team (2–5 engineers, established codebase), consider:
`api-layer`, `database`, `auth`, `state-management`, `frontend-framework`, `deployment`,
`testing`

When in doubt, pick fewer. You can always expand the list before the next `cairn init`
run. Unused domains add noise to the `## hooks` section.

---

### Step 2: Fill `output.md`

Create `.cairn/output.md` with the five required sections in order. Fill each section
based on what you know today.

**`## stage`** — describe the current project phase and how the AI should prioritize:

```
## stage

phase: early-growth (2024-09+)
mode: stability > speed > elegance
team: 2, no-ops
reject-if: migration > 1 week
```

The `mode:` field directly shapes AI trade-off decisions. Be honest about where the
project is. "speed > stability" during an MVP sprint is a valid constraint.

**`## no-go`** — list technology directions the AI MUST NOT suggest:

```
## no-go

- tRPC (REST integration cost, see domains/api-layer.md)
- Redux (boilerplate overhead at team-2)
```

If you haven't identified any firm exclusions yet, leave this section empty. Do not
fill it with things you're merely skeptical about — add entries only when you have
a concrete reason a direction is off the table.

**`## hooks`** — keyword mappings that trigger domain file injection. This section
can be auto-generated based on your selected domains:

```
## hooks

planning / designing / suggesting for:

- api / endpoint / REST / GraphQL → read domains/api-layer.md first
- auth / login / JWT / session → read domains/auth.md first
- db / migration / ORM / schema → read domains/database.md first
- deploy / infra / CI → read domains/deployment.md first
```

Include one line per domain. Add any project-specific keywords the AI would use when
discussing that area.

**`## stack`** — your active technology choices:

```
## stack

api: REST
db: PostgreSQL
auth: JWT + Refresh Token
deploy: Railway
```

One `key: value` pair per layer. Only list what's real and in use today.

**`## debt`** — formally accepted technical debts the AI MUST NOT attempt to fix:

```
## debt

AUTH-COUPLING: accepted | fix when team>4 or MAU>100k | no refactor now
```

Format: `<ID>: accepted | <revisit_when condition> | <constraint>`.

If you have no formally accepted debts yet, leave this section empty. The distinction
matters: this section is not for "things that could be better" — it's for deficiencies
you have consciously decided to carry for now.

---

### Step 3: Initialize `history/`

Create the `.cairn/history/` directory.

```
mkdir -p .cairn/history/
```

**Optionally, back-fill 1–3 entries for the most important historical decisions.**
Focus on decisions that would cause the most damage if an AI re-proposed the discarded
alternative — typically: a technology the team trialed and abandoned, a direction that
was firmly ruled out, or a significant architectural choice with non-obvious constraints.

You do not need to reconstruct the full history. Leave gaps where you're uncertain.
An absent entry causes no harm. A wrong entry (incorrect rejection reason, wrong date,
fabricated context) corrupts the AI's constraint model.

For back-filled entries, the dual timestamp matters: set `decision_date` to when the
decision actually happened, and `recorded_date` to today. The AI uses `decision_date`
to assess time-sensitivity.

---

### Step 4: Initialize `domains/`

Create the `.cairn/domains/` directory.

```
mkdir -p .cairn/domains/
```

**Leave it empty. This is correct.**

Domain files are compressed summaries of accumulated history. Without history, there
is nothing to compress. Writing domain files by hand at init time — before any history
exists — produces guesswork that looks authoritative. Wait until each domain has 2–3
history entries, then generate the domain file from those entries (see Phase 2).

---

### Step 5: Install Skill Adapter

Copy the Cairn skill file for the AI tool(s) your team uses:

| Tool | File to install | Location |
|------|-----------------|----------|
| Claude Code | `skills/claude-code/SKILL.md` | `.claude/CLAUDE.md` (append) |
| Cursor | `skills/cursor.mdc` | `.cursor/rules/cairn.mdc` |
| Windsurf | `skills/windsurf.md` | Append to `.windsurfrules` |
| Cline / Roo Code | `skills/cline.md` | Append to `.clinerules` |
| GitHub Copilot | `skills/copilot-instructions.md` | Append to `.github/copilot-instructions.md` |
| Codex CLI | `skills/codex.md` | Append to `AGENTS.md` |
| Gemini CLI | `skills/gemini-cli.md` | Append to `GEMINI.md` |
| OpenCode | `skills/opencode.md` | Append to `AGENTS.md` |

The skill file teaches the AI the three-layer protocol: always read `output.md`, read
`domains/*.md` when planning, query `history/` for precise lookups. Without the skill
file, the AI does not know the `.cairn/` directory exists.

---

## Phase 2: Reactive — Long-Term Operation

### Core Principle

Do not maintain Cairn proactively. Do not schedule reviews, do not periodically
audit domain files, do not try to keep history exhaustive. Let AI mistakes tell
you what to record.

The system grows in response to real friction. Each time an AI proposes a direction
you've already ruled out, that's a signal: record the rejection. Each time you make
a decision the AI should know about, record it. Over time, the history builds up
naturally around the decisions that actually matter for AI alignment.

---

### Five Trigger Events

#### Event A: AI suggests a direction you already rejected

The AI just proposed something — a technology, an architecture pattern, an approach —
that you've already evaluated and decided against.

1. Record the rejection in `history/` as type `rejection`:
   ```
   type: rejection
   domain: <domain>
   decision_date: <when you originally made the call>
   recorded_date: <today>
   summary: <one sentence>
   rejected: <the direction> — <why it was ruled out>
   reason: <what made you certain>
   revisit_when: <what would need to change>
   ```
2. Consider adding the direction to `output.md`'s `## no-go` section, especially if
   the AI is likely to propose it again. Add it if the direction is a common AI
   recommendation in your technology space.
3. Update the corresponding `domains/*.md`'s `## rejected paths` section if the domain
   file already exists.

This event is the most common trigger. The AI re-proposes rejected directions frequently
because, without a record, it has no way to know a direction was tried. Each rejection
entry directly prevents the same mistake next session.

---

#### Event B: You make an important technical decision

Your team chose a new technology, changed an architectural approach, or made a
significant trade-off that will shape future work.

1. Ask the AI to draft the history entry based on your description:
   > "We just decided to use Zod for request validation instead of Joi. Draft a Cairn
   > history entry for this."
   Review the draft, correct anything wrong, and write it to `history/` as type
   `decision` or `transition`.
2. If the decision changes what's in your active stack, update `output.md`'s `## stack`
   section.
3. Update the corresponding `domains/*.md` trajectory and rejected paths if the domain
   file exists.

The `rejected` field in this entry is critical: record what was considered and not
chosen. Even if the decision felt obvious, document the alternatives. The AI will
otherwise not know why the alternative was passed over.

---

#### Event C: You tried a direction and abandoned it

You ran a spike, built a prototype, or started down a path — and stopped. The direction
didn't work out.

1. Record the conclusion in `history/` as type `experiment`:
   ```
   type: experiment
   domain: <domain>
   decision_date: <when you started/stopped>
   recorded_date: <today>
   summary: <what was tried and what happened>
   rejected: <the direction> — <why it was abandoned>
   reason: <the specific failure mode or incompatibility discovered>
   revisit_when: <what would need to be different>
   ```
2. Update the domain file's `## rejected paths` section if the domain file exists.

**Focus on WHY you abandoned it.** This is the most valuable part of the record. The
AI can infer that something was tried from the `experiment` type. What it cannot infer
is the specific failure mode — the reason this direction was wrong for this project.
A tRPC experiment that failed because of multi-client migration complexity is a
different signal than one that failed because of TypeScript version incompatibility.
Both suggest avoiding tRPC, but for different reasons, and the `revisit_when` condition
differs.

Abandoned experiments are often the most valuable history entries. The paths that
don't work are exactly what the AI needs to avoid re-walking.

---

#### Event D: You accept a known deficiency

You identified a problem in the codebase — a design flaw, a scaling limit, an
architectural coupling — and decided to leave it in place for now.

1. Record the acceptance in `history/` as type `debt-accepted`:
   ```
   type: debt
   domain: <domain>
   decision_date: <today>
   recorded_date: <today>
   summary: Accepted <ID> as known debt; will revisit when <condition>
   rejected: Immediate fix — cost/risk not justified at current scale
   reason: <why this is tolerable now>
   revisit_when: <the specific condition that changes the calculus>
   ```
2. Add the entry to `output.md`'s `## debt` section:
   ```
   <ID>: accepted | <revisit_when condition> | no refactor now
   ```
3. Add a corresponding `## known pitfalls` entry in the domain file, describing what
   engineers (human or AI) should avoid triggering while the debt exists.

The `revisit_when` condition is required for accepted debt. Without it, the debt
becomes permanent by default. Make the condition specific and measurable: "team > 4"
or "MAU > 100k" or "CDN migration complete" — not "when we have time."

---

#### Event E: Project enters a new phase

The project's priorities shifted. You moved from MVP to growth, from growth to
stability, or from stability to a new product surface. The `mode:` and `reject-if:`
conditions in `output.md` no longer reflect reality.

1. Update `output.md`'s `## stage` section with the new phase and reasoning mode.
2. Write a `transition` type history entry marking the end of the previous phase:
   ```
   type: transition
   domain: architecture
   decision_date: <today>
   recorded_date: <today>
   summary: Project transitioned from <old phase> to <new phase>
   rejected: Continuing prior mode — <why the old priorities no longer apply>
   reason: <what changed: team size, user scale, product maturity>
   revisit_when: n/a — transition is a point-in-time event
   ```

Phase transitions are high-leverage history entries. The AI's `mode:` constraint
shapes every trade-off decision it makes. An AI operating with `mode: speed > stability`
will give different suggestions than one operating with `mode: stability > speed > elegance`.
Keeping the stage section current is one of the highest-value maintenance tasks
in Cairn.

---

### The Positive Feedback Loop

Reactive operation creates a compounding return. As history accumulates:

- Domain files become more accurate representations of each area's real constraints
- The AI's suggestions align more closely with project reality
- The AI makes fewer proposals that need to be rejected or corrected
- Fewer mistakes means fewer new history entries needed
- Maintenance cost drops as the system matures

The system does not require ongoing effort to improve. It improves automatically as
a byproduct of using it. Each correction generates a record; each record reduces future
corrections. Projects with 18 months of Cairn history typically generate fewer than
one new history entry per week — not because the team stopped recording, but because
the AI stopped making mistakes that needed correction.

---

## When to Generate Domain Files

Domain files are the middle layer of Cairn — pre-compressed context that gives the AI
the right amount of detail for planning work without requiring it to read raw history.
They should be generated thoughtfully, not pre-emptively.

**Do not write domain files at init time.** An empty `domains/` directory is correct
initial state. A hand-written domain file based on memory rather than documented
history is a liability: it looks authoritative but reflects the author's recollection
rather than the actual record.

**Wait until a domain has 2–3 history entries.** At that point, the domain has enough
recorded context to compress. Ask the AI to generate a domain file from the raw
history entries:

> "Read these three history entries for the `api-layer` domain and generate a
> `domains/api-layer.md` file following the Cairn domain format."

Review the generated file. Correct any misinterpretations. Confirm and write it to
`domains/api-layer.md`.

**After that, use overwrite-mode updates.** Domain files are not append logs — they
represent the current state of a domain. When a new history entry changes a domain's
constraints, regenerate the domain file from all relevant history entries. The old
file is replaced, not edited. Raw events are preserved in `history/`; the domain file
is a re-derivable summary.

This pattern keeps domain files accurate without manual line-by-line editing. The AI
does the compression; the human does the confirmation.

---

## Using the CLI

The Cairn CLI has four commands. All ongoing memory maintenance is done by the AI
directly — no CLI ceremony required after `cairn init`.

### `cairn init`

Bootstrap command. Creates the `.cairn/` directory skeleton, copies
`skills/claude-code/SKILL.md` to `.cairn/SKILL.md`, and installs 12-line guide
blocks into AI tool config files (`.claude/CLAUDE.md`, `.cursor/rules/cairn.mdc`,
etc.) that point the AI to `.cairn/SKILL.md`.

```bash
# Full bootstrap (interactive)
cairn init

# Refresh guide blocks and .cairn/SKILL.md without touching output.md or history/
cairn init --refresh-skills

# Also install guide blocks in global AI config files (~/CLAUDE.md etc.)
cairn init --global

# Check for v0.0.11 residue (staged/, audits/, reflections/) and refresh SKILL.md
cairn init --upgrade
```

### `cairn doctor`

Read-only health check. Verifies `output.md` structure, domain frontmatter,
stale domain detection, guide block format, `.cairn/SKILL.md` consistency,
and v0.0.11 residue.

```bash
cairn doctor

# Machine-readable output (for AI self-check)
cairn doctor --json
```

Use `cairn doctor` after `cairn init`, when onboarding a new team member, or
when something seems off. The AI can call `cairn doctor --json` at session start
to self-verify before beginning work.

---

## After-Task Write-Back

After completing a meaningful task, the AI decides whether a recordable event occurred
and, if so, writes directly to `.cairn/` using its native file tools. No CLI ceremony,
no staging gate, no human relay step.

**The AI is responsible for this judgment.** The protocol is described in `.cairn/SKILL.md`.

### What the AI does

At task completion the AI evaluates the event type and writes the appropriate file(s):

| Event | AI action |
|-------|-----------|
| Significant technical decision | Write `.cairn/history/YYYY-MM_<slug>.md` (type: decision) |
| Approach tried and abandoned | Write `.cairn/history/YYYY-MM_<slug>.md` (type: experiment) |
| Direction explicitly rejected | Write history entry + add `## no-go` entry to `output.md` |
| Deficiency accepted as debt | Write history entry + `## debt` entry in `output.md` + `## known pitfalls` in domain |
| Migration / phase transition | Write history entry + overwrite affected domain file |
| Routine bug fix / docs / refactor | No action — not a recordable event |

### What you see

The AI ends its response with one of:

```
cairn: recorded 1 event: history/2026-04-22_added-dep-X.md
cairn: no event recorded
```

This is a verification handshake — not a CLI command. `git diff .cairn/` shows exactly
what was written. If the event was wrong or incomplete, edit the file directly.

For the normative definition of reflection results and the required end-of-task format,
see [spec/TASK-COMPLETION-PROTOCOL.md](TASK-COMPLETION-PROTOCOL.md).

### What to do if the AI missed an event

Write the history entry yourself:

```markdown
type: decision
domain: api-layer
decision_date: 2026-04
recorded_date: 2026-04
summary: Switched from REST to tRPC for internal services
rejected: REST: too much boilerplate for internal services without consumers
reason: tRPC removes manual API layer for full-stack TypeScript services
revisit_when: If external consumers need a REST interface
```

Save to `.cairn/history/2026-04_trpc-adoption.md`. Then update the domain file if the
current design changed.

---

## Upgrading to v0.0.12

### From v0.0.11

v0.0.12 replaces the staging/reflect/audit CLI workflow with AI-direct file operations.
Your `.cairn/output.md`, `domains/`, and `history/` are fully compatible — no data migration needed.

```bash
cd <your-project>
cairn init --upgrade
```

`--upgrade` will:
- Create or refresh `.cairn/SKILL.md` from the latest protocol
- Refresh guide blocks in AI tool config files to the v0.0.12 12-line format
- Warn if `.cairn/staged/`, `.cairn/audits/`, or `.cairn/reflections/` exist

The upgrade does **not** delete old directories. Review their contents manually:
- `.cairn/staged/`: move useful candidates to `history/` (strip `history-candidate_` prefix first) or delete
- `.cairn/audits/`: merge useful pitfalls into domain `## known pitfalls` sections, then delete
- `.cairn/reflections/`: safe to delete (replaced by the `cairn: recorded …` verification line)

### From v0.0.9 or earlier

In v0.0.9 and earlier, the skill was at `.claude/skills/cairn/SKILL.md` (loaded on-demand).
From v0.0.10 onward the guide block goes to `.claude/CLAUDE.md` (always loaded at session start),
and from v0.0.12 the full protocol is at `.cairn/SKILL.md`.

```bash
cd <your-project>
cairn init --upgrade
```

Verify with `cairn doctor` — the Skill Guide and SKILL.md sections should show ✓.

### Enabling global scope

To install the guide block in global AI config files (`~/CLAUDE.md` etc.) so
Cairn activates in any project that has a `.cairn/` directory:

```bash
cairn init --global
```
