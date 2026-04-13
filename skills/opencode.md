# Cairn — AI Path-Dependency Constraint System

Append this file to `AGENTS.md` at your project root. OpenCode also supports
`CLAUDE.md` as a fallback if `AGENTS.md` is not present.

To include additional instruction files, add them to `opencode.json`:
```json
{
  "instructions": ["AGENTS.md"]
}
```

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

## REACTIVE EVOLUTION

After completing a task, evaluate whether a recordable event occurred (decision,
rejection, transition, debt, experiment). If yes:

1. Draft a `history/` entry with fields: `type`, `domain`, `decision_date`,
   `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`.
2. Propose it to the user for confirmation before writing.
3. Once confirmed, write to `.cairn/history/YYYY-MM_<short-slug>.md`.
4. Propose updating the corresponding `domains/*.md` if needed (full overwrite, not append).
