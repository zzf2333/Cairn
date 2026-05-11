# Cairn v2 — Dynamic Project Memory Protocol

`.cairn/` is an AI-maintained project memory engine. You interact with it
through 6 MCP tools — not direct file operations. Cairn captures project
signals, routes them through trust levels, and maintains structured memory
that constrains your suggestions.

---

## ON SESSION START

Call `cairn_context()` before responding to any request. Pass the current
task and/or files if known:

```
cairn_context({ task?: string, files?: string[] })
```

The response contains:
- `stage` — project lifecycle phase and guidance
- `no_go[]` — directions you MUST NOT suggest
- `relevant_domains[]` — domain summaries relevant to the task
- `active_debt[]` — accepted debts you must not attempt to fix
- `warnings[]` — system health warnings

Respect all returned constraints for the remainder of the session.

---

## DURING WORK — SIGNAL DETECTION

When you detect a constraint-relevant event in conversation, call
`cairn_signal()` to report it:

```
cairn_signal({
  type: SignalType,
  domain?: string,
  details: { what, reason?, rejected_alternatives?, revisit_when? },
  evidence: { user_said?, files?, commit? }
})
```

| Event | signal_type |
|---|---|
| User rejects your suggestion with reason | `user-rejection` |
| User says "we tried this before" | `historical-reference` |
| User describes a business/tech constraint | `user-constraint` |
| A significant technical decision is made | `decision` |
| A technical debt is discovered and accepted | `debt-acceptance` |

The response tells you the routing result (`L0`–`L3`). No further action
is needed — Cairn handles storage and trust routing automatically.

**Do not call `cairn_signal()` for:**
- Routine bug fixes, formatting changes, or documentation edits
- Vague or ambiguous statements without clear constraint implications
- Information already captured in a previous signal this session

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

Call `cairn_plan()` to get historical constraints before proposing a design:

```
cairn_plan({ task: string })
```

Returns:
- `stage_guidance` — what the current project phase allows or discourages
- `historical_constraints[]` — past rejections, decisions, debts relevant to the task
- `recommended_direction` — preferred approach based on project history
- `warnings[]` — applicable cautions

`cairn_plan` is **read-only** — it never writes signals, staged entries,
or memory. Use it freely without side-effect concerns.

---

## ON SESSION END

Call `cairn_session_end()` with a summary of the session:

```
cairn_session_end({
  summary: string,
  changed_domains?: string[],
  decisions_made?: string[],
  unresolved?: string[]
})
```

This triggers:
- Batch processing of accumulated signals
- Session record creation
- Views regeneration

---

## STATUS AND DIAGNOSTICS

- `cairn_status()` — memory count, staged count, conflicts, stage advisory
- `cairn_doctor()` — health diagnostics: token budget, orphan no-gos,
  stale domains, staged backlog, TODO markers

Call these when the user asks about Cairn health or when you notice
warnings in `cairn_context()` output.

---

## CONSTRAINT PROCESSING RULES

Apply these rules based on `cairn_context()` output at all times:

**`no_go` entries**
Do not proactively suggest these directions. If the user asks about one
directly, explain the historical reason before offering alternatives.

**`active_debt` entries**
Do not attempt to fix accepted debts. Work within the constraint. Only
reopen the discussion when the revisit conditions (from the memory entry)
are met.

**`stage` advisory**
Adjust suggestion aggressiveness to the project phase:

| Phase | Guidance |
|---|---|
| `exploration` | New dependencies OK, experiments OK, direction can shift |
| `growth` | Balance speed and stability, new deps need cost assessment |
| `maturity` | New dependencies need strong justification, stability first |
| `maintenance` | Conservative changes only, necessary fixes and security updates |

If stage confidence is low (< 0.5), treat guidance as informational only.

**`warnings`**
Address conflicts and pending reviews when mentioned in warnings.

---

## DEGRADED MODE (NO MCP)

If MCP tools are unavailable, fall back to reading `.cairn/views/` files
directly:

1. Read `.cairn/views/output.md` for global constraints (no-go, stack, debt, stage)
2. Read `.cairn/views/domains/<name>.md` for domain context
3. Read `.cairn/views/stage.md` for stage advisory

`views/` is auto-generated from memory and is read-only. **Do NOT write to
`views/` directly.** Signal capture is unavailable in degraded mode.

---

## LANGUAGE CONTINUITY

When reporting signals via `cairn_signal()`:

- **Match the language** of the project's existing memory content. Detect
  from `cairn_context()` output or `views/output.md`.
- Signal details (`what`, `reason`) follow the project's language.
- Field names, signal types, and tool parameters stay English.
