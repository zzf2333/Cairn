# Protocol

> Cairn is headless. The AI is what brings it to life. The protocol is the contract between them.

---

## The contract, in one paragraph

The Host AI agrees to call **`cairn_context` before every response**, **`cairn_signal` whenever the conversation produces a real cognitive event**, **`cairn_session_end` before the session closes**, and to **respect every constraint and challenge** returned by Cairn — to the strength of its level. In return, Cairn agrees to surface the right cognition at the right moment, to capture signals into durable form without bothering the user, and to keep the system honest via calibration and the safety valve.

That paragraph is the whole protocol. The rest is detail.

---

## The five tool-call moments

### Moment 1 — first encounter

Triggered by: a new repository, or a repository with no `.cairn/` yet, or a session that has just started.

```
cairn_init_status()
  ↓
if status == "not_initialized":
    1. analyze the project (README, deps, git log, source structure)
    2. call cairn_init_commit({ dry_run: true, config, skeleton, blood_candidates, ... })
    3. present the dry-run report to the user
    4. on confirmation, call cairn_init_commit(...) without dry_run
```

The dry-run is non-optional. AI proposals about project structure are fallible; the user gets to correct before any writes.

### Moment 2 — every response

Triggered by: literally every user prompt that asks for a change in code, design, or direction.

```
cairn_context({ task, files? })
```

The AI consumes the result before responding:

| Result field | What the AI does |
|--------------|------------------|
| `constraints.no_go[]` | Never propose these directions |
| `constraints.accepted_debt[]` | Do not fix; work within |
| `constraints.stage_constraints[]` | Adjust suggestion aggressiveness to phase |
| `challenges[]` | Respond per level (see below) |
| `relevant_domains[].rejected_paths[]` | Treat as banned alternatives |
| `dna.relevant_traits[]` | Modulate proposals toward the trait's direction |
| `dna.reevaluation_mode: true` | Give balanced recommendations; surface the pause status |
| `interaction_hint: "review_staged_first"` | Pivot to staged review before normal task work |
| `interaction_hint: "needs_init"` | Pivot to init flow before normal task work |

The AI is allowed to skip `cairn_context` only if it already called it this turn and the context is hot. For a fresh user turn, even on a small change, call it.

### Moment 3 — capturing a signal

Triggered by: the user's words in conversation reveal a cognitive event worth recording.

| Conversation pattern | `signal_type` |
|----------------------|---------------|
| User rejects a suggestion with a reason | `user_rejection` |
| User references a past attempt ("we tried X 6 months ago") | `historical_reference` |
| User states a constraint ("we never use Redis") | `constraint_declaration` |
| Significant technical decision | `decision` |
| Technical debt explicitly accepted | `debt_acceptance` |
| Stage-conditional rejection ("not now, we're focused on stability") | `stage_constraint` |

```
cairn_signal({
  signal_type,
  domain?,
  details: { what, aliases?, reason?, rejected_alternatives?, revisit_when? },
  evidence: { user_said?, files?, commit_ref? }
})
```

**Aliases are load-bearing.** When `details.what` is "MongoDB," `details.aliases: ["document store", "nosql"]` lets future signals about "document store DBs" dedup against this one. Without aliases, the system catches only literal-string matches.

**Do not signal:** routine bug fixes, formatting changes, vague statements, duplicates already captured this session, implementation details.

### Moment 4 — pre-design planning

Triggered by: architecture / technology / module-boundary decisions about to be made.

```
cairn_plan({ task })
```

Read-only. Returns historical constraints + DNA guidance + recommended direction + warnings + open questions. The AI uses it to anchor the design proposal in actual project history, not generic best-practice.

Don't use it for routine fixes. It's expensive (deeper retrieval) and adds friction.

### Moment 5 — session close

Triggered by: end of a coding session, before the AI sees no more turns from the user.

```
cairn_session_end({
  summary: "1-3 sentences: what changed, key decisions, unresolved",
  changed_domains?: ["api", "data"],
  decisions_made?: ["dropped session-token middleware"],
  unresolved?: ["verify JWT TTL meets compliance window"]
})
```

**Critical: not optional.** Skipping `cairn_session_end` means:

- Git commits since the last session don't get scanned (`GitEar` doesn't run)
- Decay doesn't run; stale events don't archive
- DNA candidates never emerge (`CompressionEngine` doesn't run)
- Calibration misses drift; safety valve doesn't trigger
- Views don't regenerate; degraded mode reads become stale

After calling, **proactively report to the user** if any of these are true in the output:

- `dna_safety_valve.entered_reevaluation: true` — DNA paused; surface it
- `stage.changed: true && stage.transition_staged` — phase transition queued for review
- `decay.archived.length > 0` — N events archived this session
- `dna_compression.new_staged.length > 0` — DNA candidates need ratification

---

## The three-level challenge

When `cairn_context` returns `challenges[]`, each entry has a `level` (`suggestion` / `reflective_challenge` / `hard_constraint`). The AI's required response:

| Level | What the AI must do |
|-------|---------------------|
| `suggestion` | Acknowledge the tradeoff in the response, proceed if justified |
| `reflective_challenge` | **Must** explain in writing why the historical context no longer applies, *then* proceed (or stop) |
| `hard_constraint` | **Do not proceed.** Surface the conflict. Wait for explicit user override |

Trauma-flagged challenges (`trauma: true`) get extra weight regardless of level. The AI acknowledges the trauma explicitly: "this was a real incident, here's the constraint that came out of it."

Archived-flagged challenges (`archived: true`) get *downgraded* one level (`hard_constraint` → `reflective_challenge`, `reflective_challenge` → `suggestion`, `suggestion` → skip). These come from stale events still being reactivated — the constraint matters but isn't authoritative.

---

## Stage advisory

`cairn_context.stage.phase` tells the AI what life-stage the project is in. The AI adjusts aggressiveness accordingly:

| Phase | AI bias |
|-------|---------|
| `exploration` | New deps OK, experiments OK, prioritize speed |
| `growth` | Balance speed and stability; new patterns need justification |
| `maturity` | New deps need strong justification; conservative changes |
| `maintenance` | Bug fixes + critical security only — treated as `reflective_challenge` strength against new features |

`maintenance` is the one stage that gets special treatment: it has reflective_challenge strength built in. Any proposal for a new feature, refactor, or migration must be surfaced to the user as a conflict before drafting.

---

## The review queues

Two separate channels, both human-ratified:

**Evolution Event staged.**
```
cairn_stage_list()
  → present each staged entry to the user
  → on each, the user says accept / reject
  → cairn_stage_accept({ id })   or   cairn_stage_reject({ id, reason })
```

**DNA trait candidates.**
```
cairn_dna_list()
  → present each candidate with trait_name, level, confidence, evidence_count, reasoning
  → on each, the user says accept / reject
  → cairn_dna_accept({ id })   or   cairn_dna_reject({ id, reason })
```

**Never auto-accept.** Especially for DNA. A wrong trait silently distorts every future decision until removed. The user's explicit ratification is the only safe path.

---

## What "the AI follows the protocol" actually means

It means the AI internalizes the protocol as part of its session context — installed as a native skill (`npx skills add zzf2333/Cairn` for Claude Code) or manually appended (`cairn skill show codex >> AGENTS.md` for Codex).

The skill file is the contract. The CLI runtime is the delivery mechanism. Together they make Cairn behave like a colleague who's been on this project for two years instead of like a model that read the codebase three minutes ago.

---

## See also

- [`enter.md`](./enter.md) — install and configure
- [`tend.md`](./tend.md) — keep the system healthy
- [`../ii-anatomy/`](../ii-anatomy/) — what's under each tool call
- [`../iv-self/trust-router.md`](../iv-self/trust-router.md) — what happens to a `cairn_signal` after the AI calls it
