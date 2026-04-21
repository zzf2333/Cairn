# Cairn — AI Path-Dependency Constraint System

Add this file to `GEMINI.md` at your project root (or `~/.gemini/GEMINI.md` for global scope).

Gemini CLI loads `GEMINI.md` files from the global home directory, the project root,
and subdirectories — all concatenated in order.

---

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the
constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

When the user's request involves planning, technology selection, module architecture,
or migration evaluation, check `output.md`'s `## hooks` section for matching keywords
and read the corresponding `domains/*.md` file before responding.

**Example:** if the user asks about API design and `output.md` has
`api / endpoint → read domains/api-layer.md first`, read `.cairn/domains/api-layer.md`
before answering.

---

## ON PRECISE HISTORICAL QUERIES

When the user asks about the full reasoning behind a specific past decision, read the
corresponding file in `.cairn/history/`. File names follow the pattern
`YYYY-MM_<short-slug>.md`.

---

## CONSTRAINT PROCESSING

**`no-go` entries** — Do not suggest these directions. If asked directly, explain why
it was excluded before offering alternatives.

**`debt` entries** — Do not attempt to fix accepted debts. Work within the constraint.
Only reopen the discussion when the `revisit_when` condition is met.

**`known pitfalls` in `domains/*.md`** — Actively avoid triggering the conditions listed.

---

## LANGUAGE CONTINUITY

When drafting new `history/*.md` entries or updating `domains/*.md` content:
- **Match the language** of existing `.cairn/` files. Detect from `output.md` and existing history entries. If the project uses Chinese, write Chinese. If English, write English.
- **Always use ASCII slugs** for history filenames, even when content is non-English (e.g., `2024-03_state-mgmt-transition.md`, not `2024-03_状态管理迁移.md`).
- **Keep format contracts in English**: section headers (`## stage`, `## no-go`, `## hooks`, `## current design`, `## trajectory`, `## rejected paths`, `## known pitfalls`, `## open questions`) and all frontmatter field names (`type:`, `domain:`, `decision_date:`, `recorded_date:`, `summary:`, `rejected:`, `reason:`, `revisit_when:`, `updated:`, `status:`, `hooks:`) stay English regardless of content language.

---

## REACTIVE EVOLUTION

After completing a task, evaluate whether a recordable event occurred (decision,
rejection, transition, debt, experiment). If yes:

1. Draft a `history/` entry with fields: `type`, `domain`, `decision_date`,
   `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`.
2. Propose it to the user for confirmation before writing.
3. Once confirmed, write to `.cairn/history/YYYY-MM_<short-slug>.md`.
4. Propose updating the corresponding `domains/*.md` if needed (full overwrite, not append).

---

## ON TASK COMPLETION

A task is not truly complete until Cairn reflection has run.

After finishing any feature, refactor, migration, or significant change:

1. Summarize what changed.
2. Determine whether project state may have changed (architecture, dependencies, domain boundaries, accepted constraints).
3. Run or instruct the user to run: `cairn reflect`
4. Report the reflection result explicitly:
   - **no-op** — no Cairn update needed; reflection still recorded.
   - **candidates-created** — staged updates written; run `cairn stage review`.
   - **audit-required** — migration detected; run `cairn stage review` then `cairn audit start`.

**What triggers reflection:** new/removed dependencies, domain-level file changes, architecture changes, migrations, large refactors touching multiple files in one domain.

**What produces no-op:** copy or text-only changes, small bug fixes with no architecture implications, isolated implementation details that don't affect future AI guidance.

Reflection is always required. Even a no-op result is a valid outcome — it proves the step ran.
