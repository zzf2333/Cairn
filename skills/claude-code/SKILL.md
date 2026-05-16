# Cairn V3 — Cognitive Heartbeat Protocol

Cairn is an AI-native engineering cognition engine. `.cairn/` stores
structured project memory — decisions, rejections, trade-offs, trauma —
that constrains your suggestions and prevents repeated mistakes.

You interact with Cairn exclusively through **11 MCP tools**. Never read
or write `.cairn/` files directly (except `views/` in degraded mode).

| Tool | Purpose |
|---|---|
| `cairn_init_status` | Check initialization state |
| `cairn_init_commit` | Write initial cognition (config, skeleton, blood, stage, DNA) |
| `cairn_context` | Activate constraints before any task |
| `cairn_signal` | Capture real-time constraint signals |
| `cairn_plan` | Get history-aware planning guidance (read-only) |
| `cairn_session_end` | Close session, trigger decay + views regen |
| `cairn_stage_list` | List staged entries pending review |
| `cairn_stage_accept` | Promote staged entry to blood |
| `cairn_stage_reject` | Reject staged entry with reason |
| `cairn_status` | System state summary |
| `cairn_doctor` | Cognitive consistency validator |

---

## 0. INITIALIZATION

On first encounter with a project, check whether Cairn is initialized:

```
cairn_init_status()
→ { status, has_cairn_dir, next_action }
```

If `status` is `"not_initialized"`, perform **AI-native initialization**:

1. Analyze the project using your own capabilities:
   - Read `README.md`, docs, `CLAUDE.md` / `.cursorrules` for constraints
   - Read `git log` for evolution history (reverts, migrations, dependency changes)
   - Read dependency files (`package.json`, `go.mod`, etc.)
   - Read source directory structure
2. Generate structured cognition candidates:
   - **Skeleton**: module boundaries, ownership, causal keywords
   - **Blood candidates**: decisions, rejections, transitions, constraints
   - **Stage advisory**: project lifecycle phase estimate
   - **DNA traits**: personality patterns (optional, if enough evidence)
3. Present findings to user for confirmation
4. Write via:

```
cairn_init_commit({
  config: { project_name, domains, cognitive_mode },
  skeleton: [{ domain, role, owns, does_not_own, causal_keywords, dependencies? }],
  blood_candidates: [{
    type, domain, gravity: { level },
    summary, behavior_effect: { type, instruction },
    source: { type, confidence },
    lifecycle: { validity },
    rejected_paths?, revisit?, trauma?
  }],
  stage?: { phase, confidence, evidence },
  dna?: { traits: [{ name, level, confidence, reasoning }] }
})
```

All candidates pass through the Trust Router — G2+ items enter `staged/`
and require human ratification. Do not bypass this.

---

## 1. SESSION START — cairn_context

**Call before responding to any request.** Pass the current task and/or
files if known:

```
cairn_context({ task?: string, files?: string[] })
```

Returns:

```json
{
  "stage": { "phase", "confidence", "status", "guidance" },
  "dna": { "relevant_traits": [{ "name", "level", "implication" }] },
  "constraints": {
    "no_go": [{ "what", "reason", "gravity", "source_event" }],
    "accepted_debt": [{ "what", "reason", "revisit_when" }],
    "stage_constraints": [string]
  },
  "relevant_domains": [{
    "domain", "skeleton_role",
    "rejected_paths": [{ "path", "reason" }],
    "open_questions", "pitfalls"
  }],
  "challenges": [{
    "level": "suggestion" | "reflective_challenge" | "hard_constraint",
    "conflict_with", "description",
    "required_response?", "trauma?"
  }],
  "meta": { "skeleton_nodes_activated", "blood_events_scanned", "context_token_estimate" }
}
```

**Respect all returned constraints for the remainder of the session.**

When the response contains pending staged entries (check via
`cairn_stage_list`), prompt the user to review them.

---

## 2. DURING WORK — cairn_signal

When you detect a constraint-relevant event in conversation, call:

```
cairn_signal({
  signal_type: SignalType,
  domain?: string,
  details: {
    what: string,
    aliases?: string[],            // 等价名/类别，让免疫系统能识别同义改写。例：what="MongoDB" → aliases=["document store","nosql"]
    reason?: string,
    rejected_alternatives?: [{ path, reason }],
    revisit_when?: string[]
  },
  evidence: {
    user_said?: string,
    files?: string[],
    commit_ref?: string
  }
})
```

### Signal Detection Rules

| Conversation Event | signal_type |
|---|---|
| User rejects your suggestion with a reason | `user_rejection` |
| User says "we tried this before" or references past decisions | `historical_reference` |
| User describes a business or technical constraint | `constraint_declaration` |
| A significant technical decision is made | `decision` |
| Technical debt is discovered and explicitly accepted | `debt_acceptance` |
| User says "not in this phase" or "not now" | `stage_constraint` |

### When NOT to signal

- Routine bug fixes, formatting, documentation edits
- Vague statements without clear constraint implications
- Information already captured in a previous signal this session
- Implementation details that don't affect future decisions

### Signal Response

```json
{
  "accepted": true,
  "routing": {
    "level": "G0" | "G1" | "G2" | "G3",
    "destination": "dropped" | "staged" | "blood",
    "governance": "system_validated" | "agent_proposed" | "human_ratified"
  },
  "challenges": [{ "level", "conflict_with", "description" }]
}
```

If `challenges` is non-empty, the new signal conflicts with existing
cognition. Present the conflict to the user.

---

## 3. PLANNING — cairn_plan

Before proposing designs or architecture changes, call:

```
cairn_plan({ task: string })
```

Returns stage guidance, DNA guidance, historical constraints, recommended
direction, warnings, and open questions. **Read-only** — never writes
signals, staged entries, or memory.

Use `cairn_plan` for:
- Architecture proposals
- Technology selection
- Module boundary changes
- Dependency decisions

Do not use for routine bug fixes or small changes.

---

## 4. GOVERNANCE — Staged Entry Review

When `cairn_context` indicates pending staged entries:

1. `cairn_stage_list()` — list all pending entries
2. Present each entry to the user with domain, gravity, and content
3. Per user decision:
   - `cairn_stage_accept({ id })` — promote to blood (permanent cognition)
   - `cairn_stage_reject({ id, reason })` — reject with documented reason

Staged entries follow the governance flow:
`agent_proposed` → `system_validated` → `human_ratified`

**Never auto-accept staged entries.** They exist precisely because they
require human judgment.

---

## 5. SESSION END — cairn_session_end

Call at the end of every session:

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
- Decay check on existing blood entries
- Session record creation
- Views regeneration

---

## 6. DIAGNOSTICS

- `cairn_status()` — blood count, staged count, skeleton nodes, DNA status,
  stage advisory, governance pending
- `cairn_doctor()` — 5 consistency rules + health checks:
  1. DNA vs recent event consistency
  2. No-go entries have blood support
  3. Skeleton nodes match reality
  4. Archived events not over-activated
  5. No contradictory constraints in same domain

Call when the user asks about Cairn health, or when you notice anomalies.

---

## CONSTRAINT PROCESSING RULES

Apply these rules based on `cairn_context()` output at all times:

### no_go entries

Do not proactively suggest these directions. If the user asks about one
directly, explain the historical reason before offering alternatives.

### accepted_debt entries

Do not attempt to fix accepted debts. Work within the constraint. Only
reopen when the `revisit_when` conditions are met.

### stage advisory

Adjust suggestion aggressiveness to the project phase:

| Phase | Behavior |
|---|---|
| `exploration` | New deps OK, experiments OK, direction can shift |
| `growth` | Balance speed and stability, new deps need cost assessment |
| `maturity` | Stability first, new deps need strong justification |
| `maintenance` | Conservative changes only, necessary fixes and security |

If `confidence < 0.5`, treat stage guidance as informational only.

### challenges — Three-Level Intervention

| Level | Your Response |
|---|---|
| `suggestion` | Note the conflict; you may proceed if justified |
| `reflective_challenge` | You **must** explain why historical premises no longer apply before proceeding |
| `hard_constraint` | **Do not proceed.** Inform the user. Only a `reevaluation` flow (human-ratified) can lift this |

Trauma-flagged challenges (`trauma: true`) indicate historical incidents.
Treat these with extra caution — acknowledge the trauma history explicitly.

---

## DEGRADED MODE (NO MCP)

If MCP tools are unavailable, fall back to reading `.cairn/views/` directly:

1. `.cairn/views/output.md` — global constraints (no-go, stack, debt, stage)
2. `.cairn/views/domains/<name>.md` — per-domain context
3. `.cairn/views/stage.md` — stage advisory

`views/` is auto-generated and read-only. **Do not write to views/.**
Signal capture is unavailable in degraded mode.

---

## LANGUAGE CONTINUITY

When reporting signals via `cairn_signal()`:

- **Match the language** of the project's existing memory content. Detect
  from `cairn_context()` output or `views/output.md`.
- Signal details (`what`, `reason`) follow the project's language.
- Field names, signal types, and tool parameters always stay English.
