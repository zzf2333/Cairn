# Glossary

Terms used across Cairn docs and source. Organized by conceptual dependency. Look up on demand; not designed to read top-to-bottom.

---

## Project as cognition

### Cognitive organism
A software project modeled not as a static codebase but as a path-dependent living system whose history shapes its present.

### Path dependence
The property that a project's current state cannot be derived from current code alone — it requires history, especially rejection history.

### Cognitive thermodynamics
Cairn's framing: cognition decays without effort (entropy ↑); Cairn is the active maintenance that pumps energy back in via decay → resurrection → calibration → compression cycles.

---

## The six organs

### Skeleton
Domain ownership map. Per-domain YAML at `.cairn/skeleton/<domain>.yaml`. Declares what each domain owns, doesn't own, depends on. Causal index for activation. See [`../ii-anatomy/skeleton.md`](../ii-anatomy/skeleton.md).

### Capillaries
Per-domain constraint detail. `.cairn/domains/<domain>/{constraints,accepted_debt,rejected_paths}.yaml`. Auto-synced from Blood. See [`../ii-anatomy/capillaries.md`](../ii-anatomy/capillaries.md).

### Blood
Evolution events — the stream of confirmed cognitive history. `.cairn/blood/<id>.yaml`. 40-field records. Append in spirit; archive (`health.state = stale`) instead of delete. See [`../ii-anatomy/blood.md`](../ii-anatomy/blood.md).

### DNA
Emergent project personality. `.cairn/dna/identity.yaml`. Traits (`simplicity_bias`, `infra_aggressiveness`) compressed from repeated Blood patterns. Always human-ratified. See [`../ii-anatomy/dna.md`](../ii-anatomy/dna.md).

### Gravity
Decision weight axis, four levels: G0 (noise, dropped) / G1 (local, auto-confirmed) / G2 (module-scoped, staged) / G3 (project-defining, always staged). See [`../ii-anatomy/gravity.md`](../ii-anatomy/gravity.md).

### Governance
Two-tier approval ladder: `system_validated` → `human_ratified`. Required level depends on cognitive mode. See [`../ii-anatomy/governance.md`](../ii-anatomy/governance.md).

---

## Mechanisms

### Signal
A raw observation: git pattern, conversation turn, calibration check. Becomes an Evolution Event after TrustRouter.

### TrustRouter
Central routing engine. Every signal traverses 9 steps: validate → dedup → governance floor → trauma adjacency → DNA modulation → final gravity → destination → audit. See [`../iv-self/trust-router.md`](../iv-self/trust-router.md).

### Evolution Event
Canonical record. 40 fields covering origin, intent, behavioral effect, lifecycle, trauma status. Lives in `.cairn/blood/`. Schema in [`schema.md`](./schema.md).

### Trauma
Flag on Blood events marking scar tissue from real incidents. Trauma events: never decay, gravity ≥ G2 floor, always staged (never auto-confirmed), raise per-domain challenge sensitivity, sort first in activation. See [`../iii-life/trauma.md`](../iii-life/trauma.md).

### Reevaluation mode
DNA safety valve. When calibration detects severe drift, `identity.yaml.reevaluation_mode` flips to `true`; all traits stop modulating until human review via `cairn dna reevaluate`. See [`../iv-self/reevaluation.md`](../iv-self/reevaluation.md).

### Decay
The forgetting process. Events past the cognitive-mode-specific window are marked `stale` (archived) or `downgraded` one gravity level. Trauma exempt. See [`../iii-life/decay-and-resurrection.md`](../iii-life/decay-and-resurrection.md).

### Resurrection
Reverse of decay. Archived events with ≥ 5 hits in 30 days become candidates. G0/G1 auto-resurrect via `cairn doctor`; G2+ require human review.

### Compression
DNA emergence. `CompressionEngine` watches Blood for repeated patterns (≥ 3 events, ≥ 3 months, confidence ≥ 0.6) and proposes DNA candidates. Human-ratified before promotion. See [`../iii-life/compression.md`](../iii-life/compression.md).

### Calibration
Reality check. `CalibrationEar` scans code + git + Blood for inconsistencies. Four signal types: `no_go_violation`, `skeleton_drift`, `debt_resolution`, `dna_drift`. See [`../iv-self/calibration.md`](../iv-self/calibration.md).

### Activation
Causal retrieval. `cairn_context` → task → skeleton match → expand to domain capillaries → traverse Blood → return structured context bundle.

### Challenge
Cairn's pushback. Three levels: `suggestion` (acknowledge), `reflective_challenge` (must justify in writing), `hard_constraint` (do not proceed without explicit override).

---

## Modes and strictness

### Cognitive mode
Per-project knob in `config.yaml`. Controls governance strictness, decay timing, challenge thresholds:

| Mode | Approval | Decay | DNA min evidence |
|------|----------|-------|------------------|
| `lightweight` | G3 only | 30/60 days | 5 |
| `standard` | G2+ | 90/120 days | 3 |
| `institutional` | G1+ | 180/240 days | 3 |

Choose by overhead tolerance, not project size.

### Stage
Project phase. Inferred by `StageEngine` from commit cadence (14-day hysteresis, confidence ≥ 0.6):
- `exploration` — new deps OK
- `growth` — balance speed and stability
- `maturity` — conservative changes
- `maintenance` — bug fixes + critical security only (`reflective_challenge` strength)

---

## On-disk artifacts

### `.cairn/`
Cognition directory. YAML, git-tracked by design. Top-level: `config.yaml`, `state.yaml`, `skeleton/`, `blood/`, `staged/`, `domains/`, `dna/`, `signals/`, `governance/`, `views/`, `sessions/`, `logs/`. See [`stability.md`](./stability.md) for the stability contract per directory.

### Views
Auto-generated markdown projections at `.cairn/views/`. Consumed by AI tools in degraded mode (when CLI is unavailable). Regenerated on every `cairn_session_end` and `cairn doctor`. Never hand-edit.

### Imprint
DNA inheritance from a forked parent project (`.cairn/dna/imprint.yaml`). Carries `inherited_constraints` + `inherited_warnings`.

---

## Compared to neighbors

| Cairn concept | Closest analog | Difference |
|---------------|----------------|------------|
| Evolution Event | ADR / RFC | Active (read at decision time) vs passive (read when remembered) |
| Skeleton | Module READMEs | Causal index, machine-readable |
| DNA | Engineering principles | Emerged from evidence, revocable |
| Trauma | Postmortem | First-class on-disk record that raises future challenge strength |
| Stage | Phase tag | Auto-inferred from commit cadence |

---

## Acronyms

- **ADR** — Architecture Decision Record
- **MCP** — Model Context Protocol (historical; Cairn used MCP as transport in v0.1–v0.4, replaced by Skill + CLI in v0.5)
- **G0–G3** — Gravity levels
- **SLO** — Service-level objective

---

## See also

- [`schema.md`](./schema.md) — exact field-level reference
- [`../ii-anatomy/`](../ii-anatomy/) — each organ in depth
- [`../i-origin/`](../i-origin/) — the conceptual foundation
