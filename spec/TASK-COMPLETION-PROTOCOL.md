[中文](TASK-COMPLETION-PROTOCOL.zh.md) | English

# Cairn Task Completion Protocol

> Status: MCP-based signal capture replaces manual reflection blocks.
> Pairs with [spec/FORMAT.md](FORMAT.md) (data schemas) and
> `skills/claude-code/SKILL.md` (operating protocol).

---

## Task Completion Behavior

### During Work

The AI calls `cairn_signal()` whenever it detects a constraint-relevant event:

| Event | signal_type |
|---|---|
| User rejects a suggestion with reason | `user-rejection` |
| User references a past attempt | `historical-reference` |
| User states a business or technical constraint | `user-constraint` |
| A significant technical decision is made | `decision` |
| A technical debt is discovered and accepted | `debt-acceptance` |

Each signal is routed through the Trust Router:

- **L0** — noise or duplicate, dropped
- **L1** — saved to `signals/` for accumulation
- **L2** — saved to `staged/` for human review
- **L3** — written directly to `memory/`, views regenerated

No manual file operations are needed. The AI receives a routing result and
continues working.

### At Session End

The AI calls `cairn_session_end()` with:

- `summary` — what was accomplished
- `changed_domains` — which domains were touched
- `decisions_made` — any decisions that crystallized
- `unresolved` — open questions remaining

This triggers:
1. Batch processing of L1 signals (accumulation check → possible L2 upgrade)
2. Session record creation in `.cairn/sessions/`
3. Views regeneration from current memory state

---

## What AI Does NOT Do

- **Does not** write to `.cairn/` files directly (memory, signals, staged, views)
- **Does not** produce "Cairn reflection" blocks
- **Does not** manually track event counts
- **Does not** update `output.md` or domain files — the Views Engine handles this
- **Does not** decide trust levels — the Trust Router handles routing

---

## Degraded Mode (No MCP)

If MCP tools are unavailable, the AI cannot capture signals. The session proceeds
without memory updates. `views/` remains as the last-generated snapshot and can be
read directly for constraints.

Signal capture resumes when MCP is available again. No data is lost — `views/`
accurately reflects the last known state.

---

## Relationship to Other Specs

- **[spec/FORMAT.md](FORMAT.md)** — schema reference for all `.cairn/` data files
- **[spec/DESIGN.md](DESIGN.md)** — design rationale for the Trust Router and dual-ear architecture
- **[spec/adoption-guide.md](adoption-guide.md)** — installation and daily usage guide
- **`skills/claude-code/SKILL.md`** — the operating protocol AI follows
