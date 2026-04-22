# Cairn — Path-dependent Constraint Memory Protocol

`.cairn/` is a three-layer file system that records project constraints, technical
decisions, and rejected paths. You read it to constrain your suggestions; you write
to it when decisions crystallize. **There is no CLI ceremony — maintain the memory
directly with your native file tools (Read, Write, Edit).**

---

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the
constraint framework for the entire session:

- `## stage` — current project phase and decision-making priority order
- `## no-go` — directions you MUST NOT suggest (even if technically valid)
- `## hooks` — keyword-to-domain mappings: when a user request matches a keyword,
  read the corresponding `domains/*.md` before answering
- `## stack` — active technology choices (do not suggest replacements without cause)
- `## debt` — accepted debts you MUST NOT attempt to fix; respect `revisit_when`

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

When the user's request involves planning a feature, selecting a technology, designing
module architecture, or evaluating a migration, check `output.md`'s `## hooks` section
for matching keywords and read the corresponding `domains/*.md` file before responding.

**Example:** if the user asks about API design and `output.md` has
`api / endpoint / tRPC / GraphQL → read domains/api-layer.md first`,
read `.cairn/domains/api-layer.md` before answering.

---

## ON PRECISE HISTORICAL QUERIES

When the user asks about the full reasoning behind a specific past decision, read the
corresponding file in `.cairn/history/`. File names follow the pattern
`YYYY-MM_<short-slug>.md`.

---

## CONSTRAINT PROCESSING

Apply these rules at all times based on what `output.md` declares:

**`no-go` entries**
Do not proactively suggest these directions. If the user asks about one directly,
explain why it was excluded before offering alternatives.

**`debt` entries**
Do not attempt to fix accepted debts. Work within the constraint. Only reopen the
discussion when the `revisit_when` condition in `output.md` (or its `history/` entry) is met.

**`known pitfalls` in `domains/*.md`**
When working in a domain, actively avoid triggering the conditions listed under
`## known pitfalls`.

---

## LANGUAGE CONTINUITY

When writing new `history/*.md` entries or updating `domains/*.md` content:

- **Match the language** of existing `.cairn/` files. Detect from `output.md` and
  existing history entries. If the project uses Chinese, write Chinese. If English,
  write English.
- **Always use ASCII slugs** for history filenames, even when content is non-English
  (e.g., `2024-03_state-mgmt-transition.md`, not `2024-03_状态管理迁移.md`).
- **Keep format contracts in English**: section headers (`## stage`, `## no-go`,
  `## hooks`, `## current design`, `## trajectory`, `## rejected paths`,
  `## known pitfalls`, `## open questions`) and all frontmatter field names
  (`type:`, `domain:`, `decision_date:`, `recorded_date:`, `summary:`, `rejected:`,
  `reason:`, `revisit_when:`, `updated:`, `status:`, `hooks:`) stay English
  regardless of content language.

---

## ON TASK COMPLETION — DECIDE AND WRITE

This is a judgment step you perform yourself at the end of every non-trivial task.
**There are no commands to run. You write the files directly.**

**Rule**: No task is complete until you have produced an explicit `Cairn reflection`
block and a verification line. Reflection is a write-out, not a thought — if you
only said it in prose, it didn't happen.

### Step 1 — Was there a recordable event?

| Event | Entry type | Also update |
|---|---|---|
| Significant technical decision made | `decision` | Maybe `domains/*.md` |
| Approach tried and abandoned | `experiment` | Maybe `domains/*.md` |
| Direction explicitly rejected | `rejection` | `output.md` `## no-go` + `domains/*.md` |
| Deficiency accepted as debt | `debt` | `output.md` `## debt` (with `revisit_when`) + `domains/*.md` |
| Migration / phase transition | `transition` | `output.md` `## stage` + `domains/*.md` |
| Routine bug fix, documentation, small refactor | — | Nothing |

If no event qualifies, skip to Step 3.

### Step 2 — Write the files

**a) Create a history entry** using Write tool:

```
.cairn/history/YYYY-MM_<short-ascii-slug>.md
```

Content (plain text, no markdown fences — these are the actual file contents):

```
type: <decision | rejection | transition | debt | experiment>
domain: <domain key>
decision_date: <YYYY-MM>
recorded_date: <YYYY-MM>
summary: <one sentence>
rejected: <what alternatives were evaluated and not chosen — MOST CRITICAL FIELD>
reason: <why this path was taken>
revisit_when: <condition for re-evaluation>
```

`rejected` is mandatory for every entry type. Even `decision` entries must record
what alternatives were considered and discarded.

**b) If the event changes a domain's current state** — use Edit tool to overwrite the
corresponding `.cairn/domains/<name>.md`. Domains reflect **current state only** —
overwrite, do not append. The domain file structure:

```
---
domain: <domain-key>
hooks: ["keyword1", "keyword2"]
updated: <YYYY-MM>
status: <active | stable>
---

# <domain-name>

## current design

<1–3 sentences: current state, primary choice, unresolved boundaries>

## trajectory

<YYYY-MM> <event> → <one-line reason if changed>

## rejected paths

- <option>: <rejection reason>
  Re-evaluate when: <condition>

## known pitfalls

- <name>: <trigger> / <why> / <what NOT to do>

## open questions

- <unresolved question>
```

**c) If the event introduces a new no-go or accepted debt** — use Edit tool to add
the entry to `.cairn/output.md` under the appropriate section (`## no-go` or `## debt`).
Keep `output.md` under 500 tokens; move detailed rationale to `domains/` and `history/`.

### Step 3 — Emit the completion block

End your response with this exact structure:

    Task completion summary
    - Completed work: <one-line description>
    - Changed files / domains: <comma-separated, or ->
    - Risk level: <low | medium | high>

    Cairn reflection
    - Result: <no-op | memory-updated | audit-required>
    - Impacted domains: <domain keys, or ->
    - History recorded: <filename(s), or ->
    - Output updated: <yes | no>
    - Domains updated: <domain key(s), or ->
    - Audit required: <yes | no>
    - Next action: <one-line, or none>

    cairn: recorded <N> event(s): <comma-separated filenames>

For a no-op task, use:

    Task completion summary
    - Completed work: <one-line description>
    - Changed files / domains: -
    - Risk level: low

    Cairn reflection
    - Result: no-op
    - Impacted domains: -
    - History recorded: -
    - Output updated: no
    - Domains updated: -
    - Audit required: no
    - Next action: none

    cairn: no event recorded

`Result` must be one of: `no-op`, `memory-updated`, `audit-required`.
`memory-updated` or `audit-required` → `cairn: recorded …`.
`no-op` → `cairn: no event recorded`.
The user git-reviews `.cairn/` from this block. `cairn doctor --json` surfaces drift.

---

## WRITING RULES FOR CAIRN FILES

1. Every line in `output.md` MUST change AI behavior — if removing it would not
   change your suggestions, delete it.
2. Domain files are overwritten with current state, never appended.
3. History entries are append-only (write new files, never edit existing entries).
4. The `rejected` field in history is the most critical field — it records what the
   AI is most likely to re-suggest in the future.
5. Do not invent domain keys — use only the domain keys declared in `## hooks`
   in `output.md`. If a task touches multiple domains, pick the closest match.
6. Keep slugs short and descriptive: `2024-03_trpc-rejection`, `2024-09_auth-jwt`.

---

## REFLECTION RESULTS

Quick reference — match your result to the correct enum value:

| Result | When to use |
|--------|-------------|
| `no-op` | Task produced no recordable event (routine fix, docs, formatting, read-only work) |
| `memory-updated` | Task produced ≥1 write-back: history entry created, domain updated, or `output.md` changed |
| `audit-required` | Task involved migration, replacement, or clean-up risk with potential residue |

`audit-required` does not mean the work was incomplete — it means follow-up residue
checks are needed. Full definitions: `spec/TASK-COMPLETION-PROTOCOL.md`.
