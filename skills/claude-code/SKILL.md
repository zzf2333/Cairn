# Cairn — Cognitive Runtime Protocol

Cairn stores project decisions, rejections, and constraints in `.cairn/`. You interact through MCP tools only. Never read/write `.cairn/` directly (except `views/` in degraded mode).

---

## Activation Boundary

This protocol governs all technical reasoning: architecture, code generation, refactoring, dependency selection, debugging strategy, infrastructure, security.

Does NOT activate for: trivial formatting, typo fixes, pure explanation, non-technical conversation, one-line config with no architectural implication.

---

## Lifecycle

### 1. Load constraints before reasoning

Active cognition must precede technical reasoning. No reasoning without historical awareness.

→ `cairn_context({ task?, files? })`

If `session.recovery_required`: call `cairn_session_recover()` first, then `cairn_context()` again.

Respect ALL returned constraints for the entire session — they are runtime state, not suggestions.

### 2. Challenge direction before architecture

Historical cognition must validate architectural direction before implementation begins.

→ `cairn_plan({ task })`

Required before: framework introduction, module boundary changes, migrations, infrastructure changes, large refactors. Not needed for local bug fixes or single-file changes.

### 3. Capture explicit cognition immediately

Long-term cognition expressed by the user — rejections, constraints, decisions, historical references, accepted debt — must never be silently acknowledged. If future sessions need to know it, signal it now.

→ `cairn_signal({ signal_type, domain?, details, evidence })`

Do NOT signal: routine fixes, vague statements, duplicates of existing signals, implementation details.

### 4. Capture implicit cognition before commit

Complex work generates decisions never explicitly stated. Extract them before they disappear into git history.

→ `cairn_observe({ summary, candidates })`

Skip for: whitespace-only, docs-only typo, merge commits without manual resolution.

### 5. Close the cognitive lifecycle

Every technical session must close. Skipping breaks decay, DNA emergence, calibration, and git scanning.

→ `cairn_session_end({ summary, changed_domains?, decisions_made?, unresolved? })`

After calling, report to user when: `dna_safety_valve.entered_reevaluation`, `stage.changed`, `decay.archived.length > 0`, or `dna_compression.new_staged.length > 0`.

### 6. Recover before resuming

If Cairn indicates an unclosed previous session, recover it before starting new work.

→ `cairn_session_recover()`

---

## Constraint Rules

Apply from `cairn_context()` output for the entire session:

| Constraint | Behavior |
|---|---|
| `no_go` | Never suggest. If user asks directly, explain history first. |
| `accepted_debt` | Do not fix. Work within. Reopen only when `revisit_when` met. |
| `stage_constraints` | Adjust aggressiveness to phase (exploration→permissive, maintenance→conservative). |
| `challenges: suggestion` | Note conflict; may proceed if justified. |
| `challenges: reflective_challenge` | MUST explain in writing why history no longer applies before proceeding. |
| `challenges: hard_constraint` | Do NOT proceed. Inform user. Only human-ratified reevaluation can lift. |
| `challenges: trauma` | Acknowledge history explicitly. Extra caution required. |
| `challenges: archived` | Downgraded one level, but surface historical reasoning. |

---

## Initialization

If `cairn_init_status()` returns `not_initialized` / `empty_scaffold` / `partial`, or `cairn_context` returns `interaction_hint=needs_init`:

Steps (in order): config → skeleton → blood → dna → stage.
For each: analyze → `dry_run: true` preview → user confirms → commit → check next.
Blood auto-confirms during init. DNA traits are staged for human review.

---

## Review Queues

Two channels, both require human ratification — never auto-accept:

- **Staged events**: `cairn_stage_list()` → present → `cairn_stage_accept/reject` per user decision.
- **DNA candidates**: `cairn_dna_list()` → present → `cairn_dna_accept/reject` per user decision. A wrong DNA trait silently distorts every future decision.

---

## Diagnostics

- `cairn_status()` — system state snapshot.
- `cairn_doctor()` — consistency validation. Side effect: auto-resurrects archived G0/G1 events with high reactivation.

---

## Degraded Mode (No MCP)

If MCP tools unavailable, read `.cairn/views/` directly:
1. `views/output.md` — global constraints
2. `views/domains/<name>.md` — per-domain
3. `views/stage.md` — stage advisory

Signal capture unavailable in degraded mode. Do not write to views.

---

## Language Continuity

Signal details (`what`, `reason`) follow the project's existing language. Field names, signal types, tool parameters always stay English.
