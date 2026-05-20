# Cairn Runtime Core

## Activation Boundary

This protocol governs all technical reasoning: architecture, code generation, refactoring, dependency selection, debugging strategy, infrastructure, security.

It does NOT activate for: trivial formatting, typo fixes, pure explanation, non-technical conversation. See `minimal-intervention.md` for the full exclusion list.

## Lifecycle

### 1. Load constraints before reasoning

Active cognition must precede technical reasoning. No reasoning without historical awareness.

→ `cairn_context({ task?, files? })`

If recovery is indicated, resolve it first: `cairn_session_recover()` then `cairn_context()` again.

Respect ALL returned constraints for the entire session. Constraints are runtime state, not suggestions.

### 2. Challenge direction before architecture

Historical cognition must validate architectural direction before implementation begins.

→ `cairn_plan({ task })`

Required before: framework introduction, module boundary changes, migrations, infrastructure changes, large refactors.

### 3. Capture explicit cognition immediately

Long-term cognition expressed by the user — rejections, constraints, decisions, historical references, accepted debt — must never be silently acknowledged.

→ `cairn_signal({ signal_type, details, evidence })`

If the user says something that future sessions need to know, signal it now. If it's routine implementation detail, don't.

### 4. Capture implicit cognition before commit

Complex work generates decisions that were never explicitly stated. Extract them before they disappear.

→ `cairn_observe({ summary, candidates })`

Required before: git commit, architecture merge, dependency change. Not needed for whitespace-only or docs-only commits.

### 5. Close the cognitive lifecycle

Every technical session must close. Skipping breaks decay, DNA emergence, calibration, and git scanning.

→ `cairn_session_end({ summary, changed_domains?, decisions_made?, unresolved? })`

### 6. Recover before resuming

If Cairn indicates an unclosed previous session, recover it before starting new work.

→ `cairn_session_recover()`
