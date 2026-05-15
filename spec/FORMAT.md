[中文](FORMAT.zh.md) | English

# Cairn Format Specification

Authoritative reference for the `.cairn/` YAML schema format used by the Cairn V3 engineering cognition engine.

---

## Directory Structure

```
.cairn/
├── config.yaml              # Project configuration
├── state.yaml               # Runtime state (stage snapshot, activation log)
├── skeleton/                # Domain boundary definitions (SkeletonNode YAML)
│   └── <domain>.yaml
├── blood/                   # Evolution events — the source of truth
│   └── <id>.yaml
├── dna/                     # Project identity
│   ├── identity.yaml        # Emerged trait profile
│   └── imprint.yaml         # Inherited constraints (if forked)
├── domains/                 # Per-domain capillary views (constraints, debt, rejected paths)
│   └── <domain>.yaml
├── staged/                  # Pending review entries (YAML)
│   └── <id>.yaml
├── signals/                 # Raw captured signals by source
│   ├── raw_git/
│   ├── raw_conversation/
│   └── raw_calibration/
├── governance/              # Governance policy and audit trail
│   ├── policy.yaml
│   └── audit.yaml
├── views/                   # Auto-generated views (Markdown, read-only)
│   ├── output.md            # Global constraint view
│   ├── stage.md             # Stage advisory
│   └── domains/             # Per-domain views
│       └── <name>.md
└── sessions/                # Session records (YAML)
    └── <id>.yaml
```

| Directory | Writer | Reader | Lifecycle |
|-----------|--------|--------|-----------|
| config.yaml | Human (at init + manual edits) | Server | Long-lived, stable |
| state.yaml | Server | Server | Updated each startup |
| skeleton/ | Server (bootstrap + evolution events) | Trust Router, Consistency Engine | Stable once mature |
| blood/ | Trust Router (auto) / `cairn_review` (human) | Views Engine, MCP Tools | Long-lived, persistent |
| dna/ | Compression Engine (auto) | Trust Router, Views Engine | Emerges over time |
| domains/ | Domain Store (auto from blood) | MCP Tools | Regenerated on blood change |
| staged/ | Trust Router | Human (via `cairn_review` MCP tool) | Accepted into blood or discarded |
| signals/ | Dual ears + Calibration Engine | Trust Router | Accumulate, then promote or expire |
| governance/ | Governance Engine (auto) | Audit, MCP Tools | Append-only audit log |
| views/ | Views Engine (auto) | AI (MCP or Skill) | Regenerated on blood change |
| sessions/ | Server (at session_end) | Audit / retrospective | Periodically prunable |

---

## config.yaml

Project-level configuration. Created automatically on first use (bootstrap), rarely changed afterward.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| version | `"3.0"` | required | Schema version |
| project.name | string | required | Project name |
| project.created | string | required | Project creation date (YYYY-MM) |
| domains | string[] | `[]` | Domain list |
| cognitive_mode | `"lightweight"` \| `"standard"` \| `"institutional"` | `"standard"` | Governance strictness preset |
| stage.override | string \| null | `null` | Manual stage override |
| tech_stack | Array<{name, domain, summary}> | `[]` | Detected technology stack |

### Cognitive Modes

| Mode | Min Gravity for Human Ratification | Decay Stale (days) | DNA Min Evidence | Calibration Depth |
|------|-----------------------------------|--------------------|------------------|-------------------|
| `lightweight` | G3 | 30 | 5 | no_go only |
| `standard` | G2 | 90 | 3 | no_go + skeleton |
| `institutional` | G1 | 180 | 3 | full |

### Example

```yaml
version: "3.0"

project:
    name: "my-saas"
    created: "2023-01"

domains:
    - api-layer
    - auth
    - state-management

cognitive_mode: standard

stage:
    override: null

tech_stack:
    - name: Next.js
      domain: frontend-framework
      summary: "React meta-framework for SSR and routing"
    - name: PostgreSQL
      domain: database
      summary: "Primary relational database"
```

---

## Gravity System (G0-G3)

All signals, events, and routing decisions use the Gravity system instead of the legacy L0-L3 trust levels.

| Level | Name | Behavior |
|-------|------|----------|
| G0 | Noise | Below threshold — dropped, not persisted |
| G1 | Routine | Low-impact change; auto-confirmed in lightweight mode, agent-proposed in standard |
| G2 | Significant | Affects domain constraints or behavior; requires human ratification in standard/institutional |
| G3 | Structural | Affects skeleton, DNA, or global behavior; always requires human ratification |

### Gravity Schema

Each event carries a composite gravity assessment:

| Field | Type | Description |
|-------|------|-------------|
| level | `"G0"` \| `"G1"` \| `"G2"` \| `"G3"` | Overall gravity level |
| architectural | `"low"` \| `"medium"` \| `"high"` | optional — impact on architecture |
| operational | `"low"` \| `"medium"` \| `"high"` | optional — impact on operations |
| local | `"low"` \| `"medium"` \| `"high"` | optional — impact on local domain |

### Gravity Modulation

The Trust Router may upgrade gravity based on:

- **Trauma**: events in a domain with existing trauma automatically upgrade gravity by one level
- **DNA traits**: if the project has a high `simplicity_bias` trait, events involving complex frameworks upgrade; if `infra_aggressiveness` is low, events involving new infrastructure upgrade

---

## Signals

Raw signals captured by Git ear, conversation ear, or calibration engine, stored in `signals/` subdirectories.

### Git Signal

Stored in `signals/raw_git/`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique signal ID |
| signal_type | enum | required | `revert`, `dependency_removed`, `dependency_replaced`, `large_refactor`, `commit_frequency_change`, `new_contributor`, `todo_fixme_cluster` |
| raw_data | object | `{}` | Evidence payload (commits, files_changed, packages, stats) |
| inferred_gravity | `"G0"` \| `"G1"` \| `"G2"` \| `"G3"` | required | Inferred gravity level |
| inferred_domain | string | optional | Inferred target domain |
| confidence | number (0-1) | required | Inference confidence |
| captured_at | string (ISO 8601) | required | Capture timestamp |

### Conversation Signal

Stored in `signals/raw_conversation/`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique signal ID |
| signal_type | enum | required | `user_rejection`, `historical_reference`, `constraint_declaration`, `decision`, `debt_acceptance`, `stage_constraint` |
| domain | string | optional | Target domain |
| details | object | required | Contains: what (string), reason (string?), rejected_alternatives (Array<{path, reason}>?), revisit_when (string[]?) |
| evidence | object | `{}` | Contains: user_said (string?), files_involved (string[]?), commit_ref (string?) |
| confidence | number (0-1) | required | Inference confidence |
| captured_at | string (ISO 8601) | required | Capture timestamp |

### Calibration Signal

Stored in `signals/raw_calibration/`. Generated by the Calibration Engine when drift is detected.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique signal ID |
| signal_type | enum | required | `calibration_conflict`, `skeleton_drift`, `debt_resolution_candidate`, `dna_drift_warning` |
| domain | string | optional | Target domain |
| description | string | required | Human-readable drift description |
| evidence | object | required | Contains: expected (string), actual (string), source (string) |
| inferred_gravity | `"G0"` \| `"G1"` \| `"G2"` \| `"G3"` | required | Inferred gravity level |
| confidence | number (0-1) | required | Confidence |
| captured_at | string (ISO 8601) | required | Capture timestamp |

### Example (Git Signal)

```yaml
# .cairn/signals/raw_git/sig_2026_05_11_001.yaml

id: sig_2026_05_11_001
signal_type: dependency_removed
raw_data:
    packages:
        removed:
            - tRPC
    commits:
        - a1b2c3d
        - e4f5g6h
inferred_gravity: G2
inferred_domain: api-layer
confidence: 0.85
captured_at: "2026-05-11T08:00:00Z"
```

---

## EvolutionEvent (Blood)

Evolution events are the source of truth. Each file in `blood/` is one event.

### Event Types

| Type | Description |
|------|-------------|
| `architecture_decision` | A structural or technology choice was made |
| `rejection` | A direction was evaluated and excluded |
| `transition` | Approach changed from A to B |
| `debt_acceptance` | A technical debt was deliberately accepted |
| `debt_resolution` | A previously accepted debt was resolved |
| `experiment_success` | An exploratory attempt succeeded |
| `experiment_failure` | An exploratory attempt failed |
| `incident` | A production or development incident with lessons |
| `constraint_added` | A new constraint was introduced |
| `constraint_removed` | An existing constraint was lifted |
| `stage_transition` | The project moved to a new lifecycle phase |

### Behavior Effect Types

| Type | AI Instruction |
|------|----------------|
| `avoid_suggestion` | Do not suggest this direction |
| `prefer_approach` | Prefer this approach |
| `warn_before` | Warn about risks before proceeding |
| `require_review` | Read domain history before suggesting |

### Source Types

| Type | Description |
|------|-------------|
| `git_revert` | Detected from a git revert |
| `git_dependency` | Detected from dependency manifest changes |
| `conversation` | Captured from AI-user conversation |
| `runtime_observed` | Observed at runtime |
| `human_explicit` | Explicitly stated by a human |
| `agent_inferred` | Inferred by AI agent |

### Health States

| State | Description |
|-------|-------------|
| `ok` | Healthy and active |
| `stale` | Not referenced recently, may need review |
| `conflicted` | Contradicts another active event |
| `resurrected` | Was archived but reactivated due to repeated references |

### Lifecycle Validity Levels

| Level | Description |
|-------|-------------|
| `transient` | Short-lived, expires quickly |
| `tactical` | Medium-term, review within months |
| `strategic` | Long-term, core to architecture |
| `identity` | Defines project DNA, near-permanent |

### Governance Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting review |
| `auto_confirmed` | System validated, no human review needed |
| `ratified` | Human reviewed and approved |

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique event ID |
| time | string (ISO 8601) | required | When the event occurred |
| domain | string | required | Domain key |
| type | enum | required | One of `EVENT_TYPES` |
| gravity.level | `"G0"` \| `"G1"` \| `"G2"` \| `"G3"` | required | Gravity level |
| gravity.architectural | `"low"` \| `"medium"` \| `"high"` | optional | Architectural impact |
| gravity.operational | `"low"` \| `"medium"` \| `"high"` | optional | Operational impact |
| gravity.local | `"low"` \| `"medium"` \| `"high"` | optional | Local domain impact |
| source.type | enum | required | One of `SOURCE_TYPES` |
| source.confidence | number (0-1) | required | Source confidence |
| source.verified | boolean | `false` | Whether source is verified |
| source.refs | Array<{type, id}> | `[]` | Reference list |
| subject.type | `"technology"` \| `"architecture"` \| `"domain"` \| `"dependency"` \| `"constraint"` | optional | Subject category |
| subject.name | string | required | Subject identifier |
| trigger | string | required | What triggered this event |
| decision_or_change | string | required | The decision or change that was made |
| rejected_paths | Array<{path, reason}> | `[]` | Alternatives considered and rejected |
| reasoning | string | required | Why this decision was made |
| constraints_added | string[] | `[]` | New constraints introduced |
| constraints_removed | string[] | `[]` | Constraints lifted |
| accepted_debt | string[] | `[]` | Debt items accepted |
| behavior_effect.type | enum | required | One of `BEHAVIOR_EFFECT_TYPES` |
| behavior_effect.instruction | string | required | Concrete AI instruction |
| affects.skeleton | boolean | `false` | Whether this affects the skeleton |
| affects.dna | boolean | `false` | Whether this affects DNA |
| affects.domains | string[] | `[]` | Other domains affected |
| future_implications | string | optional | Anticipated future impact |
| lifecycle.validity | enum | required | `transient`, `tactical`, `strategic`, `identity` |
| lifecycle.review_after | string (ISO 8601) | optional | When to review this event |
| lifecycle.decay_policy | `"downgrade"` \| `"expire"` \| `"permanent"` | `"downgrade"` | What happens when stale |
| lifecycle.resurrection_count | number | `0` | Times resurrected from archive |
| revisit.when | string[] | `[]` | Conditions for re-evaluation |
| revisit.status | `"not_met"` \| `"possibly_met"` \| `"met"` | `"not_met"` | Current revisit state |
| supersedes | string \| null | `null` | ID of event this supersedes |
| conflicts_with | string[] | `[]` | IDs of conflicting events |
| related | string[] | `[]` | IDs of related events |
| health.state | enum | `"ok"` | One of `HEALTH_STATES` |
| health.reason | string \| null | `null` | Reason if unhealthy |
| trauma.is_trauma | boolean | `false` | Whether this is a cognitive trauma |
| trauma.sensitivity_multiplier | number | `1.0` | Gravity boost factor |
| trauma.decay_override | `"permanent"` \| null | `null` | Override decay policy |
| trauma.affects_dna | boolean | `false` | Whether trauma affects DNA |
| trauma.requires_human_ratification | boolean | `true` | Whether trauma requires human approval |
| created_at | string (ISO 8601) | required | Creation timestamp |
| updated_at | string (ISO 8601) | required | Last update timestamp |
| governance_status | enum | required | `pending`, `auto_confirmed`, `ratified` |

### Example

```yaml
# .cairn/blood/evt_2024_03_api_tRPC_rejection.yaml

id: evt_2024_03_api_tRPC_rejection
time: "2024-03-15T10:00:00Z"
domain: api-layer
type: rejection

gravity:
    level: G2
    architectural: medium
    local: high

source:
    type: git_revert
    confidence: 0.86
    verified: true
    refs:
        - type: commit
          id: a1b2c3d
        - type: session
          id: sess_2024_03_15_001

subject:
    type: technology
    name: tRPC

trigger: "tRPC dependency removed after 2-week trial"
decision_or_change: "Reverted tRPC migration, staying with REST + OpenAPI"
rejected_paths:
    - path: "tRPC migration"
      reason: "REST client retrofit cost outweighed tRPC type-safety benefits"
reasoning: "Integration cost with existing REST clients was prohibitive for a team of 2"

constraints_added:
    - "Do not suggest tRPC unless revisit conditions are met"
constraints_removed: []
accepted_debt: []

behavior_effect:
    type: avoid_suggestion
    instruction: "Do not suggest migrating to tRPC unless revisit conditions are met"

affects:
    skeleton: false
    dna: false
    domains:
        - api-layer

lifecycle:
    validity: strategic
    review_after: "2025-03-15T00:00:00Z"
    decay_policy: downgrade
    resurrection_count: 0

revisit:
    when:
        - "All existing REST clients replaced"
        - "New greenfield API service started"
    status: not_met

supersedes: null
conflicts_with: []
related:
    - evt_2024_03_api_openapi_decision

health:
    state: ok
    reason: null

trauma:
    is_trauma: false
    sensitivity_multiplier: 1.0
    decay_override: null
    affects_dna: false
    requires_human_ratification: true

created_at: "2024-03-15T10:00:00Z"
updated_at: "2024-03-15T10:00:00Z"
governance_status: ratified
```

---

## SkeletonNode

Each file in `skeleton/` defines one domain's structural boundaries.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| domain | string | required | Domain key |
| role | string | required | What this domain is responsible for |
| owns | string[] | `[]` | Capabilities this domain owns |
| does_not_own | string[] | `[]` | Capabilities explicitly excluded |
| stability | `"stable"` \| `"evolving"` \| `"unstable"` | `"stable"` | Current stability |
| dependencies | string[] | `[]` | Other domains this depends on |
| causal_keywords | string[] | `[]` | Keywords that trigger this domain's context |

### Example

```yaml
# .cairn/skeleton/api-layer.yaml

domain: api-layer
role: "HTTP API design, routing, and client communication"
owns:
    - REST endpoint design
    - API versioning
    - Request/response schemas
does_not_own:
    - Database queries
    - Authentication logic
stability: stable
dependencies:
    - auth
    - database
causal_keywords:
    - endpoint
    - route
    - API
    - REST
    - request
    - response
```

---

## DNAIdentity

Stored at `dna/identity.yaml`. Represents the emerged project personality — trait patterns compressed from accumulated evolution events.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| traits | Record<string, DNATrait> | `{}` | Named trait map |
| status | `"not_yet_emerged"` \| `"emerging"` \| `"emerged"` | `"not_yet_emerged"` | Emergence status |
| reevaluation_mode | boolean | `false` | Suppresses DNA modulation when true |
| compression_threshold.min_evidence | number | `3` | Minimum events before trait can emerge |
| compression_threshold.min_timespan_months | number | `3` | Minimum months of data |
| compression_threshold.min_confidence | number | `0.6` | Minimum confidence to solidify |

### DNATrait

| Field | Type | Description |
|-------|------|-------------|
| level | `"low"` \| `"medium"` \| `"high"` | Trait strength |
| confidence | number (0-1) | How certain we are |
| evidence_count | number | Number of supporting events |
| last_updated | string (ISO 8601) | Last update timestamp |
| reasoning | string | Why this level was assigned |

### Example

```yaml
# .cairn/dna/identity.yaml

traits:
    simplicity_bias:
        level: high
        confidence: 0.78
        evidence_count: 7
        last_updated: "2026-04-10T00:00:00Z"
        reasoning: "Consistently rejected complex frameworks (tRPC, GraphQL); chose simpler alternatives"
    infra_aggressiveness:
        level: low
        confidence: 0.65
        evidence_count: 4
        last_updated: "2026-04-10T00:00:00Z"
        reasoning: "Avoided new infrastructure unless forced; delayed K8s migration twice"
status: emerged
reevaluation_mode: false
compression_threshold:
    min_evidence: 3
    min_timespan_months: 3
    min_confidence: 0.6
```

## DNAImprint

Stored at `dna/imprint.yaml`. Used when a project is forked or inherits constraints from a parent project.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| inherited_from | string | required | Parent project identifier |
| inherited_at | string (ISO 8601) | required | When inheritance occurred |
| inherited_constraints | string[] | `[]` | Constraint strings carried over |
| inherited_warnings | Array<{domain, warning}> | `[]` | Domain-specific warnings |
| identity_status | `"not_yet_emerged"` | `"not_yet_emerged"` | Always starts unemerged |

---

## DomainCapillary

Each file in `domains/` is an auto-generated per-domain projection from blood events.

### DomainConstraints

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| domain | string | required | Domain key |
| constraints | Array<{what, reason, source_event, gravity}> | `[]` | Active constraints |

### DomainAcceptedDebt

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| domain | string | required | Domain key |
| debts | Array<{what, reason, source_event, revisit_when}> | `[]` | Active accepted debt |

### DomainRejectedPaths

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| domain | string | required | Domain key |
| paths | Array<{path, reason, source_event}> | `[]` | Rejected directions |

### Example

```yaml
# .cairn/domains/api-layer.yaml

constraints:
    domain: api-layer
    constraints:
        - what: "No tRPC"
          reason: "REST client retrofit cost too high"
          source_event: evt_2024_03_api_tRPC_rejection
          gravity: G2

accepted_debt:
    domain: api-layer
    debts: []

rejected_paths:
    domain: api-layer
    paths:
        - path: "tRPC migration"
          reason: "REST client retrofit cost outweighed type-safety benefits"
          source_event: evt_2024_03_api_tRPC_rejection
```

---

## StagedEntry

Entries awaiting human review. Created when Trust Router determines governance requires approval.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| id | string | required | Unique staged entry ID |
| origin_signal | string | optional | Source signal ID |
| draft_event | EvolutionEvent | required | Full draft evolution event |
| review_status | `"pending"` \| `"accepted"` \| `"rejected"` \| `"expired"` | `"pending"` | Current review state |
| routing_reason | string | required | Why this was routed to staged |
| gravity | `"G0"` \| `"G1"` \| `"G2"` \| `"G3"` | required | Gravity level |
| governance_required | `"auto_confirmable"` \| `"human_ratified"` | required | Required governance level |
| created_at | string (ISO 8601) | required | Creation timestamp |

### Example

```yaml
# .cairn/staged/staged_2026_05_11_api_trpc.yaml

id: staged_2026_05_11_api_trpc
origin_signal: sig_2026_05_11_001
draft_event:
    id: evt_2024_03_api_tRPC_rejection
    time: "2024-03-15T10:00:00Z"
    domain: api-layer
    type: rejection
    gravity:
        level: G2
    source:
        type: git_revert
        confidence: 0.86
        verified: true
        refs:
            - type: commit
              id: a1b2c3d
    subject:
        name: tRPC
    trigger: "tRPC removed after trial"
    decision_or_change: "Reverted tRPC, staying with REST"
    rejected_paths: []
    reasoning: "Integration cost prohibitive"
    behavior_effect:
        type: avoid_suggestion
        instruction: "Do not suggest tRPC"
    lifecycle:
        validity: strategic
        decay_policy: downgrade
        resurrection_count: 0
    health:
        state: ok
        reason: null
    trauma:
        is_trauma: false
        sensitivity_multiplier: 1.0
        decay_override: null
        affects_dna: false
        requires_human_ratification: true
    created_at: "2024-03-15T10:00:00Z"
    updated_at: "2024-03-15T10:00:00Z"
    governance_status: pending
review_status: pending
routing_reason: "G2 event in standard mode requires human ratification"
gravity: G2
governance_required: human_ratified
created_at: "2026-05-11T08:00:00Z"
```

---

## state.yaml

Runtime state managed by the server.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| initialization_status | `"not_initialized"` \| `"partial"` \| `"complete"` | `"not_initialized"` | Bootstrap status |
| last_session.commit | string \| null | `null` | Last processed commit hash |
| last_session.ended_at | string \| null | `null` | Last session end time |
| stage | StageSnapshot | see below | Project lifecycle phase |
| activation_log.recent_hits | Record<string, number> | `{}` | Event ID to recent hit count (for resurrection) |

### StageSnapshot

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| phase | `"exploration"` \| `"growth"` \| `"maturity"` \| `"maintenance"` | `"exploration"` | Current phase |
| confidence | number (0-1) | `0` | Inference confidence |
| status | `"advisory"` \| `"confirmed"` | `"advisory"` | Whether human-confirmed |
| evidence | Array<{source, signal}> | `[]` | Supporting evidence |
| guidance | string[] | `[]` | Stage-appropriate suggestions |
| last_updated | string (ISO 8601) | optional | Last update timestamp |

### Example

```yaml
# .cairn/state.yaml

initialization_status: complete

last_session:
    commit: abc1234
    ended_at: "2026-05-11T12:30:00Z"

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

activation_log:
    recent_hits:
        evt_2024_03_api_tRPC_rejection: 3
```

---

## Governance

### Policy

Stored at `governance/policy.yaml`. Derived from `config.yaml` cognitive_mode.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| cognitive_mode | `"lightweight"` \| `"standard"` \| `"institutional"` | `"standard"` | Active cognitive mode |

### Audit Log

Stored at `governance/audit.yaml`. Append-only record of all governance actions.

| Field | Type | Description |
|-------|------|-------------|
| time | string (ISO 8601) | When the action occurred |
| action | enum | `ratified`, `auto_confirmed`, `rejected`, `archived`, `resurrected`, `trauma_marked`, `trauma_removed`, `dna_updated`, `skeleton_updated`, `stage_confirmed` |
| target | string | ID of the affected entity |
| actor | `"human"` \| `"system"` \| `"agent"` | Who performed the action |
| reason | string | optional — why this action was taken |
| evidence | string | optional — supporting evidence |

### Example

```yaml
# .cairn/governance/audit.yaml

- time: "2026-05-11T10:00:00Z"
  action: ratified
  target: evt_2024_03_api_tRPC_rejection
  actor: human
  reason: "Confirmed tRPC rejection based on git revert evidence"
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
| signals_routed.G0 | number | `0` | Signals dropped |
| signals_routed.G1 | number | `0` | Signals at G1 |
| signals_routed.G2 | number | `0` | Signals at G2 |
| signals_routed.G3 | number | `0` | Signals at G3 |
| domains_touched | string[] | `[]` | Domains affected |
| decisions_made | string[] | `[]` | Decisions recorded |
| unresolved | string[] | `[]` | Unresolved items |

### Example

```yaml
# .cairn/sessions/sess_2026_05_11_001.yaml

id: sess_2026_05_11_001
started_at: "2026-05-11T10:00:00Z"
ended_at: "2026-05-11T12:30:00Z"
summary: "Refactored auth module from session-based to JWT"
signals_captured: 3
signals_routed:
    G0: 0
    G1: 1
    G2: 1
    G3: 1
domains_touched:
    - auth
    - api-layer
decisions_made:
    - "Auth migrated from session to JWT"
unresolved:
    - "JWT refresh token storage location undecided"
```

---

## Views Generation Rules

Views are auto-generated Markdown projections of `blood/`. They are read-only. Every view file begins with:

```markdown
<!--
Generated by Cairn. Do not edit manually.
Source: .cairn/blood/*.yaml
Last generated: <ISO 8601 timestamp>
-->
```

### views/output.md

Global constraint snapshot injected at every AI session start.

| Section | Source Filter |
|---------|-------------|
| no-go | `behavior_effect.type == 'avoid_suggestion'`, health `ok` or `resurrected` |
| stack | `type == 'architecture_decision'` with `prefer_approach`, health `ok` |
| debt | `type == 'debt_acceptance'`, health `ok` |
| hooks | `skeleton/` causal_keywords + domain constraints from `domains/` |
| stage | `state.yaml` stage snapshot |
| dna | `dna/identity.yaml` emerged traits summary |

**Token budget:** target 500, hard limit 800. When over limit, prioritize `behavior_effect.type == 'avoid_suggestion'` entries.

### views/domains/\<name\>.md

Per-domain design context, injected on demand.

| Section | Source Filter |
|---------|-------------|
| trajectory | All active events in domain, sorted by `time` |
| rejected paths | `type == 'rejection'` |
| known pitfalls | `behavior_effect.type == 'warn_before'` |
| open questions | `revisit.status == 'possibly_met'` |
| constraints | From `domains/<name>.yaml` constraints |
| accepted debt | From `domains/<name>.yaml` debts |

**Token budget:** target 300 per file, hard limit 500.

### views/stage.md

Stage advisory detail view, generated from `state.yaml` stage snapshot. Contains phase, confidence, status, evidence list, and guidance list.

---

## Trust Router

All signals must pass through the Trust Router. No signal bypasses it.

### Routing Destinations

| Destination | Storage | Behavior |
|-------------|---------|----------|
| `dropped` | None | G0 noise, duplicates — discarded |
| `staged` | staged/ | Requires review (human_ratified or agent_proposed) |
| `blood` | blood/ | Written directly (system_validated or merged duplicate) |

### 3-Tier Governance

| Tier | Name | When Applied |
|------|------|-------------|
| `agent_proposed` | Agent Proposed | G1 in standard mode — agent suggests, confirmation optional |
| `system_validated` | System Validated | G0 drops and auto-confirmed low-gravity events |
| `human_ratified` | Human Ratified | Events affecting skeleton, DNA, trauma, stage transitions; G3 always; G2+ in standard/institutional |

### Routing Flow

```
Signal enters Trust Router
  |
  +-> Duplicate? (same domain + same subject + same type)
  |     Yes -> Merge into existing event in blood/ -> done
  |     No  -> Continue
  |
  +-> Hard governance rule?
  |     (isTrauma OR affectsSkeleton OR affectsDna OR isStageTransition)
  |     Yes -> staged/ with human_ratified
  |     No  -> Continue
  |
  +-> Domain has trauma history?
  |     Yes -> Upgrade gravity by one level
  |     No  -> Continue
  |
  +-> DNA modulation (if not in reevaluation_mode)
  |     High simplicity_bias + complex framework -> Upgrade gravity
  |     Low infra_aggressiveness + new infrastructure -> Upgrade gravity
  |
  +-> G0?
  |     Yes -> dropped
  |     No  -> Continue
  |
  +-> Governance Engine check (mode-dependent)
  |     human_ratified  -> staged/
  |     agent_proposed  -> staged/
  |     system_validated -> blood/ (auto-confirmed)
```

### Hard Rules (non-configurable)

- Trauma events -> always staged, human_ratified
- Affects skeleton -> always staged, human_ratified
- Affects DNA -> always staged, human_ratified
- Stage transitions -> always staged, human_ratified
- G3 events -> always human_ratified

---

## ID Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| EvolutionEvent | `evt_<YYYY_MM>_<domain>_<slug>` | `evt_2024_03_api_tRPC_rejection` |
| Signal (git) | `sig_<YYYY_MM_DD>_<seq>` | `sig_2026_05_11_001` |
| Signal (conversation) | `csig_<YYYY_MM_DD>_<seq>` | `csig_2026_05_11_001` |
| Signal (calibration) | `cal_<YYYY_MM_DD>_<seq>` | `cal_2026_05_11_001` |
| StagedEntry | `staged_<YYYY_MM_DD>_<domain>_<slug>` | `staged_2026_05_11_api_trpc` |
| Session | `sess_<YYYY_MM_DD>_<seq>` | `sess_2026_05_11_001` |

Domain keys use `kebab-case`.
