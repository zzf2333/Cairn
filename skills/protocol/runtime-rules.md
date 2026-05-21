# Runtime Behavior Rules

## Constraint Processing

Apply these rules based on `cairn_context()` output at all times during a session.

### no_go Entries

Do not proactively suggest these directions.

If the user asks about a no_go direction directly, explain the historical reason before offering alternatives. Never silently ignore the constraint.

Entries with `archived: true` are one level weaker (downgraded from their original gravity) but the historical reasoning still applies. Surface them to the user as "this was previously rejected but recently revisited."

### accepted_debt Entries

Do not attempt to fix accepted debts. Work within the constraint.

Before suggesting a fix for something that looks like debt, first check:

```
revisit_when conditions
```

If revisit conditions are unmet:

- explain the tradeoff
- avoid forced refactor
- respect the original decision

Only reopen when the `revisit_when` conditions are met.

### stage_constraints

Adjust suggestion aggressiveness to the project phase:

| Phase | Behavior |
|---|---|
| `exploration` | New deps OK, experiments OK, direction can shift |
| `growth` | Balance speed and stability; new deps need cost assessment |
| `maturity` | Stability first; new deps need strong justification |
| `maintenance` | Conservative changes only; necessary fixes and security |

Maintenance phase has `reflective_challenge` strength. Any new feature plan, refactor, or migration must be surfaced to the user as a conflict before drafting. Do not silently produce the implementation. Continue only on explicit override.

If `confidence < 0.5`, treat stage guidance as informational only.

---

## DNA Is Advisory During Reevaluation

If:

```
identity.reevaluation_mode = true
```

Then:

- DNA-based challenges become advisory only
- DNA must not hard-block new paradigms
- trauma and security constraints remain fully active

When the user asks why a previously trait-driven challenge no longer fires, point them to `cairn dna show` (drift warnings) and `cairn doctor` (drift signals).

---

## Trauma Has Persistent Priority

Trauma cognition represents historically costly failure.

When trauma activates:

- increase challenge sensitivity
- prioritize warning visibility
- require explicit justification before reintroducing similar patterns
- acknowledge the trauma history explicitly in your response

Trauma is never automatically archived or dismissed.

---

## Archived Cognition Is Not Dead

Archived cognition may reactivate if repeatedly triggered (>=5 hits in 30 days).

Do not assume archived means irrelevant. The system tracks reactivation counts and will auto-resurrect high-activity archived events.

When encountering an archived constraint:

- downgrade its force by one level (hard_constraint -> reflective_challenge -> suggestion)
- still surface the historical reasoning to the user

---

## Accepted Debt Must Be Respected

Do not automatically "fix" accepted technical debt.

This is one of the most common AI anti-patterns: seeing something that looks suboptimal and "improving" it without understanding that it was a deliberate choice.

First check `revisit_when` conditions. If unmet, leave it alone.

---

## Paradigm Shift Is Allowed

Historical cognition should influence reasoning, not permanently prevent evolution.

When:

- environment changed
- team scale changed
- operational capability changed
- historical assumptions no longer hold

The system should favor reevaluation over dogma.

Use the governance flow (cairn_signal -> staged -> human_ratified) to propose paradigm shifts. Never silently override historical constraints.

---

## Language Continuity

When reporting signals via `cairn_signal()`:

- Match the language of the project's existing memory content. Detect from `cairn_context()` output or `views/output.md`.
- Signal details (`what`, `reason`) follow the project's language.
- Field names, signal types, and tool parameters always stay English.

---

## Degraded Mode (No MCP)

If MCP tools are unavailable, fall back to reading `.cairn/views/` directly:

1. `.cairn/views/output.md` — global constraints (no-go, stack, debt, stage)
2. `.cairn/views/domains/<name>.md` — per-domain context
3. `.cairn/views/stage.md` — stage advisory

`views/` is auto-generated and read-only. Do not write to views.

Signal capture is unavailable in degraded mode.

### Diagnosing MCP Transport Issues

When `cairn_*` tools fail or return "unknown tool":

1. Ask the user to run `cairn doctor`. If CLI errors, the install is broken.
2. If CLI works but MCP tools don't, check MCP config (`mcp.json` has `"cairn": { "command": "cairn-rt" }`).
3. If MCP server runs but tools return path errors, set `"env": { "CAIRN_ROOT": "/absolute/path" }` in MCP config.
