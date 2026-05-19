# Cairn Cognitive Lifecycle Protocol

## Core Principle

Cairn is not passive memory.

Cairn only works if you actively call Cairn tools during reasoning.

You must follow the lifecycle below.

---

## 1. Context Before Technical Reasoning

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
