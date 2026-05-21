---
name: cairn
description: >-
  Cairn Cognitive Runtime Protocol. Activates for all technical sessions
  when cairn MCP server is connected. Governs: context loading, plan
  validation, signal capture, observation before commits, session closure.
---

# Cairn Cognitive Runtime Protocol

# Cairn Runtime Core

Governs technical reasoning. Does NOT activate for trivial formatting, typos, pure explanation, or non-technical conversation.

## Lifecycle

Before technical reasoning:
  → `cairn_context()`

Before architecture decisions:
  → `cairn_plan()`

When explicit long-term cognition appears:
  → `cairn_signal()`

Before commit or large structural change:
  → `cairn_observe()`

When task completes or topic changes:
  → `cairn_session_end()`

If `recovery_required`:
  → `cairn_session_recover()` then `cairn_context()` again

No `cairn_context` = no technical recommendation.

## Constraints

Respect ALL returned constraints for the entire session:
- `no_go` — never suggest these directions
- `accepted_debt` — do not fix; work within
- `stage_constraints` — adjust aggressiveness to project phase
- `challenges` — respond per level below

## Challenges

- `suggestion` — acknowledge; may proceed
- `reflective_challenge` — MUST justify in writing why history no longer applies
- `hard_constraint` — do NOT proceed; inform user
- `trauma` — acknowledge history explicitly; extra caution
- `archived` — downgraded one level; still surface reasoning

## Two Rules

Do not silently ignore historical cognition. Capture it.
Do not treat historical cognition as immutable truth. Prefer reevaluation over dogma.

---

# Minimal Intervention Rules

Cairn exists to protect cognition, not to tax every interaction. These rules define when each lifecycle step can be skipped.

## Skip context when

- Fixing a typo, formatting, or linting issue
- Answering a pure explanation question ("what does this function do?")
- Non-technical conversation (project management, scheduling, chat)
- One-line string/config change with no architectural implication
- User explicitly asks for a quick answer without project context

## Skip plan when

- Change is local to a single function or file
- Isolated utility addition with no cross-module impact
- Tiny dependency bump (patch version, no API change)
- Bug fix with obvious root cause and localized fix
- Implementing a plan that was already validated by `cairn_plan`

## Skip observe when

- Commit contains only whitespace, formatting, or comment changes
- Commit is a docs-only typo fix
- Merge commit with no manual resolution
- Commit was already fully covered by explicit `cairn_signal` calls during the session

## Skip session_end when

- No technical work was done in the session (pure Q&A, explanation only)
- Session consisted of a single trivial fix with no signals captured
- User is explicitly continuing work in the same session (session_end will be called later)

## The test

When unsure, ask: "Would a future AI session benefit from knowing what happened here?"

- Yes → follow the lifecycle
- No → skip safely

---

# Lifecycle Reference

> **Runtime protocol**: see `core.md` for the short protocol you must follow every session.
> This document is the detailed reference — parameter semantics, return value handling, edge cases, and recovery procedures.

---

## 1. Context — Detailed Semantics

Before any of the following:

- architecture suggestions
- refactoring plans
- code generation
- dependency selection
- database changes
- infrastructure discussions
- debugging strategy
- security decisions

You MUST call:

```
cairn_context({ task?, files? })
```

Rule:

```
No cairn_context = no technical recommendation.
```

`cairn_context` is the session guard. It creates an active session, activates cognition, loads constraints, and detects stale sessions. Within the same session, calling again is safe (it touches the existing session).

If response indicates `session.recovery_required`:

```
1. call cairn_session_recover()
2. call cairn_context() again
3. only then continue
```

Respect ALL returned constraints for the entire session:

| Field | Required Behavior |
|---|---|
| `constraints.no_go` | Never suggest these directions |
| `constraints.accepted_debt` | Do not fix; work within |
| `constraints.stage_constraints` | Adjust aggressiveness to phase |
| `challenges[]` | Respond per escalation level |
| `relevant_domains[].rejected_paths` | Treat as banned alternatives |

If `interaction_hint` is returned:

| Hint | Required Behavior |
|---|---|
| `review_staged_first` | Enumerate pending staged entries. Ask the user to accept/reject. |
| `needs_init` | Analyze the repo. Propose `cairn_init_commit({ dry_run: true })`. |

---

## 2. Plan Before Architecture

Before any of the following:

- introducing frameworks
- changing module boundaries
- changing state management
- infrastructure changes
- migrations
- large refactors
- introducing abstractions

You MUST call:

```
cairn_plan({ task })
```

Requires prior `cairn_context`. Will reject if context not loaded.

Purpose: detect conflict with historical rejections, trauma, accepted debt, DNA modulation, and architectural boundaries before you start drafting.

---

## 3. Signal on Explicit Cognition

When the user:

- rejects a proposal
- establishes a constraint
- references historical failure
- accepts technical debt
- defines architecture preference
- changes governance
- approves a paradigm shift

You MUST call:

```
cairn_signal({ signal_type, domain?, details, evidence })
```

Do not silently acknowledge long-term cognition. Capture it.

Signal types:

| Conversation Pattern | signal_type |
|---|---|
| User rejects your suggestion with a reason | `user_rejection` |
| User references past attempt ("we tried X before") | `historical_reference` |
| User states a constraint ("we never use Redis") | `constraint_declaration` |
| A significant technical decision is made | `decision` |
| Technical debt explicitly accepted | `debt_acceptance` |
| User says "not in this phase" / "not now" | `stage_constraint` |

When NOT to signal:

- Routine bug fixes, formatting, documentation edits
- Vague statements without clear constraint implications
- Information already captured in a previous signal this session
- Implementation details that don't affect future decisions

If `challenges[]` is non-empty in the response, present the conflict to the user before continuing.

---

## 4. Observe Before Commit

Before any of the following:

- git commit
- large file changes
- architecture merge
- dependency change
- migration completion

You MUST call:

```
cairn_observe({ summary, candidates })
```

Purpose: capture implicit cognition that was not explicitly signaled during complex work.

Extract candidates by reviewing the conversation since the last observe or session start. Each candidate gets a `recommendation` of `capture` (meaningful for future sessions) or `skip` (routine, already captured). If `staged > 0` in response, present to user before committing.

Skip for empty commits, merge commits, and typo-only amends.

---

## 5. Session Closure

When a technical task completes, you MUST call:

```
cairn_session_end({ summary, changed_domains?, decisions_made?, unresolved? })
```

A session is considered complete when:

- implementation finished
- architecture direction stabilized
- debugging completed
- migration checkpoint reached
- user changes topic

Skipping `session_end` means:

- git commits go unscanned
- decay does not run
- DNA candidates never emerge
- calibration misses drift
- the project's cognitive health degrades

This is not optional.

After calling, proactively report to the user when any of these are true:

- `dna_safety_valve.entered_reevaluation: true` — DNA paused
- `stage.changed: true && stage.transition_staged` — phase transition queued for review
- `decay.archived.length > 0` — old events archived
- `dna_compression.new_staged.length > 0` — DNA candidates need review

---

## 6. Recovery Before Resume

If Cairn indicates `previous_session_unclosed` or `session.recovery_required`:

You MUST recover before continuing long-running work.

```
cairn_session_recover()
```

This runs the full `session_end` pipeline (git scan, decay, calibration, stage inference, compression, views regeneration) for the stale session.

After recovery completes, call `cairn_context()` to start a fresh session.

---

# Tool Contracts

16 MCP tools across 6 lifecycle phases.

---

## cairn_context

**Purpose**: Load active cognition into reasoning. Session guard.

**Required Before**: technical recommendations, code generation, refactor strategy, architecture discussion.

```
cairn_context({ task?: string, files?: string[] })
```

**Returns**: stage, dna, constraints (no_go, accepted_debt, stage_constraints), relevant_domains, challenges, session status.

**Side Effects**: creates or updates `active_session` in `state.yaml`.

---

## cairn_plan

**Purpose**: Challenge architectural direction before implementation.

**Required Before**: framework introduction, infrastructure changes, migrations, abstraction increases.

**Precondition**: requires prior `cairn_context`. Will reject if context not loaded.

```
cairn_plan({ task: string })
```

**Returns**: stage guidance, DNA guidance, historical constraints, recommended direction, warnings, open questions.

**Side Effects**: none (read-only).

---

## cairn_signal

**Purpose**: Capture explicit cognition from conversation.

**Required When**: user rejects, constrains, decides, references history, accepts debt, or declares phase limits.

```
cairn_signal({
  signal_type: "user_rejection" | "historical_reference" | "constraint_declaration" | "decision" | "debt_acceptance" | "stage_constraint",
  domain?: string,
  details: {
    what: string,
    aliases?: string[],
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

**Returns**: accepted, routing (level, destination, governance), challenges.

**Side Effects**: routes through TrustRouter. May write to blood or staged.

---

## cairn_observe

**Purpose**: Capture implicit cognition from code evolution before commit.

**Required Before**: every git commit (except empty/merge/typo-only).

```
cairn_observe({
  summary: string,
  candidates: [{
    signal_type, domain?, details, evidence,
    recommendation: "capture" | "skip",
    recommendation_reason: string
  }]
})
```

**Returns**: total, captured, skipped, staged count, instructions.

**Side Effects**: routes captured candidates through TrustRouter.

---

## cairn_session_end

**Purpose**: Finalize cognitive lifecycle. Run maintenance pipeline.

**Required When**: task complete, direction stabilized, debugging finished, user changes topic.

```
cairn_session_end({
  summary: string,
  changed_domains?: string[],
  decisions_made?: string[],
  unresolved?: string[]
})
```

**Pipeline**: git scan -> decay -> calibration + safety valve -> stage inference -> compression -> views regeneration.

**Returns**: signals_processed, new_blood, new_staged, git_signals, decay, calibration, stage, dna_compression, dna_safety_valve.

**Side Effects**: extensive. May write to blood, staged, dna/staged, state.

---

## cairn_session_recover

**Purpose**: Recover interrupted cognition lifecycle.

**Required When**: `cairn_context` returns `session.recovery_required: true`.

```
cairn_session_recover()
```

**Pipeline**: runs full `session_end` pipeline for the stale session.

**Side Effects**: same as `cairn_session_end`.

---

## cairn_init_status

**Purpose**: Check initialization state.

```
cairn_init_status()
```

**Returns**: status, completed_steps, current_step, next_action, guide.

---

## cairn_init_commit

**Purpose**: Write initial cognition (config, skeleton, blood, stage, DNA).

```
cairn_init_commit({
  step: "config" | "skeleton" | "blood" | "dna" | "stage",
  dry_run?: boolean,
  ...step-specific fields
})
```

Step-by-step with `dry_run: true` preview before each write. Blood candidates auto-confirm during init. DNA traits are staged.

---

## cairn_stage_list

**Purpose**: List pending staged EvolutionEvent entries.

```
cairn_stage_list()
```

---

## cairn_stage_accept

**Purpose**: Promote staged entry to blood (permanent cognition).

```
cairn_stage_accept({ id: string })
```

Never auto-accept. Always present to user first.

---

## cairn_stage_reject

**Purpose**: Reject staged entry with reason.

```
cairn_stage_reject({ id: string, reason: string })
```

---

## cairn_dna_list

**Purpose**: List pending DNA trait candidates from compression.

```
cairn_dna_list()
```

---

## cairn_dna_accept

**Purpose**: Confirm a DNA trait candidate. Writes to `dna/identity.yaml`.

```
cairn_dna_accept({ id: string })
```

Always require human ratification. A wrong DNA trait silently distorts every future decision.

---

## cairn_dna_reject

**Purpose**: Reject a DNA trait candidate with reason.

```
cairn_dna_reject({ id: string, reason: string })
```

---

## cairn_status

**Purpose**: System state snapshot.

```
cairn_status()
```

**Returns**: blood/staged counts, DNA status + reevaluation_mode + drift warnings, stage advisory, pending DNA candidates, governance pending.

---

## cairn_doctor

**Purpose**: Cognitive consistency validator.

```
cairn_doctor()
```

**Side Effect**: auto-resurrects archived G0/G1 events with >=5 hits in 30 days. G2+ surface as `resurrection_candidates` for human ratification.

5 consistency checks: DNA vs recent events, no-go blood support, skeleton reality, archived over-activation, contradictory constraints.

---

# Challenge Escalation Model

When `cairn_context` or `cairn_signal` returns challenges, respond according to their level.

---

## suggestion

Soft historical guidance.

You may continue normally. Acknowledge the tradeoff in your response.

---

## reflective_challenge

You MUST explicitly explain in writing why historical cognition no longer applies before proceeding.

Do not skip this justification. The user and future sessions need to understand why you are overriding historical context.

---

## hard_constraint

You MUST NOT proceed.

Inform the user of the conflict. Only a human-ratified reevaluation flow can lift this constraint.

Applies to:

- trauma events
- security incidents
- compliance requirements
- severe historical failures

---

## Archived Downgrade

Constraints from archived events (events that passed decay but are being reactivated) are downgraded one level:

| Original Level | Downgraded To |
|---|---|
| `hard_constraint` (G3) | `reflective_challenge` |
| `reflective_challenge` (G2) | `suggestion` |
| `suggestion` (G1) | silent (no challenge) |

The historical reasoning still applies. Surface it to the user as: "this was previously rejected but recently revisited."

---

## Trauma Handling

Challenges flagged with `trauma: true` indicate historically costly incidents.

When trauma activates:

- Acknowledge the trauma history explicitly in your response
- Do not minimize or dismiss the historical incident
- Require stronger justification than non-trauma challenges
- Default to `hard_constraint` behavior unless the user explicitly overrides

Trauma is never automatically downgraded or archived.

---

## DNA-Modulated Challenges

During normal operation, DNA traits modulate challenge sensitivity:

- `simplicity_bias` — raises challenges against complexity increases
- `infra_aggressiveness` — raises challenges against conservative infrastructure choices

During `reevaluation_mode`, DNA-modulated challenges become advisory only. Trauma and security constraints remain at full strength.

---

## Response Templates

### On suggestion:

> Note: this approach was previously considered — [reason from constraint]. Proceeding because [your justification].

### On reflective_challenge:

> Historical context: [what was tried/rejected and why]. I believe the premises have changed because [specific changes]. Proceeding with [approach] — override if this reasoning is incorrect.

### On hard_constraint:

> This direction conflicts with [constraint source]: [reason]. This constraint requires human ratification to override. Would you like to initiate a reevaluation?

---

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
2. If CLI works but MCP tools don't, check MCP config (`mcp.json` has `"cairn": { "command": "cairn-mcp-server" }`).
3. If MCP server runs but tools return path errors, set `"env": { "CAIRN_ROOT": "/absolute/path" }` in MCP config.

---

# Reasoning Examples

Behavioral examples showing correct lifecycle execution. Each example shows the reasoning chain, not just the tool call.

---

## Example 1: User references historical failure

```
User: "We tried Kafka before and it caused operational pain. Let's not go there again."
```

Reasoning:
1. This is explicit long-term cognition — a historical reference with rejection intent.
2. Future sessions must know this to avoid re-suggesting Kafka.
3. Signal immediately.

```
cairn_signal({
  signal_type: "historical_reference",
  domain: "messaging",
  details: {
    what: "Kafka rejected due to operational complexity",
    aliases: ["kafka", "event streaming", "message queue"],
    reason: "Caused operational pain in previous attempt",
    rejected_alternatives: [{ path: "Kafka", reason: "operational complexity" }]
  },
  evidence: { user_said: "We tried Kafka before and it caused operational pain" }
})
```

Response: Acknowledge the history, confirm it's captured, suggest alternatives that avoid the same pain point.

---

## Example 2: User rejects a suggestion

```
Assistant: "We could use Redis for caching here."
User: "No — we don't want to add Redis as a dependency. Keep it in-process."
```

Reasoning:
1. The user rejected a specific technical direction with a clear constraint.
2. This is both a rejection and a constraint declaration.
3. Signal as user_rejection so future sessions know Redis is off the table.

```
cairn_signal({
  signal_type: "user_rejection",
  domain: "caching",
  details: {
    what: "Redis rejected as caching layer",
    aliases: ["redis", "external cache"],
    reason: "User wants to avoid adding Redis as a dependency",
    rejected_alternatives: [{ path: "Redis caching", reason: "unwanted dependency" }]
  },
  evidence: { user_said: "No — we don't want to add Redis as a dependency" }
})
```

---

## Example 3: Implicit constraint during discussion

```
User: "We're a two-person team, so anything that needs dedicated ops is out."
```

Reasoning:
1. This constrains future architecture decisions — not just this task.
2. It explains WHY certain paths are unavailable (team size, no ops capacity).
3. Signal as constraint_declaration.

```
cairn_signal({
  signal_type: "constraint_declaration",
  details: {
    what: "No infrastructure requiring dedicated operations",
    aliases: ["ops-heavy", "dedicated ops", "complex infra"],
    reason: "Two-person team, no ops capacity"
  },
  evidence: { user_said: "We're a two-person team, so anything that needs dedicated ops is out" }
})
```

---

## Example 4: Implicit cognition before commit

After a session implementing a new auth system, before committing:

Reasoning:
1. During implementation, several implicit decisions were made — choosing JWT over sessions, putting tokens in httpOnly cookies, adding refresh token rotation.
2. None of these were explicitly signaled during conversation.
3. Use observe to capture them before they disappear.

```
cairn_observe({
  summary: "Implemented JWT auth with httpOnly cookies and refresh token rotation",
  candidates: [
    {
      signal_type: "decision",
      domain: "auth",
      details: { what: "JWT over server sessions", reason: "Stateless scaling, team familiarity" },
      evidence: { files: ["src/auth/jwt.ts", "src/middleware/auth.ts"] },
      recommendation: "capture",
      recommendation_reason: "Architectural decision affecting all authenticated endpoints"
    },
    {
      signal_type: "decision",
      domain: "auth",
      details: { what: "Refresh token rotation enabled", reason: "Security best practice" },
      evidence: { files: ["src/auth/refresh.ts"] },
      recommendation: "capture",
      recommendation_reason: "Security decision that should not be silently reverted"
    },
    {
      signal_type: "decision",
      domain: "auth",
      details: { what: "Token stored in httpOnly cookie", reason: "XSS protection" },
      evidence: { files: ["src/auth/cookie.ts"] },
      recommendation: "skip",
      recommendation_reason: "Standard practice, not a project-specific decision"
    }
  ]
})
```

---

## Example 5: Trivial task — no Cairn needed

```
User: "Fix the typo in the error message on line 42 of utils.ts"
```

Reasoning:
1. Single-line typo fix. No architectural implication.
2. No future session would benefit from knowing about this.
3. Skip the entire Cairn lifecycle. Just fix the typo.

No Cairn tools called. Fix directly.

---

## Example 6: Context returns a challenge

```
cairn_context({ task: "Add microservice for payments" })
```

Response includes a `reflective_challenge` from a previous rejection of microservices.

Reasoning:
1. A reflective_challenge means: explain in writing why history no longer applies, or do not proceed.
2. Do NOT silently proceed. Do NOT ignore the challenge.
3. Present the historical context to the user and justify why premises may have changed.

Response:
> Historical context: Microservices were rejected 6 months ago due to team size (2 engineers) and operational complexity. The team has since grown to 6 engineers with dedicated DevOps. This may change the calculus. Should we revisit?

Only proceed after the user explicitly confirms.

---

# Claude Code Adapter

Platform-specific rules for Claude Code. The lifecycle protocol is defined in `protocol/core.md`.

## Platform Behavior

Claude Code obeys long structured instructions well. Use strong imperative language and explicit ordering.

- Follow the lifecycle from `core.md` during every technical session
- Do not skip steps silently — if a step is skipped, it must match a `minimal-intervention.md` exclusion
- Do not treat Cairn as optional memory

## Setup

Add to `.claude/mcp.json` (project) or `~/.claude/mcp.json` (global):

```json
{
  "mcpServers": {
    "cairn": { "command": "cairn-mcp-server" }
  }
}
```

For multi-project setups, pin the project root:

```json
{
  "mcpServers": {
    "cairn": {
      "command": "cairn-mcp-server",
      "env": { "CAIRN_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

Restart Claude Code after editing MCP config.

## Initialization

On first encounter with a project that has no `.cairn/`:

1. `cairn_init_status()` — check state
2. If `not_initialized` / `empty_scaffold` / `partial`: run step-by-step init
3. Steps (in order): config → skeleton → blood → dna → stage
4. For each step: analyze → `dry_run: true` preview → user confirms → commit → `cairn_init_status()` for next
5. For blood: cross-reference git history, code structure, team memory, AND project instructions (CLAUDE.md, ADRs)
6. Blood auto-confirms during init. DNA traits staged for human review.

## Degraded Mode

If MCP tools unavailable:

1. Read `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. These are auto-generated, read-only. Do not write to views.
3. Signal capture unavailable.

When `cairn_*` tools fail:

1. Ask user to run `cairn doctor` — if CLI errors, install is broken
2. If CLI works but MCP doesn't, check `.claude/mcp.json` config
3. If MCP runs but returns path errors, set `CAIRN_ROOT` in env
