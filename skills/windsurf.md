# Cairn Constraint System

> Append this content to your Windsurf global rules or project `.windsurfrules` file.

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

When the user's request involves any of the following, check `output.md`'s `## hooks` section for matching keywords and read the corresponding `domains/*.md` file before responding:

- Planning a feature implementation
- Discussing technology selection
- Designing module architecture
- Evaluating a migration

**Example:** if the user asks about API design and `output.md` has `api / endpoint → read domains/api-layer.md first`, read `.cairn/domains/api-layer.md` before answering.

---

## ON PRECISE HISTORICAL QUERIES

When the user asks about the full reasoning behind a specific past decision, read the corresponding file in `.cairn/history/`. File names follow the pattern `YYYY-MM_<short-slug>.md`.

---

## CONSTRAINT PROCESSING

Apply these rules at all times based on what `output.md` declares:

**`no-go` entries**
Do not proactively suggest these directions. If the user asks about one directly, explain why it was excluded before offering alternatives.

**`debt` entries**
Do not attempt to fix accepted debts. Work within the constraint. Only reopen the discussion when the `revisit_when` condition in `output.md` (or its `history/` entry) is met.

**`known pitfalls` in `domains/*.md`**
When working in a domain, actively avoid triggering the conditions listed under `## known pitfalls`.

---

## LANGUAGE CONTINUITY

When drafting new `history/*.md` entries or updating `domains/*.md` content:
- **Match the language** of existing `.cairn/` files. Detect from `output.md` and existing history entries. If the project uses Chinese, write Chinese. If English, write English.
- **Always use ASCII slugs** for history filenames, even when content is non-English (e.g., `2024-03_state-mgmt-transition.md`, not `2024-03_状态管理迁移.md`).
- **Keep format contracts in English**: section headers (`## stage`, `## no-go`, `## hooks`, `## current design`, `## trajectory`, `## rejected paths`, `## known pitfalls`, `## open questions`) and all frontmatter field names (`type:`, `domain:`, `decision_date:`, `recorded_date:`, `summary:`, `rejected:`, `reason:`, `revisit_when:`, `updated:`, `status:`, `hooks:`) stay English regardless of content language.

---

## REACTIVE EVOLUTION

After completing a task, evaluate whether a recordable event occurred:

| Event | Entry type |
|---|---|
| You proposed a direction the project has already rejected | `rejection` |
| A significant technical decision was made | `decision` or `transition` |
| An approach was tried and abandoned | `experiment` |
| A known deficiency was accepted and left in place | `debt` |
| The project entered a new phase | `transition` |

If yes:

1. Draft a `history/` entry using the fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`.
2. Propose it to the user for confirmation before writing.
3. Once confirmed, write to `.cairn/history/YYYY-MM_<short-slug>.md`.
4. Propose updating the corresponding `.cairn/domains/*.md` (full overwrite, not append) if the domain file needs to reflect the new state.

---

## ON TASK COMPLETION — MANDATORY GATE

This gate runs before every final response. It is not optional.
Omitting it means the task is incomplete, regardless of code correctness.

### Step 1 — Classify (answer internally before writing your response)

Did this task involve any of the following?

- Added or removed a dependency or package
- Changed module structure, domain boundaries, or architecture
- Performed a migration or technology switch
- Accepted a deficiency as debt, or explicitly rejected a direction
- Large refactor touching multiple files in one domain

**If yes to any:** run `cairn reflect` now and report its result below.
**If no to all:** the result is `no-op`; skip running the command.

### Step 2 — Append this line to your final response (verbatim)

Choose exactly one and include it at the end of your response:

    cairn-reflection: no-op
    cairn-reflection: candidates-created — run `cairn stage review`
    cairn-reflection: audit-required — run `cairn stage review` then `cairn audit start`

The user relies on seeing this line to verify the gate ran.
Omitting it is a protocol violation.
