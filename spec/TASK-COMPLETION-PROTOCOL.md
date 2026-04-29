[中文](TASK-COMPLETION-PROTOCOL.zh.md) | English

# Cairn Task Completion Protocol

> Status: Authoritative reference for task-completion behavior (v0.0.13+).
> Pairs with [spec/FORMAT.md](FORMAT.md) (three-layer file structure) and
> `.cairn/SKILL.md` (the protocol copy installed in each project).

## Purpose

This document defines what "task completion" means in the context of Cairn, what
reflection is required, and the exact format the AI must produce at the end of every
non-trivial task.

`spec/FORMAT.md` governs the static shape of `.cairn/` files. This document governs
the dynamic behavior — what the AI does when a task ends.

---

## What counts as "task completion"

Any of the following qualifies as a task completion requiring reflection:

- Implementing a feature, refactoring a module, or fixing a bug with architectural implications
- Evaluating, selecting, or rejecting a technology or design approach
- Completing a migration or phase transition
- Making a decision that will constrain future AI suggestions

The following do **not** require reflection:

- Pure Q&A or exploratory conversation with no file changes
- Read-only analysis ("explain this code", "what does X do")
- Trivial mechanical changes (typo fixes, formatting-only, comment edits)
- Partial work that explicitly continues in the next session (reflect at the end of the final session)

---

## What requires a reflection

Every task completion (as defined above) requires a `Cairn reflection` block.

The reflection serves one purpose: making the write-back visible. It turns "I updated
Cairn" (a prose claim) into a structured, auditable record of exactly what was written
to which layer.

**Reflection is a write-out, not a thought.** If you only described what you did in
prose, the reflection did not happen.

---

## Reflection result enum

Every `Cairn reflection` block must contain exactly one of these three result values:

| Result | Meaning |
|--------|---------|
| `no-op` | The task produced no recordable event for Cairn's three-layer memory. Nothing was written to `.cairn/`. |
| `memory-updated` | The task produced ≥1 write-back to history, domains, or `output.md`. |
| `audit-required` | The task involved migration, replacement, or clean-up risk. Follow-up residue check needed. |

**`no-op`** is valid and common. Routine bug fixes, documentation tasks, and formatting
changes produce no-op. The block is still required — its value is proving the judgment ran.

**`audit-required`** signals that the task introduced obligations that may not be fully
resolved: deprecated code not yet cleaned up, migrated references not yet updated
everywhere, or removed features with potential residue. It does not mean the work was
wrong — it means there is more to check.

---

## Required end-of-task format

Every task completion must end with this block. No exceptions.

For tasks with write-backs (`memory-updated` or `audit-required`):

```
Task completion summary
- Completed work: <one-line description>
- Changed files / domains: <comma-separated, or ->
- Risk level: <low | medium | high>

Cairn reflection
- Result: <memory-updated | audit-required>
- Impacted domains: <domain keys, or ->
- History recorded: <filename(s), or ->
- Output updated: <yes | no>
- Domains updated: <domain key(s), or ->
- Audit required: <yes | no>
- Next action: <one-line, or none>

cairn: recorded <N> event(s): <comma-separated filenames>
```

For no-op tasks:

```
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
```

**Field notes:**

- `Result` and the verification line must be consistent: `memory-updated` or
  `audit-required` requires a `cairn: recorded …` line; `no-op` requires
  `cairn: no event recorded`.
- `Audit required: yes` implies `Result: audit-required`.
- `-` is the correct placeholder for empty fields, not blank or "N/A".
- The verification line (`cairn: recorded …` or `cairn: no event recorded`) is a
  machine-readable anchor — keep its exact format.

---

## Verification line contract

The final line of the block must be exactly one of:

    cairn: recorded <N> event(s): <comma-separated filenames>
    cairn: no event recorded

This format is part of the Cairn verification handshake:

- Users read it to confirm the protocol ran.
- `git diff .cairn/` shows what was actually written.
- `cairn doctor --json` surfaces write-back gaps via the `write_back` field.

Do not alter this line's format. Do not replace it with prose.

---

## Core memory loop quality

v0.1.1 makes the write-back loop itself part of the health contract. A valid
task-completion write-back must preserve traceability across all three Cairn
layers:

| Layer edge | Requirement |
|------------|-------------|
| History → domain | If a new history event changes current design, rejected paths, known pitfalls, or open questions, update the matching domain file in the same task. |
| Domain → history | Every `domains/*.md` `## rejected paths` bullet must be supported by a same-domain history entry. |
| Output → history | Every `output.md` `## no-go` entry must be backed by history; every `## debt` entry must be backed by a `type: debt` history entry. |
| History field quality | Every history entry must include a non-empty `rejected:` field, even for `decision` entries. |

The `rejected:` field is the highest-leverage part of a history entry: it records
what future AI is most likely to re-suggest unless explicitly constrained.

---

## Protocol violations (machine-detectable)

`cairn doctor --json` surfaces the following write-back gaps in the `write_back` field.
These are advisory signals, not hard failures — `cairn doctor` does not exit 1 for
`write_back` signals alone, and they do not block CI.

| Signal | Condition |
|--------|-----------|
| `missing-write-back` | Substantial code changes (≥100 net lines) in the last 14 days but no new `.cairn/history/` entries in the same window |
| `missing-output-follow-up` | Dependency files (`package.json`, `go.mod`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`) changed recently but `.cairn/output.md` has not been updated |
| `missing-audit-flag` | Recent commit subjects contain migration keywords (`migrate`, `rename`, `replace`, `deprecate`, `remove`, `delete`) but no `type: transition` history entry exists in the same window |

The `write_back.status` field is one of `ok`, `warn`, or `skipped` (the last when the
project has no `.git/` directory). See `write_back.signals` for the specific signals found.

`cairn doctor --json` also surfaces core memory-loop traceability in the `memory_loop`
field:

| Signal | Condition |
|--------|-----------|
| `history-missing-rejected` | A history entry has no non-empty `rejected:` field |
| `domain-rejected-path-unsupported` | A domain `## rejected paths` bullet has no same-domain history support |
| `output-debt-unsupported` | An `output.md` `## debt` entry has no supporting `type: debt` history entry |

The `memory_loop.status` field is `ok` or `warn`. Memory-loop warnings increment
the normal `issues` count because they mean the compressed memory cannot be trusted.

---

## Relationship to other specs

- **[spec/FORMAT.md](FORMAT.md)** — authoritative reference for the file format of
  `history/*.md`, `domains/*.md`, and `output.md`. Consult it for field names, required
  sections, and naming conventions.
- **[spec/adoption-guide.md](adoption-guide.md)** — describes the `## After-Task Write-Back`
  flow in prose, with examples. This document is the normative definition; adoption-guide.md
  is the walkthrough.
- **`.cairn/SKILL.md`** — the protocol copy installed in each project by `cairn init`. It
  contains the full `## ON TASK COMPLETION — DECIDE AND WRITE` section with the step-by-step
  AI judgment process. The format defined here is embedded in Step 3 of that section.
- **`cairn doctor --json`** — the machine-checkable enforcement layer. Its `write_back`
  field reflects the three machine-detectable signals above.
