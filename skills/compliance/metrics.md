# Skill Compliance Metrics

These metrics measure whether the AI is following the Cairn cognitive lifecycle. They are observable from session records and `.cairn/state.yaml`.

---

## Context Compliance Rate

```
technical tasks with cairn_context
/
all technical tasks
```

Target: 100%. Any technical reasoning without prior `cairn_context` is a protocol violation.

Observable via: `state.yaml` session records (sessions with `context_loaded: true` vs total sessions).

---

## Plan Compliance Rate

```
architecture tasks with cairn_plan
/
all architecture tasks
```

Target: 100% in strict mode, 80%+ in balanced mode. Architecture tasks include framework introduction, infrastructure changes, migrations, and large refactors.

Observable via: session records and blood events with `source.type: plan`.

---

## Signal Capture Rate

```
explicit cognition captured via cairn_signal
/
explicit cognition observed in conversation
```

Target: 90%+ in strict mode, 70%+ in balanced mode. The gap accounts for borderline signals that reasonably could be skipped.

Observable via: comparing session summaries with signal counts.

---

## Session Closure Rate

```
sessions properly closed with cairn_session_end
/
sessions started with cairn_context
```

Target: 100%. Every started session must be closed. Unclosed sessions trigger recovery on next `cairn_context`.

Observable via: `state.yaml` — sessions with `ended_at: null` indicate failures.

---

## Recovery Compliance Rate

```
recoveries completed via cairn_session_recover
/
recoveries required (stale sessions detected)
```

Target: 100%. When `cairn_context` returns `recovery_required`, the AI must recover before proceeding.

Observable via: session records with `recovery_required` flag.

---

## Observe Compliance Rate

```
commits preceded by cairn_observe
/
total commits during active sessions
```

Target: 90%+ in strict mode, 50%+ in balanced mode. Empty/merge/typo commits are excluded.

Observable via: comparing git log with observe call records.
