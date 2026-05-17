# Glossary

Terms used across Cairn docs and source. Listed in order of conceptual dependency.

---

## Project as cognition

### Cognitive organism

A software project, modeled not as a static codebase but as a path-dependent living system whose history shapes its present and future. Every reject, every "we tried that," every accepted debt is part of the organism.

### Path dependence

The property that a project's current state cannot be derived purely from current code — it requires the history of decisions, especially the rejected ones, to be understood.

### Cognitive thermodynamics

Cairn's framing: cognition decays without effort (entropy ↑), and Cairn is the active maintenance layer that pumps energy back in via decay → resurrection → calibration → compression cycles.

---

## The six subsystems

### Skeleton

The domain ownership map. Per-domain YAML files in `.cairn/skeleton/` declaring which domain owns which capabilities and which files. The structural backbone — relatively stable.

### Capillaries

Per-domain constraint detail. `.cairn/domains/<domain>/{constraints,accepted_debt,rejected_paths}.yaml`. Auto-synced from Blood events affecting that domain.

### Blood

Evolution events — the stream of confirmed cognitive history. `.cairn/blood/<id>.yaml`. Each event is a 40-field record (gravity, source, subject, behavior_effect, trauma, lifecycle, etc.). Append-only in spirit; archival via `health.state = stale` rather than deletion.

### DNA

Emergent project personality. `.cairn/dna/identity.yaml`. Traits like `simplicity_bias` and `infra_aggressiveness` are compressed from repeated Blood patterns (≥ 3 events, ≥ 3 months, confidence ≥ 0.6). Each trait must be human-ratified.

### Gravity

The decision weight axis, four levels:
- **G0** — noise; dropped on capture
- **G1** — local detail; auto-confirmed
- **G2** — module-scoped decision; staged for review under standard / institutional modes
- **G3** — project-defining constraint; always staged

### Governance

The approval flow. Every signal passes through a 3-tier ladder:
- `agent_proposed` — AI raised it
- `system_validated` — TrustRouter routed it (deduped, gravity-adjusted, trauma-checked)
- `human_ratified` — user accepted into Blood

Required ratification level depends on `cognitive_mode` (see below).

---

## Mechanisms

### Signal

A raw observation: git commit pattern, conversation turn, calibration check finding. Lives in `.cairn/signals/` (currently transient — directories preserved for future use). Becomes an Evolution Event after TrustRouter processing.

### TrustRouter

The central routing engine. Every signal passes through it. Applies: duplicate check → governance rules → trauma escalation → DNA trait modulation → gravity adjustment → destination (`blood` / `staged` / `dropped`).

### Evolution Event

The canonical record of a decision, rejection, debt acceptance, or constraint. Lives in `.cairn/blood/`. Has 40 fields covering origin, intent, behavioral effect, lifecycle, trauma status.

### Trauma

A flag on certain Blood events (`trauma.is_trauma: true`) marking them as scar tissue from real incidents (e.g. "MongoDB caused data loss"). Trauma events:
- Never decay
- Raise per-domain challenge sensitivity (`sensitivity_multiplier`)
- Always enter staged review (never auto-confirmed)
- Surface in `cairn_context` with elevated weight

### Reevaluation mode

A safety valve on DNA. When calibration detects severe DNA-vs-recent-signals drift, `dna.identity.reevaluation_mode` flips to `true` and all traits temporarily stop modulating routing. Cleared by `cairn dna reevaluate` after human review.

### Decay

The forgetting process. Events past the cognitive-mode-specific window are marked `stale` (archived) or `downgraded` one gravity level. Trauma events never decay.

### Resurrection

The reverse of decay. An archived event with ≥ 5 hits in 30 days (`recent_hits` in `state.activation_log`) is a candidate. G0 / G1 auto-resurrect via `cairn doctor`; G2+ require human review.

### Compression

DNA emergence. `CompressionEngine` watches Blood for repeated patterns and proposes DNA trait candidates. Candidates go to `.cairn/dna/staged/` and require human ratification before becoming part of `identity.yaml`.

### Calibration

The reality check. `CalibrationEar` scans code + git + Blood for inconsistencies. Emits four signal types: `no_go_violation`, `skeleton_drift`, `debt_resolution`, `dna_drift`. The `dna_drift` channel feeds the safety valve.

### Activation

Causal retrieval. `cairn_context` takes a task → matches skeleton nodes by keywords → expands to domain capillaries → traverses related Blood events → optionally surfaces archived events with recent reactivation → returns a structured context bundle.

### Challenge

Cairn's pushback mechanism. Returned by `cairn_context` and `cairn_signal`. Three levels:
- **suggestion** — acknowledge tradeoff, may proceed
- **reflective_challenge** — must justify in writing why history no longer applies
- **hard_constraint** — do not proceed; require explicit reevaluation

---

## Modes & strictness

### Cognitive mode

Per-project knob in `config.yaml`. Controls governance strictness, decay timing, and challenge thresholds:

| Mode | Governance threshold | Decay window | DNA min evidence |
|------|----------------------|--------------|------------------|
| `lightweight` | G3 only needs approval | 30 / 60 days | 5 |
| `standard` | G2+ needs approval | 90 / 120 days | 3 |
| `institutional` | G1+ needs approval | 180 / 240 days | 3 |

Choose based on how much cognitive overhead you want, not project size. A small project can be institutional; a large project can be lightweight.

### Stage

The project's current phase. Inferred by `StageEngine` from git commit cadence:
- `exploration` — new deps OK, prioritize speed
- `growth` — balance speed and stability
- `maturity` — conservative changes, strong justification
- `maintenance` — bug fixes + critical security only (treated as `reflective_challenge` strength)

---

## Artifacts on disk

### `.cairn/`

The cognition directory. YAML files, git-tracked by design. Layout:

```
.cairn/
├── config.yaml, state.yaml
├── skeleton/, blood/, staged/, domains/
├── dna/{identity.yaml, imprint.yaml, staged/}
├── signals/{raw_git, raw_calibration, raw_conversation}/
├── governance/{policy, audit}.yaml
├── views/{output.md, stage.md, domains/}
├── sessions/
└── logs/                ← 0.4.0+, daily-rotated tool-call jsonl
```

### Views

Auto-generated markdown projections at `.cairn/views/`. Consumed by AI tools that can't speak MCP (degraded mode). Never hand-edit — they regenerate on every `cairn_session_end` or `cairn doctor`.

### Imprint

DNA inheritance from a forked project (`.cairn/dna/imprint.yaml`). Carries `inherited_constraints` + `inherited_warnings` so a child project starts aware of the parent's scars.

---

## Compared to neighbors

| Concept | Closest analog | Cairn difference |
|---------|----------------|------------------|
| Evolution Event | ADR / RFC | Active (read by AI in real time) vs passive (human reads when they remember) |
| Skeleton | Module READMEs | Causal index, machine-readable, used for context activation |
| DNA | Engineering principles doc | Emerged from evidence + revocable, not declared by fiat |
| Trauma | Postmortem | First-class on-disk record that raises future challenge strength |
| Stage | Project phase tag | Auto-inferred from commit cadence; influences AI tone |

---

## Acronyms

- **ADR** — Architecture Decision Record
- **MCP** — Model Context Protocol (the spec Cairn implements)
- **G0–G3** — Gravity levels (see above)
- **SLO** — Service-level objective (used in `docs/PERFORMANCE.md`)
