# Architecture

> How the philosophy becomes a running system. For the "why," see [`PHILOSOPHY.md`](./PHILOSOPHY.md).

---

## One diagram

![Three-layer architecture](./diagrams/02-three-layer-architecture.png)

```
Host AI (Claude Code / Codex)
        │  MCP stdio
        ▼
Cairn MCP Server (this repo: mcp/)
        │
        ▼
.cairn/  (YAML on disk, git-tracked)
```

Three things to keep in mind:

1. **Cairn has no autonomous reasoning.** It is a headless service. The Host AI drives every interaction by calling MCP tools.
2. **`.cairn/` is the source of truth.** Engines compute, but they always read from and write to YAML.
3. **The MCP protocol is the contract.** 14 tools, documented in `mcp/README.md` and `skills/claude-code/SKILL.md`.

---

## Cognitive concept → engineering implementation

| Cognitive concept | Engineering implementation |
|-------------------|----------------------------|
| Headless architecture | Cairn has no LLM; depends on Host AI to invoke it |
| Skill Protocol | `skills/claude-code/SKILL.md` and `skills/codex.md` — the heartbeat contract |
| Skeleton | `.cairn/skeleton/<domain>.yaml` |
| Capillaries | `.cairn/domains/<domain>/{constraints,accepted_debt,rejected_paths}.yaml` |
| Blood | `.cairn/blood/<id>.yaml` — confirmed events |
| Staged | `.cairn/staged/<id>.yaml` — proposed, pending ratification |
| Signals | `.cairn/signals/raw_{git,calibration,conversation}/` (transient) |
| DNA | `.cairn/dna/identity.yaml` |
| Calibration | `GitEar` startup scan + `CalibrationEar` code-vs-cognition check → signals |
| Sedimentation | Host AI interprets signals → staged → blood |
| Compression | `CompressionEngine` aggregates Blood → DNA candidate (human-ratified) |
| Decay | `DecayEngine` lifecycle check + health-state markers + resurrection |
| Activation | `cairn_context` → ActivationEngine causal retrieval |
| Challenge | `cairn_context` / `cairn_signal` return conflict warnings + challenge level |
| Gravity | `EvolutionEvent.gravity.level` (G0–G3) |
| Governance | `.cairn/governance/` — policy + audit log + cognitive energy budget |
| Views | `.cairn/views/` — auto-generated AI-readable projections |
| Cognitive consistency | `cairn_doctor` — 5-rule consistency validation |

---

## Four layers (in `mcp/src/`)

```
schemas/   (13 files)  — Zod schemas, the domain language
   ↓
stores/    (11 files)  — YAML-backed persistence
   ↓
engines/   (14 files)  — Processing logic
   ↓
tools/ + cli/          — MCP handlers + CLI commands
```

### Schemas

Zod definitions. The canonical types are `EvolutionEvent` (40 fields), `SkeletonNode`, `DomainCapillary`, `DNAIdentity`, `DNATrait`, `StagedEntry`, `GovernancePolicy`, `Config`, `State`. See [`SCHEMA.md`](./SCHEMA.md) for the full reference.

### Stores

Pure persistence. Each store owns one part of `.cairn/`. All stores:

- Read via `yaml.parse` → `Schema.parse` (validation on every read)
- Write via `atomicWriteFile(path, ...)` (write + rename — POSIX-atomic; no half-written state under concurrent writes)
- `BloodStore` keeps an in-memory cache invalidated on `save` / `remove` — the single biggest perf win (1k blood event scale: `cairn_context` p99 went from 1715ms to 14.8ms)

### Engines

Stateless processing. Engines take stores as constructor dependencies and expose async methods. The fourteen engines:

| Engine | Job |
|--------|-----|
| `ActivationEngine` | `cairn_context` core — task → skeleton → capillaries → blood → DNA → result |
| `ChallengeEngine` | Produces three-level challenges (suggestion / reflective / hard) |
| `TrustRouter` | Central signal routing — dedup → governance → trauma → DNA modulation → gravity → destination |
| `BloodEngine` | Writes confirmed events + syncs domain capillaries |
| `ViewsEngine` | Regenerates `.cairn/views/` markdown projections |
| `DecayEngine` | Marks unused events stale / downgraded |
| `ResurrectionEngine` | Promotes archived events with recent reactivation |
| `CompressionEngine` | Detects DNA trait candidates from Blood patterns |
| `ConsistencyEngine` | 5-rule consistency validation (`cairn_doctor`) |
| `GovernanceEngine` | Resolves per-tool permission based on cognitive_mode |
| `GitEar` | Scans commits since last session (`cairn_session_end`) |
| `CalibrationEar` | Code-vs-cognition drift detection + safety valve |
| `StageEngine` | Infers project phase from commit cadence (14-day hysteresis) |
| `RecoveryEngine` | `cairn doctor --fix` — quarantines corruption, recovers session checkpoints |

### Tools

14 MCP tools wired in `mcp/src/server.ts`. Every tool call goes through a uniform `wrap()` that logs the call to `.cairn/logs/tools-YYYY-MM-DD.jsonl` (rotating daily, controlled by `config.yaml.logging`).

| Tool | Phase | Side effects |
|------|-------|--------------|
| `cairn_init_status` | init | none |
| `cairn_init_commit` | init | writes config, skeleton, blood, staged, stage, DNA, views |
| `cairn_context` | session-start | records activation hits |
| `cairn_plan` | pre-design | none |
| `cairn_signal` | during-work | routes signal through TrustRouter |
| `cairn_session_end` | session-end | **6-step pipeline** — git scan, decay, calibration + safety valve, stage inference, compression, views regen |
| `cairn_stage_list` / `cairn_stage_accept` / `cairn_stage_reject` | review | writes audit log on accept/reject |
| `cairn_dna_list` / `cairn_dna_accept` / `cairn_dna_reject` | DNA review | writes DNA identity on accept |
| `cairn_doctor` | diagnostic | **auto-resurrects** archived G0/G1 events with high reactivation |
| `cairn_status` | diagnostic | none |

Two tools deserve explicit awareness:

- **`cairn_session_end`** runs the full maintenance pipeline. Each step writes a checkpoint to `state.session_in_progress`. A mid-pipeline crash is recoverable via `cairn doctor --recover`.
- **`cairn_doctor`** mutates state — it auto-resurrects archived G0/G1 events with `recent_hits >= RESURRECTION_THRESHOLD`. Use with awareness.

---

## Signal flow

```
Git commits       Conversation turns       Code/cognition drift
   │                    │                          │
   ▼                    ▼                          ▼
GitEar             cairn_signal              CalibrationEar
   │                    │                          │
   └────────────┬───────┴───────┬──────────────────┘
                ▼               ▼
              TrustRouter (the central gate)
                ▼
   ┌────────────┼────────────┐
   ▼            ▼            ▼
dropped (G0)  staged       blood
              (needs       (auto-confirmed)
              human review)        │
                                   ▼
                              BloodEngine
                                   │
                                   ├──→ DomainStore sync (capillaries)
                                   └──→ ViewsEngine regen
```

`TrustRouter.route()` decisions, in order:

1. **Dedup** — if `(domain, subject, type)` already exists in Blood and not stale, merge instead of duplicate
2. **Governance** — apply cognitive_mode threshold to choose destination
3. **Trauma escalation** — `behavior_effect.type === 'avoid_suggestion'` near a trauma domain bumps gravity
4. **DNA modulation** — emerged traits adjust gravity (e.g. `simplicity_bias: high` boosts G of "adding new dependency" rejections)
5. **Gravity routing** — final gravity selects destination (`blood` / `staged` / `dropped`)

When `dna.identity.reevaluation_mode === true`, step 4 short-circuits — traits don't modulate. `cairn_context` also surfaces `dna.reevaluation_mode: true` and `paused_traits[]` so the Host AI knows.

---

## The six-step `cairn_session_end` pipeline

```
1. init           — write state.session_in_progress = {step: 'init'}
2. git_scan_done  — GitEar scans new commits → TrustRouter → blood/staged/dropped
3. decay_done     — DecayEngine archives/downgrades stale events
4. calibration_done — CalibrationEar checks code-vs-cognition; safety valve may flip DNA
5. stage_done     — StageEngine infers project phase (14-day hysteresis, confidence ≥ 0.6)
6. compression_done — CompressionEngine surfaces DNA trait candidates
   ↓
   ViewsEngine regen → SessionStore record → clear state.session_in_progress
```

Each step writes a checkpoint. If the process is killed between steps:

- `cairn doctor --metrics` shows `session_in_progress: YES` with the last completed step
- `cairn doctor --recover` clears the checkpoint
- Side effects already written (e.g. decay archives if killed after step 3) remain — the pipeline is idempotent enough that re-running the next session_end converges

---

## Cognitive modes

`config.yaml.cognitive_mode` is one of `lightweight` / `standard` / `institutional`. Definitions live in `mcp/src/constants.ts`:

| Knob | lightweight | standard | institutional |
|------|-------------|----------|---------------|
| Governance approval | G3 only | G2+ | G1+ |
| Challenge trigger | hard_constraint only | suggestion + challenge | all |
| Decay stale threshold | 30 days | 90 days | 180 days |
| Decay unused threshold | 60 days | 120 days | 240 days |
| DNA min evidence | 5 | 3 | 3 |
| Calibration depth | no_go only | no_go + skeleton | full |
| Audit detail | minimal | medium | full |

Pick based on how much cognitive overhead the project deserves, not its size.

---

## `.cairn/` directory anatomy

```
.cairn/
├── config.yaml                          ← project config (domains, cognitive_mode, logging)
├── state.yaml                           ← runtime state (cairn_version, last_session, stage, activation_log, session_in_progress?)
├── skeleton/
│   └── <domain>.yaml                    ← per-domain ownership map
├── blood/
│   └── <event_id>.yaml                  ← confirmed evolution events
├── staged/
│   └── <event_id>.yaml                  ← proposed events, pending human review
├── domains/<domain>/
│   ├── constraints.yaml
│   ├── accepted_debt.yaml               ← auto-synced from Blood
│   └── rejected_paths.yaml
├── dna/
│   ├── identity.yaml                    ← current personality, reevaluation_mode
│   ├── imprint.yaml                     ← parent project inheritance (forks only)
│   └── staged/
│       └── stg_dna_<trait>.yaml         ← DNA trait candidates
├── signals/
│   ├── raw_git/
│   ├── raw_calibration/
│   └── raw_conversation/                ← transient buckets, currently unused
├── governance/
│   ├── policy.yaml
│   └── audit.yaml                       ← every accept/reject logged here
├── views/
│   ├── output.md                        ← global constraints, AI-readable
│   ├── stage.md
│   └── domains/<domain>.md              ← per-domain summary
├── sessions/
│   └── sess_YYYY_MM_DD_HHMMSS.yaml      ← session records
├── logs/                                ← 0.4.0+
│   └── tools-YYYY-MM-DD.jsonl           ← structured tool-call log, rotates daily
└── quarantine/                          ← 0.4.0+, doctor --fix moves broken yamls here
    └── <iso-timestamp>/
```

All under `.cairn/` is git-tracked by design. The directory *is* the project's cognition export.

---

## Stability and recovery

- **Atomic writes** — all stores use `atomicWriteFile(write + rename)`. Concurrent writes never leave half-written state. POSIX `rename` is atomic.
- **Corruption recovery** — `cairn doctor --fix` scans for yaml parse failures and orphan skeleton refs, quarantines broken files to `.cairn/quarantine/<timestamp>/` so the system stays bootable.
- **Session recovery** — every `cairn_session_end` writes step checkpoints; a crash is recoverable via `cairn doctor --recover`.
- **Version tracking** — `state.cairn_version` records the runtime that wrote the data; `cairn_init_status` warns on mismatch; `cairn migrate` is the migration entry point.

See [`RECOVERY.md`](./RECOVERY.md) for full scenarios.

---

## Performance

The hot path is `cairn_context` (called before every AI response). On a 1k-blood-event project:

- p50 ≈ 4ms
- p99 ≈ 15ms
- session_end full pipeline ≈ 115ms

Achieved via BloodStore in-memory cache + batched activation recording. SLO and methodology in [`PERFORMANCE.md`](./PERFORMANCE.md).

---

## Where to read next

- [`SCHEMA.md`](./SCHEMA.md) — exact field-level reference for every YAML
- [`PHILOSOPHY.md`](./PHILOSOPHY.md) — the "why" if you skipped it
- [`QUICK_START.md`](./QUICK_START.md) — install + first session
- [`internal/architecture.zh.md`](./internal/architecture.zh.md) — original Chinese architecture draft
