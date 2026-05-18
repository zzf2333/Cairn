# Cairn — Codex / OpenAI

> `AGENTS.md` is the Codex CLI convention for project-level instructions (analogue of `CLAUDE.md`). Append the protocol block below to your project's `AGENTS.md`, or to `~/.codex/AGENTS.md` for global scope. Codex reads it on every session.

## Setup

**1. Install the MCP server**

```bash
npm install -g cairn-mcp-server
```

Requires Node.js 18+.

**2. Register the server with Codex**

Add to `~/.codex/config.toml` (global) or `.codex/config.toml` (project):

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
```

For multi-project setups, pin the project root:

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
env = { CAIRN_ROOT = "/absolute/path/to/your/project" }
```

**3. Verify the install**

```bash
cairn status            # CLI works → server binary OK
cairn doctor            # CLI consistency check → engines OK
```

Then in a Codex session ask: *"Call `cairn_init_status` and show the raw response."* If Codex returns a JSON object with `status` and `has_cairn_dir` fields, MCP wiring is live. If the call fails or Codex says the tool is unknown, recheck `config.toml` and restart the Codex CLI.

<!-- cairn:start -->
## Cairn (AI-maintained project memory)

If this project has `.cairn/` and the `cairn` MCP server is available, follow this protocol.

### 0. Initialization (first encounter)

Call `cairn_init_status()`. If `status: not_initialized`:

1. Analyze the project from **four sources**: git history, code structure, team memory/lessons, AND project instructions (CLAUDE.md, ADRs)
2. **First** call `cairn_init_commit({ dry_run: true, ... })` to preview routing
3. Present the dry-run report (auto-confirmed vs staged blood candidates, skeleton, DNA) to the user
4. After confirmation, call `cairn_init_commit({ ... })` (without `dry_run`) to write

### 1. Session start — cairn_context (session guard)

**Call `cairn_context({ task?, files? })` before every response**, regardless of task size. `cairn_context` is the session guard — it creates an active session, activates cognition, and detects stale sessions. Skip only if you already called it this turn with hot context.

If the response includes `session.recovery_required` (true), a previous session was not closed properly. Call `cairn_session_recover()` to close the stale session, then call `cairn_context()` again.

Respect every returned field for the remainder of the session:

| Field | Required behavior |
|---|---|
| `constraints.no_go` | Never suggest these directions |
| `constraints.accepted_debt` | Do not fix; work within |
| `constraints.stage_constraints` | Adjust aggressiveness to phase |
| `challenges[]` | Respond per level (see below) |
| `relevant_domains[].rejected_paths` | Treat as banned alternatives |

**Archived downgrade**: any `no_go` or `challenges` entry with `archived: true` is **one level weaker** (hard → reflective → suggestion → skip). These are old constraints with recent reactivation — relevant but no longer authoritative.

#### Challenge response (three levels)

| Level | Required action |
|---|---|
| `suggestion` | Acknowledge tradeoff, proceed |
| `reflective_challenge` | **Must** explain in writing why historical context no longer applies, then proceed |
| `hard_constraint` | **Do not proceed.** Surface conflict to user. Continue only on explicit reevaluation authorization |

#### Stage advisory

| `phase` | Bias |
|---|---|
| `exploration` | New deps OK, experiments OK, prioritize speed |
| `growth` | Balance speed and stability; new patterns need justification |
| `maturity` | New deps require strong justification; conservative changes |
| `maintenance` | Bug fixes and critical security only |

**Maintenance phase = `reflective_challenge` strength.** Treat any new feature plan, refactor, or migration as if the project had an explicit reflective_challenge against it. **Do not draft the migration / feature.** Surface the conflict to the user and require explicit override before proceeding.

#### Empty workspace handling

If `cairn_context` returns `interaction_hint`, follow it:

| Hint | Required behavior |
|---|---|
| `review_staged_first` | The cwd has no relevant source files but `.cairn/staged/` has pending entries. **Do not** reply "no source files here." Instead enumerate pending staged entries and ask the user to accept/reject. |
| `needs_init` | Project lacks `.cairn/`. **Do not** reply "wrong project." Treat this as an opportunity to bootstrap Cairn — analyze the repo and propose `cairn_init_commit({ dry_run: true })`. |

### 2. During work — cairn_signal

Call `cairn_signal()` when you detect one of these patterns:

| Conversation | signal_type |
|---|---|
| User rejects your suggestion with a reason | `user_rejection` |
| User references past attempt ("we tried X before") | `historical_reference` |
| User states a constraint ("we never use Redis") | `constraint_declaration` |
| A significant technical decision is made | `decision` |
| Technical debt explicitly accepted | `debt_acceptance` |
| User says "not in this phase" / "not now" | `stage_constraint` |

Pass `details.aliases` for subjects with synonyms (e.g. `what: "MongoDB"`, `aliases: ["document store", "nosql"]`) so the system catches synonym-based conflicts later.

**Do NOT signal**: routine bug fixes, formatting, vague statements, duplicates within session, implementation details.

If `challenges[]` returned by signal is non-empty, present the conflict to the user before continuing.

### 2.5. Before commit — cairn_observe

**Call `cairn_observe()` before every `git commit`.** This is a structural checkpoint that batch-captures signals that `cairn_signal` may have missed during complex work.

```
cairn_observe({
  summary: "what was done, key decisions",
  candidates: [{
    signal_type, domain?, details: { what, reason?, ... },
    evidence: { user_said?, ... },
    recommendation: "capture" | "skip",
    recommendation_reason: "why"
  }]
})
```

Extract candidates by reviewing the conversation since last observe/commit: rejections, decisions, constraints, accepted debt. Each gets `capture` (meaningful) or `skip` (routine). If `staged > 0` in response, present to user before committing. Skip for empty/merge/typo-only commits.

### 3. Planning — cairn_plan

Before architecture / technology / module-boundary decisions: `cairn_plan({ task })`. **Requires prior `cairn_context`** — will reject if context not loaded. Returns historical constraints, DNA guidance, recommended direction, warnings, open questions. Do not use for routine fixes.

### 4. Review queues

**Staged events** — `cairn_stage_list()` → present each → `cairn_stage_accept({ id })` or `cairn_stage_reject({ id, reason })`. Never auto-accept.

**DNA candidates** — `cairn_dna_list()` → present each with `trait_name`, `level`, `confidence`, `evidence_events`, `reasoning` → `cairn_dna_accept({ id })` or `cairn_dna_reject({ id, reason })`. **Always require human ratification — a wrong DNA trait silently distorts every future decision until removed.**

### 5. Session end — cairn_session_end

**Critical: not optional.** Skipping means git commits aren't scanned, decay doesn't run, DNA candidates never emerge, calibration misses drift. Call at end of every session.

```
cairn_session_end({
  summary: string,           // 1-3 sentences: what changed, key decisions, unresolved
  changed_domains?: string[],
  decisions_made?: string[],
  unresolved?: string[]
})
```

Good summary: *"Refactored auth to drop session-token storage per legal req. User rejected Redis sessions due to operational complexity. Open: verify JWT TTL meets audit window."*

Bad: *"Made some changes to auth."* (no specifics)

After calling, **proactively report to user** if any of these are true in the output:
- `dna_safety_valve.entered_reevaluation: true` — DNA paused; traits won't modulate routing
- `stage.changed: true && stage.transition_staged` — phase transition queued for review
- `decay.archived.length > 0` — N old events archived this session
- `dna_compression.new_staged.length > 0` — N DNA candidates need review

### 6. Diagnostics

- `cairn_status()` — system snapshot (counts, DNA mode, stage, drift warnings)
- `cairn_doctor()` — consistency check. **Side effect**: auto-resurrects archived G0/G1 events with ≥5 hits/30d. G2+ surface as candidates needing human ratification.

### Degraded mode (no MCP)

If the `cairn` MCP server is unreachable from Codex, fall back in this order:

1. **Read-only views** — `.cairn/views/output.md` (global constraints), `.cairn/views/domains/<name>.md` (per-domain), `.cairn/views/stage.md` (stage advisory). These are auto-generated from blood events and reflect the last known state.
2. **CLI for state inspection** — `cairn status`, `cairn doctor`, `cairn review`, `cairn dna list`, `cairn stage list`.
3. **CLI for review queues** — `cairn dna accept/reject <id>`, `cairn stage accept/reject <id>`, `cairn blood archive/resurrect <id>`.

Signal capture (`cairn_signal`) and session pipelines (`cairn_session_end`) are **unavailable** in degraded mode — restore MCP before relying on automatic memory updates.

### Reference protocol

The canonical, exhaustive protocol document (engine-level details, full schemas, all edge cases) lives at `skills/claude-code/SKILL.md`. The block above is sufficient for daily Codex use; consult the reference only when behavior diverges from what you expect.
<!-- cairn:end -->
