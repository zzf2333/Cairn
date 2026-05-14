[中文](FORMAT.zh.md) | English

# Cairn Format Specification

Authoritative reference for the `.cairn/` YAML schema format used by the Cairn dynamic memory engine.

---

## Directory Structure

```
.cairn/
├── config.yaml          # Project configuration
├── state.yaml           # Runtime state (includes stage snapshot)
├── signals/             # L1 candidate signals (YAML)
├── staged/              # L2 pending review entries (YAML)
├── memory/              # Committed memory entries (YAML) — source of truth
├── views/               # Auto-generated views (Markdown, read-only)
│   ├── output.md        # Global constraint view
│   ├── stage.md         # Stage advisory
│   └── domains/         # Per-domain views
│       └── <name>.md
└── sessions/            # Session records (YAML)
```

| Directory | Writer | Reader | Lifecycle |
|-----------|--------|--------|-----------|
| config.yaml | Human (at init + manual edits) | Server | Long-lived, stable |
| state.yaml | Server | Server | Updated each startup |
| signals/ | Dual ears via Trust Router | Trust Router | Accumulate, then promote or expire |
| staged/ | Trust Router | Human (via `cairn_review` MCP tool) | Accepted into memory or discarded |
| memory/ | `cairn_review` / L3 auto-write | Views Engine, MCP Tools | Long-lived, persistent |
| views/ | Views Engine (auto) | AI (MCP or Skill) | Regenerated on memory change |
| sessions/ | Server (at session_end) | Audit / retrospective | Periodically prunable |

---

## config.yaml

Project-level configuration. Created automatically on first use (bootstrap), rarely changed afterward.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| version | string | `"2.0"` | Schema version |
| project.name | string | required | Project name |
| project.created | string | required | Project creation date (YYYY-MM) |
| domains.locked | string[] | `[]` | Locked domain list |
| trust_policy.L3_auto_write | string[] | see below | Rules for auto-write to memory |
| trust_policy.L2_staged | string[] | see below | Rules forcing staged review |
| trust_policy.never_auto | string[] | see below | Hard rules that always require review |
| stage.override | string \| null | `null` | Manual stage override |
| stage.auto_constraint | boolean | `false` | Whether stage produces hard constraints |

### Example

```yaml
version: "2.0"

project:
  name: "my-saas"
  created: "2023-01"

domains:
  locked:
    - api-layer
    - auth
    - state-management

trust_policy:
  L3_auto_write:
    - "source.kind == 'git-revert' AND scope == 'local'"
    - "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'"
  L2_staged:
    - "scope == 'global'"
    - "type == 'transition' AND affects_output == true"
  never_auto:
    - "New global no-go"
    - "Stage change"
    - "Output-level stack change"
    - "scope == 'global' behavior_effect"

stage:
  override: null
  auto_constraint: false
```

---

## Signal

Raw signals captured by Git ear or conversation ear, before routing.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique signal ID |
| source_ear | `"git"` \| `"conversation"` | required | Signal source |
| signal_type | enum | required | One of: `dependency-removed`, `dependency-replaced`, `revert`, `large-refactor`, `user-rejection`, `user-constraint`, `historical-reference`, `stage-signal`, `decision`, `debt-acceptance` |
| raw_data | Record<string, unknown> | `{}` | Raw evidence payload |
| inferred.probable_type | string | optional | Inferred memory type |
| inferred.probable_domain | string | optional | Inferred target domain |
| inferred.confidence | `"high"` \| `"medium"` \| `"low"` | `"medium"` | Inference confidence |
| routing.level | `"L0"` \| `"L1"` \| `"L2"` \| `"L3"` | optional | Assigned routing level |
| routing.reason | string | optional | Why this level was assigned |
| captured_at | string (ISO 8601) | required | Capture timestamp |

### Example

```yaml
# .cairn/signals/sig_2026_05_11_001.yaml

id: sig_2026_05_11_001
source_ear: git
signal_type: dependency-removed
raw_data:
  package: tRPC
  appeared: "2024-02-15"
  disappeared: "2024-03-02"
  related_commits:
    - a1b2c3d
    - e4f5g6h
inferred:
  probable_type: rejection
  probable_domain: api-layer
  confidence: high
routing:
  level: L3
  reason: "git-revert + local scope -> auto-write eligible"
captured_at: "2026-05-11T08:00:00Z"
```

---

## StagedEntry

Entries awaiting human review. Created when Trust Router assigns L2.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique staged entry ID |
| origin_signal | string | required | Source signal ID |
| draft_memory | DraftMemory | required | Proposed memory content (see below) |
| review_status | `"pending"` \| `"accepted"` \| `"rejected"` \| `"expired"` | `"pending"` | Current review state |
| routing_reason | string | required | Why this was routed to staged |
| created_at | string (ISO 8601) | required | Creation timestamp |

### DraftMemory

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| type | enum | required | One of `MEMORY_TYPES` |
| domain | string | required | Target domain |
| scope | `"local"` \| `"global"` | `"local"` | Impact scope |
| subject.name | string | required | Subject identifier |
| subject.category | string | optional | Subject category |
| summary | string | required | One-line summary |
| behavior_effect.type | enum | required | One of `BEHAVIOR_EFFECT_TYPES` |
| behavior_effect.instruction | string | required | What the AI should do differently |
| confidence.level | `"high"` \| `"medium"` \| `"low"` | `"medium"` | Confidence level |

### Example

```yaml
# .cairn/staged/staged_2026_05_11_api_trpc.yaml

id: staged_2026_05_11_api_trpc
origin_signal: sig_2026_05_11_001
draft_memory:
  type: rejection
  domain: api-layer
  scope: local
  subject:
    name: tRPC
    category: api-framework
  summary: "tRPC removed after trial period"
  behavior_effect:
    type: avoid_suggestion
    instruction: "Do not suggest migrating to tRPC"
  confidence:
    level: medium
review_status: pending
routing_reason: "global impact requires review"
created_at: "2026-05-11T08:00:00Z"
```

---

## MemoryEntry

Committed memory — the source of truth. Each file in `memory/` is one entry.

### Memory Types

| Type | Description |
|------|-------------|
| `decision` | A technology choice was made |
| `rejection` | A direction was excluded |
| `transition` | Approach changed from A to B |
| `debt` | A technical debt was accepted |
| `experiment` | An exploratory attempt concluded |

### Behavior Effect Types

| Type | AI Instruction |
|------|----------------|
| `avoid_suggestion` | Do not suggest this direction |
| `prefer_approach` | Prefer this approach |
| `warn_before` | Warn about risks before proceeding |
| `require_review` | Read domain history before suggesting |

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique memory ID |
| type | enum | required | One of `MEMORY_TYPES` |
| domain | string | required | Domain key |
| scope | `"local"` \| `"global"` | `"local"` | Impact scope |
| status | `"active"` \| `"superseded"` \| `"archived"` | `"active"` | Lifecycle state |
| health.state | `"ok"` \| `"stale"` \| `"conflicted"` | `"ok"` | Current health |
| health.reason | string \| null | `null` | Reason if unhealthy |
| confidence.level | `"high"` \| `"medium"` \| `"low"` | `"high"` | Confidence level |
| confidence.score | number (0-1) | optional | Numeric score |
| confidence.reason | string | optional | Why this confidence |
| source.kind | `"git-revert"` \| `"git-dependency"` \| `"conversation"` \| `"manual"` | required | Origin type |
| source.refs | Array<{type, id}> | required | Reference list; type is `"commit"` \| `"session"` \| `"file"` \| `"manual"` |
| source.captured_at | string (ISO 8601) | required | When captured |
| subject.name | string | required | Subject identifier |
| subject.category | string | optional | Subject category |
| summary | string | required | One-line summary |
| rejected | {what, reason} | optional | What was rejected and why |
| chosen | {what, reason} | optional | What was chosen and why |
| behavior_effect.type | enum | required | One of `BEHAVIOR_EFFECT_TYPES` |
| behavior_effect.instruction | string | required | Concrete AI instruction |
| revisit.when | string[] | `[]` | Conditions for re-evaluation |
| revisit.status | `"not_met"` \| `"possibly_met"` \| `"met"` | `"not_met"` | Current revisit state |
| relations.related | string[] | `[]` | Related memory IDs |
| relations.conflicts | string[] | `[]` | Conflicting memory IDs |
| created_at | string (ISO 8601) | required | Creation timestamp |
| updated_at | string (ISO 8601) | required | Last update timestamp |

### Example

```yaml
# .cairn/memory/mem_2024_03_api_tRPC_rejection.yaml

id: mem_2024_03_api_tRPC_rejection
type: rejection
domain: api-layer
scope: local

status: active

health:
  state: ok
  reason: null

confidence:
  level: high
  score: 0.86
  reason: "explicit user rejection with git revert evidence"

source:
  kind: git-revert
  refs:
    - type: commit
      id: a1b2c3d
    - type: session
      id: sess_2024_03_15_001
  captured_at: "2024-03-15T10:00:00Z"

subject:
  name: tRPC
  category: api-framework

summary: "tRPC reverted after 2-week trial; REST client integration cost too high"

rejected:
  what: "tRPC migration"
  reason: "REST client retrofit cost outweighed tRPC type-safety benefits"

chosen:
  what: "REST + OpenAPI"
  reason: "Fits current clients and team workflow"

behavior_effect:
  type: avoid_suggestion
  instruction: "Do not suggest migrating to tRPC unless revisit conditions are met"

revisit:
  when:
    - "All existing REST clients replaced"
    - "New greenfield API service started"
  status: not_met

relations:
  related:
    - mem_2024_03_api_openapi_decision
  conflicts: []

created_at: "2024-03-15T10:00:00Z"
updated_at: "2024-03-15T10:00:00Z"
```

---

## StageSnapshot

Stored in `state.yaml` under the `stage` key. Represents the inferred project lifecycle phase.

### Stage Phases

| Phase | Description |
|-------|-------------|
| `exploration` | Early stage, high dependency churn, rapid experimentation |
| `growth` | Feature velocity increasing, architecture stabilizing |
| `maturity` | Stable architecture, changes are incremental |
| `maintenance` | Low activity, mostly bug fixes and dependency updates |

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| phase | enum | required | One of `STAGE_PHASES` |
| confidence | number (0-1) | required | Inference confidence |
| status | `"advisory"` \| `"confirmed"` | `"advisory"` | Whether human-confirmed |
| evidence | Array<{source, signal}> | `[]` | Supporting evidence |
| guidance | string[] | `[]` | Stage-appropriate suggestions |
| last_updated | string (ISO 8601) | required | Last update timestamp |

### Example

```yaml
# In .cairn/state.yaml

stage:
  phase: growth
  confidence: 0.68
  status: advisory
  evidence:
    - source: git
      signal: "dependency changes decreased over last 3 months"
    - source: git
      signal: "commit frequency stable at 12/week"
    - source: conversation
      signal: "user requests mostly feature additions"
  guidance:
    - "Balance velocity with stability"
    - "New dependencies require maintenance cost assessment"
  last_updated: "2026-05-11T08:00:00Z"
```

---

## SessionRecord

Audit trail for each AI session. One file per session in `sessions/`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Session ID |
| started_at | string (ISO 8601) | required | Session start time |
| ended_at | string (ISO 8601) | required | Session end time |
| summary | string | required | Session summary |
| signals_captured | number | `0` | Total signals captured |
| signals_routed.L0 | number | `0` | Signals dropped |
| signals_routed.L1 | number | `0` | Signals to candidate pool |
| signals_routed.L2 | number | `0` | Signals to staged |
| signals_routed.L3 | number | `0` | Signals auto-written |
| domains_touched | string[] | `[]` | Domains affected |
| decisions_made | string[] | `[]` | Decisions recorded |
| unresolved | string[] | `[]` | Unresolved items |
| context_injections | string[] | `[]` | Context injections performed |

### Example

```yaml
# .cairn/sessions/sess_2026_05_11_001.yaml

id: sess_2026_05_11_001
started_at: "2026-05-11T10:00:00Z"
ended_at: "2026-05-11T12:30:00Z"
summary: "Refactored auth module from session-based to JWT"
signals_captured: 3
signals_routed:
  L0: 0
  L1: 1
  L2: 1
  L3: 1
domains_touched:
  - auth
  - api-layer
decisions_made:
  - "Auth migrated from session to JWT"
unresolved:
  - "JWT refresh token storage location undecided"
context_injections:
  - "cairn_context returned domains: auth, api-layer; no-go: tRPC"
```

---

## Views Generation Rules

Views are auto-generated Markdown projections of `memory/`. They are read-only. Every view file begins with:

```markdown
<!--
Generated by Cairn. Do not edit manually.
Source: .cairn/memory/*.yaml
Last generated: <ISO 8601 timestamp>
-->
```

### views/output.md

Global constraint snapshot injected at every AI session start.

| Section | Source Filter |
|---------|-------------|
| no-go | `scope == 'global'` OR `behavior_effect.type == 'avoid_suggestion'`, status `active` |
| stack | `type == 'decision'` AND `status == 'active'` |
| debt | `type == 'debt'` |
| hooks | `config.yaml` `domains.locked` + memory keyword extraction |
| stage | `state.yaml` stage snapshot |

**Token budget:** target 500, hard limit 800. When over limit, prioritize `behavior_effect.type == 'avoid_suggestion'` entries.

### views/domains/\<name\>.md

Per-domain design context, injected on demand.

| Section | Source Filter |
|---------|-------------|
| trajectory | All active entries in domain, sorted by `created_at` |
| rejected paths | `type == 'rejection'` |
| known pitfalls | `behavior_effect.type == 'warn_before'` |
| open questions | `revisit.status == 'possibly_met'` |

**Token budget:** target 300 per file, hard limit 500.

### views/stage.md

Stage advisory detail view, generated from `state.yaml` stage snapshot. Contains phase, confidence, status, evidence list, and guidance list.

---

## Trust Router

All signals must pass through the Trust Router. No signal bypasses it.

### Routing Levels

| Level | Name | Storage | Behavior |
|-------|------|---------|----------|
| L0 | Drop | None | Noise, duplicates, low confidence — discarded |
| L1 | Candidate | signals/ | Accumulate; promote when evidence builds |
| L2 | Staged | staged/ | Awaits human review |
| L3 | Auto-write | memory/ | Written automatically under strict conditions |

### Routing Flow

```
Signal enters Trust Router
  |
  +-> Duplicate? (same domain + same subject)
  |     Yes -> Merge into existing source.refs -> L0
  |     No  -> Continue
  |
  +-> Hard-rule L2? (never_auto list)
  |     Yes -> Write to staged/ (regardless of source reliability)
  |     No  -> Continue
  |
  +-> Config L2? (trust_policy.L2_staged match)
  |     Yes -> Write to staged/
  |     No  -> Continue
  |
  +-> Config L3? (trust_policy.L3_auto_write match)
  |     Yes -> Write to memory/ -> Trigger views regeneration
  |     No  -> Continue
  |
  +-> Confidence check
  |     >= medium -> L1 (write to signals/)
  |     < medium  -> L0 (drop)
  |
  +-> L1 accumulation
        Same domain + same subject L1 signals >= 3 (L1_ACCUMULATION_THRESHOLD)
        -> Auto-promote to L2 staged
```

**Hard rule: L2 safety rules always override L3 auto-write rules.**

### Hard Rules (non-configurable)

- New global no-go -> always L2
- Stage change -> always L2
- `scope == 'global'` behavior_effect -> always L2
- Any item in `never_auto` list -> always L2

---

## ID Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Signal | `sig_<YYYY_MM_DD>_<seq>` | `sig_2026_05_11_001` |
| StagedEntry | `staged_<YYYY_MM_DD>_<domain>_<slug>` | `staged_2026_05_11_api_trpc` |
| MemoryEntry | `mem_<YYYY_MM>_<domain>_<slug>` | `mem_2024_03_api_tRPC_rejection` |
| Session | `sess_<YYYY_MM_DD>_<seq>` | `sess_2026_05_11_001` |

Domain keys use `kebab-case`. The domain list is locked at initial setup.

