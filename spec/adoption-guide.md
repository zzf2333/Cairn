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
| Claude Code | `skills/claude-code/SKILL.md` | `.claude/skills/cairn/SKILL.md` |
| Cursor | `skills/cursor.mdc` | `.cursor/rules/cairn.mdc` |
| Windsurf | `skills/windsurf.md` | Append to `.windsurfrules` |
| Cline / Roo Code | `skills/cline.md` | Append to `.clinerules` |
| GitHub Copilot | `skills/copilot-instructions.md` | Append to `.github/copilot-instructions.md` |

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

## Using the CLI (Phase 2)

The Cairn CLI automates the most common workflow steps. All commands require a
`.cairn/` directory to exist in the current project (created by `cairn init`).

### `cairn init`

Runs the interactive initialization wizard. Creates `.cairn/output.md`,
`.cairn/history/`, `.cairn/domains/`, and installs the Skill adapter file for your
AI tool. Equivalent to running `scripts/cairn-init.sh` directly.

```bash
cairn init
```

### `cairn status`

Prints a three-layer summary of the current project state. Detects stale domain
files by comparing each domain's `updated:` frontmatter field against the
`recorded_date` of its history entries.

```bash
cairn status

# Output:
# stage:   early-growth (2024-09+)
# domains: 3 active, 1 not created
#
# ⚠  api-layer   last updated 2024-03 · 2 new history entries since
#                run: cairn sync api-layer
# ✓  auth        up to date (2024-06)
```

Use `cairn status` at the start of a work session to check if any domain files
need updating before asking the AI for planning help.

### `cairn log`

Records a history entry. Supports interactive mode (guided prompts) and flag mode
(for scripting or quick entries from the command line).

```bash
# Interactive mode
cairn log

# Flag mode
cairn log \
    --type rejection \
    --domain api-layer \
    --summary "Rejected GraphQL after evaluation" \
    --rejected "GraphQL: data complexity doesn't justify it" \
    --reason "Current team size makes GraphQL overhead unwarranted" \
    --revisit-when "Frontend needs regular cross-resource aggregation"
```

Use `cairn log` after any of the five reactive trigger events (A–E). In flag mode,
all required fields must be provided: `--type`, `--domain`, `--summary`,
`--rejected`, `--reason`. The `--revisit-when` field is optional.

After creating an entry, run `cairn status` to check if the domain file needs sync.

### `cairn sync`

Generates an AI prompt containing the current domain file and all related history
entries. Paste the prompt into your AI tool to generate an updated domain file.

```bash
# Generate prompt for a specific domain (prints to stdout)
cairn sync api-layer

# Generate prompts for all stale domains
cairn sync --stale

# Preview what would be included (no prompt output)
cairn sync api-layer --dry-run

# Copy prompt directly to clipboard
cairn sync api-layer --copy
```

The generated prompt instructs the AI to overwrite the domain file following the
Cairn format, with all rejected paths from history included. After the AI generates
the new file, save it to `.cairn/domains/<domain>.md` and run `cairn status` to
confirm the domain is up to date.

**Phase 3 note:** If you are using the Cairn MCP Server (`mcp/`), use `cairn_sync_domain("api-layer")` instead — it returns the same prompt context directly to the AI without a copy-paste step.
