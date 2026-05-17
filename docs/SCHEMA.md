# Schema Reference

> Canonical reference for every YAML file under `.cairn/`. Field semantics, types, examples.
>
> Zod types live in `mcp/src/schemas/`. This doc is the human-readable surface.

---

## Conventions

- All YAML files are validated on read by their Zod schema. A parse failure or schema violation surfaces in `cairn doctor --fix` and gets quarantined.
- Times: ISO 8601 UTC (`2026-05-17T08:00:00Z`), or short date (`2026-05-17`) where time of day is not meaningful.
- IDs: stable strings. Evolution events: `evt_<descriptive_slug>` or `evt_<YYYY_MM_DD>_<topic>`.

---

## `config.yaml`

Project-level configuration.

```yaml
version: "3.0"
project:
  name: "billing-service"
  created: "2025-02"
domains: ["api", "auth", "data", "ledger"]
cognitive_mode: "standard"     # lightweight | standard | institutional
stage:
  override: null               # set to force a phase (otherwise StageEngine infers)
tech_stack:
  - name: "postgres"
    domain: "data"
    summary: "Primary OLTP. No sharding."
logging:
  enabled: true
  retention_days: 30
```

| Field | Type | Notes |
|-------|------|-------|
| `version` | literal `"3.0"` | Schema version |
| `project.name` | string | Project name (purely descriptive) |
| `project.created` | string | YYYY-MM date |
| `domains` | string[] | Declared domains. Should match `.cairn/skeleton/*.yaml` |
| `cognitive_mode` | enum | See [`GLOSSARY.md#cognitive-mode`](./GLOSSARY.md#cognitive-mode) |
| `stage.override` | string \| null | Pin a phase manually; `null` lets `StageEngine` infer |
| `tech_stack[]` | array | Tech that AI should treat as load-bearing |
| `logging.enabled` | bool (default `true`) | Toggle `.cairn/logs/tools-*.jsonl` |
| `logging.retention_days` | int (default `30`) | Daily-log retention |

---

## `state.yaml`

Runtime state. Mutated by tools; not usually hand-edited.

```yaml
cairn_version: "0.4.0"
initialization_status: "complete"   # not_initialized | partial | complete
last_session:
  commit: "abc1234"
  ended_at: "2026-05-15T18:00:00Z"
stage:
  phase: "maturity"
  confidence: 0.84
  status: "advisory"
  evidence:
    - { source: "git", signal: "commit cadence 12/week stable" }
  guidance:
    - "Conservative changes preferred"
  last_updated: "2026-05-15T18:00:00Z"
activation_log:
  recent_hits:
    evt_087: 12
    evt_124: 3
session_in_progress:               # optional — present only mid-pipeline
  started_at: "2026-05-15T17:59:50Z"
  step: "decay_done"
```

| Field | Notes |
|-------|-------|
| `cairn_version` | Version that last wrote `.cairn/`. Used by `cairn migrate` |
| `initialization_status` | Set by `cairn_init_commit` |
| `last_session.{commit, ended_at}` | Anchor for `GitEar`'s next scan |
| `stage` | Inferred by `StageEngine` with 14-day hysteresis + confidence ≥ 0.6 threshold |
| `activation_log.recent_hits` | Count of how many times each event was activated. Drives `ResurrectionEngine` |
| `session_in_progress` | `cairn_session_end` checkpoint. Cleared on successful finish. Surfaces in `cairn_init_status.warnings` if present |

---

## `skeleton/<domain>.yaml`

Per-domain ownership map. One file per declared domain.

```yaml
domain: "api"
role: "primary"
owns:
  - "Public REST endpoints"
  - "Request/response shapes"
does_not_own:
  - "Database schema"            # owned by data domain
  - "Auth tokens"                # owned by auth domain
causal_keywords:
  - "api"
  - "endpoint"
  - "REST"
  - "/v1/"
dependencies:
  - "data"
  - "auth"
files:
  - "src/api/**"
  - "src/middleware/**"
archetype: "service"
last_updated: "2026-04-01"
```

| Field | Notes |
|-------|-------|
| `domain` | Must appear in `config.domains` |
| `role` | Free-form (`primary`, `auxiliary`, etc.) |
| `owns` / `does_not_own` | Capability statements. Help AI pick the right domain for a task |
| `causal_keywords` | The activation index. `cairn_context` matches task tokens against these |
| `dependencies` | Other domain names this domain depends on |
| `files` | Glob patterns rooting this domain in the codebase |
| `archetype` | Tag (`service`, `library`, `gateway`, ...) |

---

## `blood/<event_id>.yaml` — Evolution Event

The 40-field canonical record. Created via `cairn_init_commit`, `cairn_signal` (after ratification), or `cairn_session_end` (git-driven). Never hand-edit.

```yaml
id: "evt_087"
time: "2024-11-03"
domain: "data"
type: "incident_record"
gravity:
  level: "G3"

# Source + trust
source:
  type: "incident"
  confidence: 1.0
  verified: true
  refs:
    - { type: "postmortem", id: "PM-2024-014" }

# Core content
subject:
  name: "mongodb"
  aliases: ["document store"]
trigger: "Sharding migration corrupted ledger writes during failover"
decision_or_change: "Remove MongoDB from ledger; migrate to Postgres with strict serializable isolation"
reasoning: |
  Document model gave us flexibility but cost us ACID semantics under
  partition-tolerant configurations. Ledger correctness is non-negotiable.
rejected_paths:
  - path: "Continue with MongoDB + add transactions wrapper"
    reason: "Fix is at the engine level; wrappers leak state"

# Constraint effects
constraints_added:
  - "Ledger storage must be ACID; no eventually-consistent stores"
constraints_removed: []
accepted_debt: []

# Behavior effect
behavior_effect:
  type: "avoid_suggestion"        # avoid_suggestion | prefer_approach | warn_before | require_review
  instruction: "Do not propose MongoDB or document-store DBs for ledger data."

# Scope
affects:
  skeleton: true
  dna: true
  domains: ["data", "ledger"]

# Future
revisit:
  when: []                        # ['if Postgres sharding becomes a bottleneck', ...]

# Lifecycle
lifecycle:
  validity: "strategic"           # tactical | strategic
  decay_policy: "never"           # never | downgrade | archive
  resurrection_count: 0

# Health
health:
  state: "ok"                     # ok | stale | resurrected
  reason: null

# Trauma
trauma:
  is_trauma: true
  severity: "high"                # low | medium | high
  sensitivity_multiplier: 1.8

# Metadata
created_at: "2024-11-03T14:22:00Z"
updated_at: "2024-11-03T14:22:00Z"
governance_status: "ratified"     # auto_confirmed | ratified | pending
```

### Critical field semantics

| Field | Effect |
|-------|--------|
| `gravity.level` | G0 dropped on capture, G1 auto-confirmed, G2+ usually staged |
| `behavior_effect.type` | Drives how AI treats the event — `avoid_suggestion` becomes a `no_go` in `cairn_context` |
| `behavior_effect.instruction` | The actual sentence the AI should follow |
| `reasoning` | The *why*. Used as `no_go.reason` in context output (preferred over `instruction`) |
| `trauma.is_trauma` | Triggers all trauma rules — never decay, gravity ≥ G2, staged always, raises domain challenge sensitivity |
| `health.state` | `stale` = archived (still readable, doesn't influence routing unless reactivated) |
| `lifecycle.decay_policy` | `never` overrides DecayEngine for this event (trauma events) |
| `affects.dna: true` | This event counts toward CompressionEngine's evidence for DNA trait emergence |

---

## `staged/<event_id>.yaml`

Proposed events awaiting human ratification.

```yaml
id: "evt_pending_042"
draft_event:                      # the full EvolutionEvent shape from above
  id: "evt_pending_042"
  time: "2026-05-17"
  # ... 40 fields ...
review_status: "pending"          # pending | accepted | rejected
routing_reason: "DNA simplicity_bias raised gravity to G2; needs human ratification"
gravity: "G2"
governance_required: "human_ratified"   # auto_confirmable | human_ratified
created_at: "2026-05-17T10:00:00Z"
```

`cairn_stage_accept` promotes the `draft_event` into Blood and removes the staged file. `cairn_stage_reject` writes the rejection to `governance/audit.yaml` and removes the staged file.

---

## `domains/<domain>/{constraints,accepted_debt,rejected_paths}.yaml`

Auto-synced from Blood events. Each domain gets three files. Used to populate `cairn_context.relevant_domains[].rejected_paths` and `pitfalls` arrays.

```yaml
# constraints.yaml
domain: "data"
constraints:
  - { id: "c_ledger_acid", text: "Ledger storage must be ACID", source_event: "evt_087" }

# accepted_debt.yaml
domain: "data"
debts:
  - { id: "d_cache_invalidation", text: "Skip cache invalidation; rare reads", source_event: "evt_124", revisit_when: ["miss rate > 5%"] }

# rejected_paths.yaml
domain: "data"
paths:
  - { id: "p_mongodb_ledger", path: "MongoDB for ledger", reason: "see evt_087", source_event: "evt_087" }
```

Field names matter: `debts` (not `items`), `paths` (not `items`). The schemas enforce this; using the wrong name causes silent empty arrays.

---

## `dna/identity.yaml`

Emergent project personality. Mutated by `cairn_dna_accept`, `cairn_dna_reject`, `cairn dna reevaluate`, and CalibrationEar's safety valve.

```yaml
status: "emerged"                 # not_yet_emerged | emerging | emerged
traits:
  simplicity_bias:
    level: "high"                 # low | medium | high
    confidence: 0.91
    reasoning: "23 rejections in 14 months consistently chose boring tools"
    evidence_count: 23
    last_updated: "2026-04-30"
    drift_warning_count: 0
    last_safety_valve_at: null
  infra_aggressiveness:
    level: "low"
    confidence: 0.85
    reasoning: "..."
    evidence_count: 18
    last_updated: "2026-04-15"
    drift_warning_count: 0
    last_safety_valve_at: null
reevaluation_mode: false
compression_threshold:
  min_evidence: 3
  min_timespan_months: 3
  min_confidence: 0.6
```

| Field | Notes |
|-------|-------|
| `traits.<name>` | Only `simplicity_bias` and `infra_aggressiveness` are currently consumed by TrustRouter / ChallengeEngine |
| `traits.<name>.drift_warning_count` | Incremented when CalibrationEar finds the trait disagrees with recent signals. Surfaces in `cairn doctor` |
| `reevaluation_mode` | When `true`, all traits stop modulating; surfaces in `cairn_context.dna.{reevaluation_mode, paused_traits}` |
| `compression_threshold` | Tunable per-mode in `constants.ts.COGNITIVE_MODE_PARAMS` |

---

## `dna/imprint.yaml` (forks only)

Carried from a parent project on fork. Optional.

```yaml
inherited_from: "billing-service"
inherited_at: "2026-04-01T00:00:00Z"
inherited_constraints:
  - "Ledger storage must be ACID"
inherited_warnings:
  - { domain: "data", warning: "MongoDB caused a P0 incident — see parent evt_087" }
identity_status: "not_yet_emerged"
```

---

## `dna/staged/<id>.yaml`

DNA trait candidates produced by `CompressionEngine`.

```yaml
id: "stg_dna_simplicity_bias_1715234567890"
trait_name: "simplicity_bias"
level: "high"
confidence: 0.78
evidence_events:
  - "evt_021"
  - "evt_044"
  - "evt_087"
reasoning: "3+ rejections of complex tooling over 4 months"
proposed_at: "2026-05-17T08:00:00Z"
review_status: "pending"          # pending | accepted | rejected
```

Promoted to `identity.yaml` via `cairn_dna_accept`. Each trait requires human ratification — wrong DNA silently distorts every future decision.

---

## `governance/policy.yaml`

```yaml
cognitive_mode: "standard"        # mirrored from config; used by GovernanceEngine
per_tool_overrides: {}            # reserved for future per-tool quotas
```

## `governance/audit.yaml`

Append-only log of governance decisions.

```yaml
- ts: "2026-05-17T10:00:00Z"
  actor: "user"
  action: "stage_accept"
  target: "evt_pending_042"
  detail: "ratified into blood"
- ts: "2026-05-17T10:05:00Z"
  actor: "user"
  action: "dna_reject"
  target: "stg_dna_infra_aggressiveness_..."
  detail: "premature — only 4 events, want more signal"
```

---

## `sessions/sess_YYYY_MM_DD_HHMMSS.yaml`

Per-session record. Written by `cairn_session_end`.

```yaml
id: "sess_2026_05_17_180000"
started_at: "2026-05-17T17:00:00Z"
ended_at: "2026-05-17T18:00:00Z"
summary: "Refactored auth middleware to drop session-token storage per legal req."
signals_captured: 4
signals_routed:
  G0: 1
  G1: 2
  G2: 1
  G3: 0
domains_touched: ["auth"]
decisions_made:
  - "Drop session-token middleware"
unresolved:
  - "Verify JWT TTL meets compliance window"
```

---

## `views/output.md` and friends

Auto-generated markdown. Read-only artifact for AI tools that can't speak MCP (degraded mode fallback). Regenerated on every `cairn_session_end` and `cairn doctor`. Never hand-edit.

---

## `logs/tools-YYYY-MM-DD.jsonl` (0.4.0+)

One JSON object per line. Each MCP tool call produces one row.

```json
{"ts":"2026-05-17T10:00:01Z","tool":"cairn_context","duration_ms":12.4,"ok":true,"args_summary":"{\"task\":\"add caching\"}"}
```

Default on; toggle via `config.logging.enabled`. Daily rotation, retention controlled by `config.logging.retention_days`.

---

## `quarantine/<iso-timestamp>/` (0.4.0+)

Created by `cairn doctor --fix`. Contains yaml files that failed to parse, isolated so the system stays bootable. Not consumed by any engine. Manually inspect to decide whether to delete or hand-restore.
