[中文](DESIGN.zh.md) | English

# Cairn — Design Document (V3)

> Status: AI-native engineering cognition engine.

---

## Naming

A cairn is a stack of rocks left by hikers at trail junctions and summits. Before GPS,
climbers marked their progress by piling stones at critical points: this route goes
through, that ridge is a dead end, turn here. Later travelers did not need to rediscover
every wrong turn. The judgment of everyone who came before was already stacked at the
side of the path.

That is the role Cairn plays for AI coding assistants.

Each evolution event is one stone. Each rejected path is one stone. Each trauma is one
stone. The more complete the cairn, the less likely anyone who comes after — whether a
new human developer or an AI starting a fresh session — is to go off course.

---

## The Problem

Software projects accumulate constraints through path dependency. AI coding tools cannot
perceive this — they have no memory between sessions. The result is a recurring pattern
where AI repeatedly proposes directions that were already tried and rejected.

This is not a model capability problem. The information AI needs does not exist in a
form it can use. Documentation is for humans. ADRs describe what was decided but don't
tell AI what to avoid proposing or under what conditions a past rejection might be
worth revisiting.

---

## V3 Architecture: Cognitive Thermodynamics

V3 models project memory as a thermodynamic system with six continuous processes:

1. **Sedimentation** — Signals enter and accumulate (Git ear, Conversation ear, Calibration ear)
2. **Routing** — Trust Router assigns Gravity (G0–G3) and routes to blood or staged
3. **Activation** — Causal retrieval pipeline: Task → Skeleton → Capillary → Blood → DNA → Context
4. **Decay** — Unused events age and become stale; trauma events are exempt
5. **Compression** — Repeated patterns compress into DNA traits
6. **Resurrection** — Archived events that keep getting referenced are revived

### Core Data Structures

| Structure | Role | Storage |
|-----------|------|---------|
| **Skeleton** | Domain ownership map (role, owns, does_not_own, causal_keywords) | `skeleton/` |
| **Blood** | Evolution events — the cognitive atom with full lifecycle | `blood/` |
| **DNA** | Emergent project personality traits | `dna/` |
| **Capillaries** | Per-domain constraint channels (constraints, debt, rejected paths) | `domains/` |
| **Staged** | Events awaiting human review | `staged/` |
| **Views** | Auto-generated projections for AI consumption | `views/` |

---

## Gravity System (G0–G3)

Replaces V2's L0–L3 trust levels. Gravity measures the weight of a cognitive signal.

| Level | Name | Behavior |
|-------|------|----------|
| G0 | Drop | Noise, duplicates — discarded |
| G1 | Suggestion | AI proposes, no human approval needed |
| G2 | Reflective Challenge | AI must present reasoning and alternatives |
| G3 | Hard Constraint | Requires human ratification before entering blood |

Gravity is multi-dimensional: `architectural`, `operational`, `local` — each can be
low/medium/high. The `level` field (G0–G3) is the primary routing key.

### DNA Modulation

DNA traits modify gravity at routing time. Example: if `simplicity_bias` is high,
introducing a complex framework automatically upgrades gravity.

### Trauma Modulation

Domains with trauma events permanently increase gravity for new signals in that domain.

---

## Trust Router v3

All signals must pass through the Trust Router. No signal bypasses it.

```
Signal enters Trust Router
  │
  ├→ Duplicate? → Merge into existing event → dropped
  │
  ├→ Governance hard rules? (G3, DNA changes, trauma) → staged + human_ratified
  │
  ├→ Trauma domain? → Upgrade gravity
  │
  ├→ DNA modulation? → Adjust gravity based on personality traits
  │
  ├→ Gravity routing:
  │     G0 → dropped
  │     G1 → blood (auto or system_validated based on cognitive_mode)
  │     G2 → staged or blood (depends on cognitive_mode)
  │     G3 → staged + human_ratified
  │
  └→ Return routing result
```

---

## Governance: Three-Tier Permissions

| Tier | Description | When |
|------|-------------|------|
| `agent_proposed` | AI writes without validation | G0–G1 in lightweight mode |
| `system_validated` | System checks pass, no human needed | G1 in standard/institutional |
| `human_ratified` | Requires explicit human approval | G2+ in standard, all trauma, all DNA changes |

### Cognitive Modes

| Mode | G_min for human approval | Decay speed | DNA evidence threshold |
|------|--------------------------|-------------|----------------------|
| `lightweight` | G3 only | Fast (30/60 days) | 5 events |
| `standard` | G2+ | Medium (90/120 days) | 3 events |
| `institutional` | G1+ | Slow (180/240 days) | 3 events |

---

## Cognitive Trauma

Trauma events are permanent memory markers that can never decay. They:

- Set `decay_override: permanent`
- Apply `sensitivity_multiplier: 2.0` to the affected domain
- Always require `human_ratified` governance
- Affect DNA traits (`affects_dna: true`)

Any new signal in a trauma domain gets its gravity upgraded automatically.

---

## Five Consistency Rules

The Consistency Engine validates cross-subsystem coherence:

1. **DNA-Event Consistency** — High DNA traits shouldn't contradict recent high-gravity events
2. **No-Go Support** — No-go events with stale health are orphaned constraints
3. **Skeleton-Reality** — Skeleton ownership should match code reality (stub in V3.0)
4. **Archived Reactivation** — Archived events with many recent hits should be resurrected
5. **Constraint Consistency** — Same subject can't have both avoid and prefer effects

---

## Dual-Ear Design + Calibration Ear

### Git Ear

Detects reverts, dependency changes, large refactors from git history. Maps changed
files to skeleton domains using causal keywords.

### Conversation Ear

Captures user rejections, constraint declarations, decisions, debt acceptance during
AI conversations via the `cairn_signal` MCP tool.

### Calibration Ear

Compares code reality against cognitive state: detects no-go dependencies still present
in package.json, skeleton drift, and DNA inconsistencies.

---

## Blood / Views Separation

**`blood/` is source data.** Each evolution event is a YAML file with full provenance,
gravity, lifecycle metadata, trauma flags, and governance status.

**`views/` is projection.** `output.md`, `domains/*.md`, and `stage.md` are aggregated
from blood events, skeleton, DNA, and domain capillaries. Views can be regenerated
from source data at any time.

### Token Budgets

- `output.md` — target 500 tokens, hard limit 800
- `domains/*.md` — target 300 tokens per file, hard limit 500

---

## Design Principles

### 1. Headless cognitive runtime

Cairn stores, validates, and routes. The host AI interprets. Cairn has no LLM — it is
pure data engine with rule-based intelligence.

### 2. Human review authority is non-bypassable

Any event that changes global behavior — G2+ events, trauma, DNA changes — must pass
through human ratification. No configuration can bypass this gate.

### 3. Facts and speculation are separated

`cairn_plan` is read-only. AI planning speculation never becomes project memory.

### 4. Progressive trust through Gravity

Signals enter with assessed gravity, may be upgraded by DNA/trauma modulation, and
are routed accordingly. There is no mechanism to skip governance checks.

### 5. Cognition doesn't rot

Six continuous processes (sedimentation, routing, activation, decay, compression,
resurrection) maintain thermodynamic balance. `cairn_doctor` validates consistency.

---

## Tool Compatibility

Cairn operates as an MCP server (stdio transport). 11 tools form the complete
cognition lifecycle: init, context activation, signal capture, session management,
governance review, and health diagnostics.

For AI tools without MCP support, `views/` provides a degradation path via Skill
adapter files.

| Tool | MCP Support | Fallback |
|------|-------------|----------|
| Claude Code | Native MCP | views/ via CLAUDE.md |
| Cursor | Native MCP | views/ via cairn.mdc |
| Cline / Roo Code | Native MCP | views/ via .clinerules |
| Windsurf | Native MCP | views/ via .windsurfrules |
| GitHub Copilot | — | views/ via copilot-instructions.md |
| Codex CLI | — | views/ via AGENTS.md |
| Gemini CLI | — | views/ via GEMINI.md |
