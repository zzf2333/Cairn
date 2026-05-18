# Cairn V3 — Cognitive Heartbeat Protocol

Cairn is an AI-native engineering cognition engine. `.cairn/` stores
structured project memory — decisions, rejections, trade-offs, trauma —
that constrains your suggestions and prevents repeated mistakes.

You interact with Cairn exclusively through **16 MCP tools**. Never read
or write `.cairn/` files directly (except `views/` in degraded mode).

| Tool | Purpose |
|---|---|
| `cairn_init_status` | Check initialization state |
| `cairn_init_commit` | Write initial cognition (config, skeleton, blood, stage, DNA) |
| `cairn_context` | Session guard + activate constraints before any task |
| `cairn_signal` | Capture real-time constraint signals |
| `cairn_observe` | Pre-commit checkpoint: batch-extract and route candidate signals |
| `cairn_plan` | Get history-aware planning guidance (requires prior `cairn_context`) |
| `cairn_session_end` | Close session, run automated maintenance pipeline |
| `cairn_session_recover` | Close a stale/crashed session by running session_end pipeline |
| `cairn_stage_list` | List staged EvolutionEvent entries pending review |
| `cairn_stage_accept` | Promote staged entry to blood (and apply stage_transition to state if applicable) |
| `cairn_stage_reject` | Reject staged entry with reason |
| `cairn_status` | System state summary |
| `cairn_doctor` | Cognitive consistency validator (has side effects: auto-resurrects G0/G1 archived events with high reactivation) |
| `cairn_dna_list` | List pending DNA trait candidates from compression |
| `cairn_dna_accept` | Confirm a DNA trait candidate (writes identity.yaml) |
| `cairn_dna_reject` | Reject a DNA trait candidate with reason |

---

## 0. INITIALIZATION

On first encounter with a project, check whether Cairn is initialized:

```
cairn_init_status()
→ { status, completed_steps, current_step, next_action, guide }
```

> **Optional pre-step** — the user may have run `cairn init` (CLI) ahead of time to
> commit an empty `.cairn/` scaffold (useful in CI or team setups). That changes
> `has_cairn_dir` to `true` but leaves `status: "empty_scaffold"`. Treat
> `"empty_scaffold"` exactly like `"not_initialized"` — proceed with AI-native
> initialization below; `cairn_init_commit` will populate the existing scaffold.

If `status` is `"not_initialized"`, `"empty_scaffold"`, or `"partial"`, perform
**step-by-step AI-native initialization**. There are 5 steps, executed in order.
The `guide` field in the response provides focused analysis tips and schema
references for the current step.

### Step 1 — Config

Analyze the project to determine name, domain boundaries, and cognitive mode.

```
cairn_init_commit({
  step: "config",
  config: { project_name, domains, cognitive_mode, tech_stack? }
})
```

Present the result to the user — confirm project name, domains, and mode.

### Step 2 — Skeleton

Map each domain to its owned paths, causal keywords, and dependencies.

```
cairn_init_commit({
  step: "skeleton",
  skeleton: [{ domain, role, owns, does_not_own, causal_keywords, dependencies? }]
})
```

### Step 3 — Blood

Capture key architectural decisions, rejections, and constraints as evolution
events. **Cross-reference all four sources** before drafting candidates:

1. **Git history** — `git log`, reverts, dependency changes, major transitions
2. **Code structure** — architecture constants, schema invariants, CI config
3. **Team memory** — user auto-memory files, lessons-learned docs, incident records
4. **Project instructions** — CLAUDE.md, .cursorrules, README philosophy, ADRs

Sources 3–4 often contain trauma and constraints invisible in git — prioritize
them for rejection and trauma events. **Use `dry_run: true` first** to preview gravity assignments:

```
cairn_init_commit({
  step: "blood",
  blood_candidates: [...],
  dry_run: true
})
```

Present the preview to the user. After confirmation, write:

```
cairn_init_commit({
  step: "blood",
  blood_candidates: [...]
})
```

All candidates **auto-confirm to blood** during init — no staging, no
double-review. The user is already reviewing them in this step.

Completing the blood step marks initialization as **complete**.

### Step 4 — DNA (optional)

If the project shows clear personality patterns, capture them:

```
cairn_init_commit({
  step: "dna",
  dna: { traits: [{ name, level, confidence, reasoning }] }
})
```

Only two traits currently influence routing: `simplicity_bias` and
`infra_aggressiveness`. Skip if insufficient evidence — traits can emerge
later via compression.

### Step 5 — Stage (optional)

Assess the project lifecycle phase:

```
cairn_init_commit({
  step: "stage",
  stage: { phase, confidence, evidence }
})
```

Stage can also be inferred automatically by `cairn_session_end` if not set here.

### Blood candidate schema

```
blood_candidates: [{
  type, domain, gravity: { level },
  summary, behavior_effect: { type, instruction },
  source: { type, confidence },
  lifecycle: { validity },
  rejected_paths?, revisit?, trauma?
}]
```

### Legacy batch init

You can still call `cairn_init_commit` without `step` to write everything at
once (backward compat). In legacy mode, blood candidates pass through the
Trust Router and G2+ items enter `staged/` for human ratification.

---

## 1. SESSION START — cairn_context (session guard)

**Call once at the start of every new session**, before responding to the
user's first substantive message. `cairn_context` is the session guard —
it creates an active session, activates cognition, and detects stale sessions.
Within the same session, calling again is safe (it touches the existing session).

Pass the current task and/or files if known:

```
cairn_context({ task?: string, files?: string[] })
```

Returns:

```json
{
  "stage": { "phase", "confidence", "status", "guidance" },
  "dna": { "relevant_traits": [{ "name", "level", "implication" }] },
  "constraints": {
    "no_go": [{ "what", "reason", "gravity", "source_event", "archived?": boolean }],
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
    "required_response?", "trauma?", "archived?": boolean
  }],
  "meta": { "skeleton_nodes_activated", "blood_events_scanned", "context_token_estimate" },
  "session": { "id", "status": "active", "recovered_from": null | { "id", "started_at", "signals_count" } }
}
```

**If `session.recovered_from` is not null**, a previous session was interrupted.
Call `cairn_session_recover()` before starting long-running work.

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

## 2.5. PRE-COMMIT — cairn_observe

**Call before every `git commit`.** This is the structural checkpoint that
captures decisions, rejections, and constraints that real-time `cairn_signal`
may have missed during complex work.

```
cairn_observe({
  summary: "1-3 sentences: what was done, key decisions",
  candidates: [{
    signal_type: "user_rejection" | "decision" | "constraint_declaration" | ...,
    domain?: "domain-name",
    details: { what, aliases?, reason?, rejected_alternatives?, revisit_when? },
    evidence: { user_said?, files?, commit_ref? },
    recommendation: "capture" | "skip",
    recommendation_reason: "why this candidate matters or doesn't"
  }]
})
```

### How to extract candidates

Review the conversation since the last `cairn_observe` or session start:

| Pattern | signal_type |
|---------|-------------|
| User rejected a suggestion with reasons | `user_rejection` |
| A significant technical decision was made | `decision` |
| User stated a constraint ("never", "always", "we don't") | `constraint_declaration` |
| Technical debt explicitly accepted | `debt_acceptance` |
| User referenced past attempts | `historical_reference` |
| Phase/timing constraint mentioned | `stage_constraint` |

For each, recommend `capture` (meaningful for future sessions) or `skip`
(routine, already captured, or not constraint-relevant).

### Response handling

- If `staged > 0`: present staged candidates to the user before committing
- If `instruction` says safe to proceed: commit immediately
- The user can override any recommendation via `cairn_stage_reject`

### When NOT to call

- Empty commits, merge commits with no conversation context
- Amend commits that only fix typos or formatting

---

## 3. PLANNING — cairn_plan

**Requires prior `cairn_context`** — will reject if context not loaded.

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

### 4.1 DNA Candidates Review

When `cairn_context` returns a non-empty DNA candidates list, or
`views/output.md` shows a `## DNA Candidates` section, treat it the same
way as staged entries:

1. `cairn_dna_list()` — fetch pending candidates
2. For each, present to the user with:
   - `trait_name` (one of the system-recognized traits — currently
     `simplicity_bias`, `infra_aggressiveness`)
   - `level`, `confidence`, count of supporting events, `reasoning`
3. Per user decision:
   - `cairn_dna_accept({ id })` — writes to `dna/identity.yaml`; the trait
     starts modulating routing, challenges, and gravity
   - `cairn_dna_reject({ id, reason })` — discards candidate, records audit

DNA candidates always require human ratification — never auto-accept. A
wrong DNA trait will silently distort every future decision until removed.

#### DNA reevaluation mode

When `cairn_status()` returns `dna.reevaluation_mode: true` (set
automatically by the safety valve when ≥2 traits accumulate drift
warnings with confidence <0.7, or manually via `cairn dna reevaluate`),
**all accepted DNA traits temporarily stop modulating** routing,
challenges, and gravity. Cairn behaves as if DNA were empty until the
user reviews drift warnings and runs `cairn dna reevaluate` to disable
the mode. If the user asks why a previously trait-driven challenge no
longer fires, point them at `cairn dna show` (drift warnings) and
`cairn doctor` (drift signals).

---

## 5. SESSION END — cairn_session_end

**Critical: not optional.** Skipping `session_end` means git commits aren't
scanned, decay doesn't run, DNA candidates never emerge, calibration misses
drift. Call at the end of every session.

```
cairn_session_end({
  summary: string,          // 1-3 sentences: what changed, decisions, unresolved
  changed_domains?: string[],
  decisions_made?: string[],
  unresolved?: string[]
})
```

### Summary guidance

**Good summary** (1-3 sentences mentioning what changed, key decisions, open questions):

> *"Refactored auth middleware to drop session-token storage per legal req.
> User rejected Redis-backed sessions due to operational complexity.
> Open: need to verify JWT TTL meets compliance audit window."*

**Bad summary** (no specifics, no decisions, no open items):

> *"Made some changes to auth."*

### Pipeline (in order)

1. **GitEar scan** of commits since last session — auto-routes revert /
   dependency removed / dependency replaced / large refactor signals
   through TrustRouter into blood or staged
2. **Decay check** — mark_stale, downgrade (per `decay_policy`), or
   archive events that passed their `review_after`
3. **CalibrationEar** — produces 4 calibration signal types
   (no-go vs deps, skeleton drift, debt resolution, DNA drift)
4. **Auto safety valve** — drift_warnings reduce trait confidence by
   ×0.9; ≥2 warnings with confidence <0.7 auto-flip `reevaluation_mode`
5. **Stage inference** — runs StageEngine on git stats. If phase
   changed + confidence ≥0.6 + last_updated ≥14 days, emits a
   `stage_transition` event to staged for human review
6. **Compression** — runs CompressionEngine; if a known trait
   (`simplicity_bias` / `infra_aggressiveness`) emerges, candidate goes
   to DNA staged channel
7. **Views regeneration** + session record

### Output

```json
{
  "signals_processed", "new_blood", "new_staged", "views_regenerated", "pending_review",
  "git_signals": { "scanned", "new_blood", "new_staged", "dropped" },
  "decay": {
    "events_processed",
    "archived": [{ "id", "reason" }],
    "downgraded": [{ "id", "from", "to" }]
  },
  "calibration": {
    "signals_detected",
    "by_type": { "calibration_conflict": N, "skeleton_drift": N, ... }
  },
  "stage": { "phase", "confidence", "changed", "transition_staged" },
  "dna_compression": { "candidates_detected", "new_staged": [...] },
  "dna_safety_valve": { "triggered_traits", "confidence_reduced", "entered_reevaluation" }
}
```

### Required follow-up

After `session_end`, **proactively report to the user** when any of these are true:

- `dna_safety_valve.entered_reevaluation: true` — DNA paused; traits won't modulate routing until reviewed
- `stage.changed: true && stage.transition_staged` — phase transition queued; needs `cairn_stage_accept/reject`
- `decay.archived.length > 0` — N old events archived this session
- `dna_compression.new_staged.length > 0` — N DNA trait candidates need review via `cairn_dna_list`

---

## 6. DIAGNOSTICS

- `cairn_status()` — blood/staged counts, DNA status + reevaluation_mode +
  drift warnings, stage advisory + last_updated, pending DNA candidates,
  governance pending
- `cairn_doctor()` — 5 consistency rules + auto-resurrection:
  1. DNA vs recent event consistency
  2. No-go entries have blood support
  3. Skeleton nodes match reality
  4. Archived events not over-activated
  5. No contradictory constraints in same domain
  **Side effect**: archived events with `governance="system_validated"`
  (G0/G1, ≥5 hits in 30 days) are auto-resurrected; G2+ surface as
  `resurrection_candidates` for human ratification.

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

**Maintenance phase has `reflective_challenge` strength.** Any new feature plan, refactor, or migration must be surfaced to the user as a conflict before drafting — do not silently produce the implementation. Continue only on explicit override.

If `confidence < 0.5`, treat stage guidance as informational only.

### Empty workspace handling

If `cairn_context` returns `interaction_hint`, the workspace is unusual. Respond per hint:

| Hint | Behavior |
|---|---|
| `review_staged_first` | The cwd has no relevant source files but `.cairn/staged/` has pending entries. Do not reply "no source files." Enumerate the staged entries and ask the user to accept/reject. |
| `needs_init` | Project lacks `.cairn/`. Do not reply "wrong project." Analyze the repo and propose `cairn_init_commit({ dry_run: true })`. |

### challenges — Three-Level Intervention

| Level | Your Response |
|---|---|
| `suggestion` | Note the conflict; you may proceed if justified |
| `reflective_challenge` | You **must** explain why historical premises no longer apply before proceeding |
| `hard_constraint` | **Do not proceed.** Inform the user. Only a `reevaluation` flow (human-ratified) can lift this |

Trauma-flagged challenges (`trauma: true`) indicate historical incidents.
Treat these with extra caution — acknowledge the trauma history explicitly.

Archived-flagged constraints / challenges (`archived: true`) come from
stale events that are still being reactivated (≥5 hits in 30 days). The
constraint is downgraded one level (G3→reflective, G2→suggestion,
G1→silent), but the historical reasoning still applies — surface it to
the user as "this was previously rejected but recently revisited".

---

## DEGRADED MODE (NO MCP)

If MCP tools are unavailable, fall back to reading `.cairn/views/` directly:

1. `.cairn/views/output.md` — global constraints (no-go, stack, debt, stage)
2. `.cairn/views/domains/<name>.md` — per-domain context
3. `.cairn/views/stage.md` — stage advisory

`views/` is auto-generated and read-only. **Do not write to views/.**
Signal capture is unavailable in degraded mode.

### Diagnosing MCP transport issues

When `cairn_*` tools fail or return "unknown tool", walk this 3-step
ladder before falling back to degraded mode:

1. **Is the CLI working?** Ask the user to run `cairn doctor`. If the
   CLI errors out, the install itself is broken — point them at
   `npm install -g cairn-mcp-server` and Node 18+.
2. **Is the MCP config correct?** If CLI works but MCP tools don't,
   the issue is the Claude Code ↔ MCP server connection. Check
   `~/.claude/mcp.json` or `.claude/mcp.json` has `"cairn": { "command": "cairn-mcp-server" }`.
   Restart Claude Code after editing.
3. **Is `.cairn/` reachable?** If MCP server runs but tools return
   path errors, the server may not have located `.cairn/`. Either run
   the command from the project root, or set
   `"env": { "CAIRN_ROOT": "/absolute/path" }` in the MCP config.

While diagnosing, the user can still read `.cairn/views/output.md`
directly — that bypasses MCP entirely.

---

## LANGUAGE CONTINUITY

When reporting signals via `cairn_signal()`:

- **Match the language** of the project's existing memory content. Detect
  from `cairn_context()` output or `views/output.md`.
- Signal details (`what`, `reason`) follow the project's language.
- Field names, signal types, and tool parameters always stay English.
