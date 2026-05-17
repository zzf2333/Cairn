# Schema

> Canonical field-level reference for every yaml file under `.cairn/`. Look up on demand.

Zod types live in `mcp/src/schemas/`. This doc mirrors them in human-readable form.

---

## Conventions

- Every yaml file is validated on read by its Zod schema. Parse failure / schema violation surfaces in `cairn doctor --fix` and gets quarantined.
- Times: ISO 8601 UTC (`2026-05-17T08:00:00Z`), or short date (`2026-05-17`) where time-of-day is not meaningful.
- IDs: stable strings. Evolution events: `evt_<slug>` or `evt_<YYYY_MM_DD>_<topic>`.

---

## `config.yaml`

```yaml
version: "3.0"
project:
  name: "billing-service"
  created: "2025-02"
domains: ["api", "auth", "data", "ledger"]
cognitive_mode: "standard"          # lightweight | standard | institutional
stage:
  override: null                    # set to force a phase
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
| `version` | `"3.0"` | Schema version |
| `project.name` | string | Descriptive only |
| `project.created` | YYYY-MM | Project birth |
| `domains` | string[] | Should match `.cairn/skeleton/*.yaml` |
| `cognitive_mode` | enum | See [`glossary.md#cognitive-mode`](./glossary.md#cognitive-mode) |
| `stage.override` | string \| null | Pin a phase; `null` lets `StageEngine` infer |
| `tech_stack[]` | array | Tech AI should treat as load-bearing |
| `logging.enabled` | bool (default `true`) | Toggle `.cairn/logs/tools-*.jsonl` |
| `logging.retention_days` | int (default `30`) | Daily log retention |

---

## `state.yaml`

Runtime state. Mutated by tools, not usually hand-edited.

```yaml
cairn_version: "0.4.0"
initialization_status: "complete"  # not_initialized | partial | complete
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
session_in_progress:                # optional — present only mid-pipeline
  started_at: "2026-05-15T17:59:50Z"
  step: "decay_done"
```

| Field | Notes |
|-------|-------|
| `cairn_version` | Version that last wrote `.cairn/`. Used by `cairn migrate` |
| `last_session.commit` | Anchor for `GitEar`'s next scan |
| `stage` | Inferred by `StageEngine` with 14-day hysteresis + confidence ≥ 0.6 |
| `activation_log.recent_hits` | Activation counts; drives `ResurrectionEngine` |
| `session_in_progress` | `cairn_session_end` checkpoint. Cleared on successful finish |

---

## `skeleton/<domain>.yaml`

```yaml
domain: "api"
role: "primary"
owns:
  - "Public REST endpoints"
  - "Request/response shapes"
does_not_own:
  - "Database schema"
  - "Auth tokens"
causal_keywords: ["api", "endpoint", "REST", "/v1/"]
dependencies: ["data", "auth"]
files: ["src/api/**", "src/middleware/**"]
archetype: "service"
last_updated: "2026-04-01"
```

| Field | Notes |
|-------|-------|
| `domain` | Must appear in `config.domains` |
| `causal_keywords` | Activation index — `cairn_context` matches task tokens here |
| `owns` / `does_not_own` | Negative space matters — declare both halves |
| `files` | Glob patterns; soft hint, not enforcement |

---

## `blood/<event_id>.yaml` — Evolution Event

The 40-field canonical record. Never hand-edit. Created via `cairn_init_commit`, `cairn_signal` (post-ratification), or `cairn_session_end` (git-driven).

```yaml
id: "evt_087"
time: "2024-11-03"
domain: "data"
type: "incident_record"
gravity:
  level: "G3"

source:
  type: "incident"
  confidence: 1.0
  verified: true
  refs: [{ type: "postmortem", id: "PM-2024-014" }]

subject:
  name: "mongodb"
  aliases: ["document store"]
trigger: "Sharding migration corrupted ledger writes during failover"
decision_or_change: "Remove MongoDB from ledger; migrate to Postgres"
reasoning: |
  Document model gave flexibility but cost ACID under partition tolerance.
  Ledger correctness is non-negotiable.
rejected_paths:
  - path: "Continue MongoDB + transactions wrapper"
    reason: "Fix is at engine level; wrappers leak state"

constraints_added:
  - "Ledger storage must be ACID"
constraints_removed: []
accepted_debt: []

behavior_effect:
  type: "avoid_suggestion"
  instruction: "Do not propose MongoDB or document-store DBs for ledger data."

affects:
  skeleton: true
  dna: true
  domains: ["data", "ledger"]

revisit:
  when: []

lifecycle:
  validity: "strategic"
  decay_policy: "never"

health:
  state: "ok"                       # ok | stale | resurrected
  reason: null

trauma:
  is_trauma: true
  severity: "high"
  sensitivity_multiplier: 1.8

created_at: "2024-11-03T14:22:00Z"
updated_at: "2024-11-03T14:22:00Z"
governance_status: "ratified"       # auto_confirmed | ratified | pending
```

### Load-bearing field semantics

| Field | Effect |
|-------|--------|
| `gravity.level` | G0 dropped, G1 auto-confirmed, G2+ usually staged |
| `behavior_effect.type` | `avoid_suggestion` becomes `no_go` in `cairn_context` |
| `reasoning` | Used as `no_go.reason` in context output (preferred over `instruction`) |
| `trauma.is_trauma` | Triggers all trauma rules — never decay, gravity ≥ G2, staged always, raises domain challenge sensitivity |
| `health.state` | `stale` = archived (still readable, doesn't influence routing unless reactivated) |
| `lifecycle.decay_policy: "never"` | Overrides DecayEngine for this event |
| `affects.dna: true` | Counts toward CompressionEngine evidence |

---

## `staged/<id>.yaml`

```yaml
id: "evt_pending_042"
draft_event:                        # full EvolutionEvent shape, ready to promote
  id: "evt_pending_042"
  # ... 40 fields ...
review_status: "pending"            # pending | accepted | rejected
routing_reason: "DNA simplicity_bias raised gravity G1→G2; needs human ratification"
gravity: "G2"
governance_required: "human_ratified"   # auto_confirmable | human_ratified
created_at: "2026-05-17T10:00:00Z"
```

`cairn_stage_accept` promotes `draft_event` to Blood; `cairn_stage_reject` writes to audit and removes.

---

## `domains/<domain>/{constraints,accepted_debt,rejected_paths}.yaml`

Auto-synced from Blood. **Never hand-edit.**

```yaml
# constraints.yaml
domain: "data"
constraints:
  - { id: "c_ledger_acid", text: "Ledger storage must be ACID", source_event: "evt_087" }

# accepted_debt.yaml
domain: "data"
debts:                              # not `items`
  - { id: "d_cache_inv", text: "Skip cache invalidation", source_event: "evt_124", revisit_when: ["miss > 5%"] }

# rejected_paths.yaml
domain: "data"
paths:                              # not `items`
  - { id: "p_mongo_ledger", path: "MongoDB for ledger", reason: "see evt_087", source_event: "evt_087" }
```

Field names matter. `debts` (not `items`), `paths` (not `items`). The schemas enforce this; the wrong name produces silent empty arrays.

---

## `dna/identity.yaml`

```yaml
status: "emerged"                   # not_yet_emerged | emerging | emerged
traits:
  simplicity_bias:
    level: "high"                   # low | medium | high
    confidence: 0.91
    reasoning: "23 rejections in 14 months chose boring tools"
    evidence_count: 23
    last_updated: "2026-04-30"
    drift_warning_count: 0
    last_safety_valve_at: null
  infra_aggressiveness:
    level: "low"
    confidence: 0.85
    # ...
reevaluation_mode: false
compression_threshold:
  min_evidence: 3
  min_timespan_months: 3
  min_confidence: 0.6
```

| Field | Notes |
|-------|-------|
| `traits.<name>` | Currently only `simplicity_bias` and `infra_aggressiveness` are consumed by TrustRouter / ChallengeEngine |
| `traits.<name>.drift_warning_count` | Incremented when CalibrationEar finds the trait disagrees with recent signals |
| `reevaluation_mode` | When `true`, all traits stop modulating |

---

## `dna/imprint.yaml` (forks only)

```yaml
inherited_from: "billing-service"
inherited_at: "2026-04-01T00:00:00Z"
inherited_constraints:
  - "Ledger storage must be ACID"
inherited_warnings:
  - { domain: "data", warning: "MongoDB caused P0 — see parent evt_087" }
identity_status: "not_yet_emerged"
```

---

## `dna/staged/<id>.yaml`

DNA trait candidates from `CompressionEngine`.

```yaml
id: "stg_dna_simplicity_bias_1715234567890"
trait_name: "simplicity_bias"
level: "high"
confidence: 0.78
evidence_events: ["evt_021", "evt_044", "evt_087"]
reasoning: "3+ rejections of complex tooling over 4 months"
proposed_at: "2026-05-17T08:00:00Z"
review_status: "pending"
```

---

## `governance/policy.yaml`

```yaml
cognitive_mode: "standard"          # mirrored from config
per_tool_overrides: {}              # reserved
```

## `governance/audit.yaml`

Append-only log:

```yaml
- ts: "2026-05-17T10:00:00Z"
  actor: "user"                     # user | system | AI
  action: "stage_accept"            # stage_accept | stage_reject | dna_accept | dna_reject | drop_g0 | auto_confirm | merge
  target: "evt_pending_042"
  detail: "ratified into blood"
```

---

## `sessions/sess_YYYY_MM_DD_HHMMSS.yaml`

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
decisions_made: ["Drop session-token middleware"]
unresolved: ["Verify JWT TTL meets compliance window"]
```

---

## `views/output.md` and friends

Auto-generated markdown. Read-only artifact for degraded mode. Regenerated on every `cairn_session_end` and `cairn doctor`. Never hand-edit.

---

## `logs/tools-YYYY-MM-DD.jsonl`

One JSON per line, one row per MCP tool call:

```json
{"ts":"2026-05-17T10:00:01Z","tool":"cairn_context","duration_ms":12.4,"ok":true,"args_summary":"{\"task\":\"add caching\"}"}
```

Toggle via `config.logging.enabled`. Daily rotation, retention via `config.logging.retention_days`.

---

## `quarantine/<iso-timestamp>/`

Created by `cairn doctor --fix`. Contains yaml files that failed to parse, isolated so the system stays bootable. Not consumed by any engine. Manually inspect.

---

## See also

- [`glossary.md`](./glossary.md) — terms
- [`stability.md`](./stability.md) — which fields are Stable / Experimental / Internal
- [`migration.md`](./migration.md) — upgrade path between versions
