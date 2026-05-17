[中文](README.zh.md) | English

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>Give your AI the project context of a colleague who's been here for two years.</strong></p>

<p>
  <a href="https://github.com/zzf2333/Cairn/stargazers"><img src="https://img.shields.io/github/stars/zzf2333/Cairn?style=flat-square&color=f59e0b" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/cairn-mcp-server"><img src="https://img.shields.io/npm/v/cairn-mcp-server?style=flat-square&label=mcp%20server&color=2563eb" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="License MIT"/></a>
  <img src="https://img.shields.io/badge/node-18%2B-6b7280?style=flat-square" alt="Node 18+"/>
</p>

</div>

---

Cairn is an AI-native engineering cognition engine. It captures project decisions,
rejected paths, and accepted trade-offs from Git history and AI conversations, routes
them through a gravity-based trust system, and serves structured constraints that AI
coding assistants consume as behavioral guardrails.

---

## The Problem

Your project is 18 months old. In month 7, you migrated from Redux to Zustand — the boilerplate
cost wasn't worth it for a two-person team. In month 11, you tried tRPC, hit integration
issues with your existing REST clients, and rolled back. Neither decision is documented
anywhere except your memory.

Today, you open a new AI session to refactor a module.

> **AI suggestion #1:** Use Redux Toolkit.  
> **AI suggestion #2:** Migrate your API layer to tRPC.

Both are reasonable — if you don't know the history. You spend 10 minutes explaining what's
already been ruled out. Next week, same session, same loop.

This isn't a model capability problem. Claude, GPT, Gemini — they're all smart enough. They
just don't know **what this specific project has already tried and why it didn't work.**

Every new session, AI is a brilliant architect who just walked in. Cairn gives it the project
memory of a colleague who's been here from the start.

![Problem vs Solution](docs/diagrams/01-problem-vs-solution.png)

---

## What is Cairn

Cairn is an **AI-native engineering cognition engine** — it captures, routes, stores,
and serves project constraints so that AI works within your project's real history instead
of suggesting in a vacuum.

| What AI tools handle today | What Cairn adds |
|---------------------------|-----------------|
| Coding style, naming conventions | Rejected directions and why |
| Current tech stack and architecture | Stage-aware constraints (MVP vs growth) |
| What's being built now | Accepted debt that should not be touched |
| How to write code | What paths have already been walked |

---

## Architecture

Cairn V3 is built on six core subsystems:

| Subsystem | Role |
|-----------|------|
| **Skeleton** | Domain ownership map — which module owns what, stability level, causal keywords |
| **Blood** | Evolution events — every decision, rejection, transition, and debt acceptance |
| **DNA** | Emergent project personality — traits that compress from repeated patterns |
| **Capillaries** | Per-domain constraint projections — constraints, rejected paths, accepted debt |
| **Gravity** | Signal weight system (G0–G3) replacing V2's L0–L3 trust levels |
| **Governance** | 3-tier validation: agent_proposed, system_validated, human_ratified |

### How It Works

Cairn captures project signals from two sources, routes them through a gravity-based
trust system, and serves the results as structured constraints.

![How It Works](docs/diagrams/04-how-it-works.png)

**Signal capture:**
- **Git Ear** detects reverts, dependency changes, large refactors, commit patterns
- **Conversation Ear** captures user rejections, decisions, constraints, debt acceptance
- **Calibration Ear** detects skeleton drift, consistency conflicts, DNA drift warnings

**Gravity System (G0–G3):**
- **G0 Drop** — noise or duplicates, discarded
- **G1 Suggestion** — low-weight signal, stored for potential future use
- **G2 Reflective Challenge** — significant enough to challenge AI assumptions
- **G3 Hard Constraint** — must be respected, no exceptions

**Blood → Views → Constraints:**
- `blood/` stores evolution events (structured YAML, git-diff-friendly)
- `views/` is auto-generated (token-budget-aware Markdown for AI consumption)
- AI calls `cairn_context()` to get filtered constraints for the current task

![Signal Pipeline](docs/diagrams/02-three-layer-architecture.png)

### Cognitive Modes

Cairn adapts its behavior intensity to project needs:

| Mode | Governance Threshold | Decay | Best For |
|------|---------------------|-------|----------|
| `lightweight` | G3 only | Aggressive (30/60 days) | Solo projects, experiments |
| `standard` | G2+ | Moderate (90/120 days) | Small teams, most projects |
| `institutional` | G1+ | Conservative (180/240 days) | Large teams, regulated industries |

### Four Constraint Behaviors

Every evolution event declares a `behavior_effect`:

| Type | AI Behavior |
|------|-------------|
| `avoid_suggestion` | AI MUST NOT suggest this direction |
| `prefer_approach` | AI should prefer this approach |
| `warn_before` | AI should warn before touching this area |
| `require_review` | Changes need human sign-off |

---

## Quick Start

### 1. Install

Requires Node.js 18+.

```bash
npm install -g cairn-mcp-server
```

<details>
<summary>Install from source</summary>

```bash
git clone https://github.com/zzf2333/Cairn
cd Cairn/mcp && npm install && npm run build
```

</details>

### 2. Configure MCP

Add cairn to your AI tool's MCP configuration:

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

Config file locations:

| Tool | Config Path |
|------|-------------|
| **Claude Code** | `~/.claude/mcp.json` or `.claude/mcp.json` (project) |
| **Cursor** | `.cursor/mcp.json` |
| **Codex CLI** | `~/.codex/config.toml` or `.codex/config.toml` |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |

> **Tip**: For multiple projects or nested repos, set `"env": { "CAIRN_ROOT": "/path/to/project" }` to pin the server to a specific project root.

See [`mcp/README.md`](mcp/README.md) for all supported platforms (Cline, Windsurf, Copilot, Gemini CLI, OpenCode).

### 3. Use

Open your AI tool in a project — Cairn auto-initializes on first use:

1. AI calls `cairn_init_status()`, detects uninitialized project
2. AI analyzes your codebase (README, git history, dependencies, structure)
3. AI calls `cairn_init_commit()` to write initial cognition (skeleton, blood, DNA, stage)

Some high-gravity signals (G2+) enter a staged review queue rather than being auto-confirmed. This is intentional — they need your sign-off before influencing future suggestions. AI will prompt you to review them.

<details>
<summary>Manual scaffold (optional)</summary>

To pre-create the `.cairn/` directory structure before AI initialization:

```bash
cd my-project
cairn init
```

This creates an empty scaffold and prints setup instructions. AI will populate it on first `cairn_init_commit()`. Use `cairn init --empty` for silent mode (scripts/CI).

</details>

---

## Daily Usage

After MCP configuration, daily operation is fully automatic:

1. **Session start** — AI calls `cairn_context()` to activate relevant cognition
2. **During work** — AI calls `cairn_signal()` when it detects decisions, rejections, or constraints
3. **Session end** — AI calls `cairn_session_end()` to process signals and regenerate views

The only human action: periodically review staged entries when AI prompts you.

![Daily Usage](docs/diagrams/05-daily-usage.png)

---

## MCP Tools

14 tools across 4 phases (init / runtime / review / diagnostics):

| Tool | Purpose | Stability |
|------|---------|-----------|
| `cairn_init_status` | Check initialization status | Stable |
| `cairn_init_commit` | Batch write initial cognition after project analysis | Stable |
| `cairn_context` | Activate relevant cognition for the current task | Stable |
| `cairn_signal` | Report decisions, rejections, constraints (now accepts `details.aliases`) | Stable |
| `cairn_session_end` | End-of-session pipeline (git scan / decay / calibration + safety valve / stage inference / compression) | Stable |
| `cairn_status` | System status (DNA mode, drift, stage transitions, pending candidates) | Stable |
| `cairn_plan` | History-aware planning (includes archived constraints + DNA health) | Stable |
| `cairn_stage_list` | List pending staged entries (EvolutionEvent) | Stable |
| `cairn_stage_accept` | Accept staged entry; applies stage_transition to state if applicable | Stable |
| `cairn_stage_reject` | Reject a staged entry | Stable |
| `cairn_dna_list` | List pending DNA trait candidates from compression | Stable |
| `cairn_dna_accept` | Confirm a DNA trait candidate (writes to identity.yaml) | Stable |
| `cairn_dna_reject` | Reject a DNA trait candidate | Stable |
| `cairn_doctor` | Consistency validation + auto-resurrect G0/G1 archived events | Stable |

See [`mcp/README.md`](mcp/README.md) for full tool schemas and recommended workflow.

### DNA Emergence Flow

Repeated patterns in blood events automatically produce DNA trait candidates
during `cairn_session_end`. Candidates land in `.cairn/dna/staged/` and require
human ratification via `cairn_dna_accept` / `cairn_dna_reject` before they start
modulating routing and challenges. A wrong DNA trait silently distorts every
future decision — always review.

### Doctor Side Effects

`cairn_doctor` is no longer purely read-only. Archived events with high
recent reactivation (≥5 hits / 30 days):

- **G0/G1**: auto-resurrected via `BloodEngine.resurrect()`; listed under `auto_resurrected`
- **G2+**: surface as `resurrection_candidates` awaiting human ratification

---

![Integration Overview](docs/diagrams/03-integration-overview.png)

## Supported AI Tools

### MCP (primary path)

| Tool | Config Location |
|------|----------------|
| Claude Code | `~/.claude/mcp.json` or `.claude/mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cline / Roo Code | `~/Documents/cline/cline_mcp_settings.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` or `.windsurf/mcp_config.json` |
| GitHub Copilot | `.vscode/mcp.json` |
| Codex CLI | `~/.codex/config.toml` or `.codex/config.toml` |
| Gemini CLI | `~/.gemini/settings.json` or `.gemini/settings.json` |
| OpenCode | `~/.config/opencode/opencode.json` or `opencode.json` |

### Skill Adapters (alternative path)

For scenarios where MCP is not configured, skill adapter files inject `views/` content directly:

| Tool | Adapter File | Install Location |
|------|-------------|-----------------|
| Claude Code | `skills/claude-code/SKILL.md` (canonical) | `.claude/CLAUDE.md` (append) |
| Cursor | `skills/cursor.mdc` | `.cursor/rules/cairn.mdc` |
| Cline / Roo Code | `skills/cline.md` | `.clinerules` (append) |
| Windsurf | `skills/windsurf.md` | `.windsurfrules` (append) |
| GitHub Copilot | `skills/copilot-instructions.md` | `.github/copilot-instructions.md` (append) |
| Codex CLI | `skills/codex.md` | `AGENTS.md` (append) |
| Gemini CLI | `skills/gemini-cli.md` | `GEMINI.md` (append) |
| OpenCode | `skills/opencode.md` | `AGENTS.md` (append) |

The data layer (`.cairn/`) is fully tool-agnostic — it travels with your repository.

---

## CLI

```
cairn <command> [options]

Commands:
  init [--empty]                    Initialize .cairn/ directory
  status                            Show project status (DNA mode, drift, stage transitions)
  doctor                            Consistency checks + auto-resurrect low-gravity archived events
  review                            List pending staged entries
  audit                             Show governance audit log
  dna show                          Show DNA traits + drift warnings + reevaluation_mode
  dna reevaluate                    Toggle DNA reevaluation_mode
  dna list                          List pending DNA trait candidates
  dna accept <id>                   Confirm a DNA trait candidate
  dna reject <id> <reason>          Reject a DNA trait candidate
  skeleton show                     Show skeleton nodes
  blood show [id]                   Show blood events
  blood archive <id>                Archive a blood event
  blood resurrect <id>              Resurrect an archived event
  blood trauma <id>                 Mark event as trauma
  stage confirm                     Confirm stage advisory as official
  stage list                        List pending stage_transition entries
  stage accept <id>                 Accept a stage transition (applies new phase)
  stage reject <id> <reason>        Reject a stage transition

Options:
  --version                         Show version
```

---

## Stage Advisory Engine

Cairn infers your project's lifecycle phase from Git signals:

| Phase | Typical Signals | Guidance |
|-------|----------------|----------|
| `exploration` | Age < 6 months, high dependency churn | New deps OK, experiments OK, prioritize speed |
| `growth` | Rising commit trend, stable deps | Balance speed and stability |
| `maturity` | Low new-file ratio, age > 18 months | New deps need strong justification |
| `maintenance` | Declining commits, age > 24 months | Conservative changes only |

The engine is **advisory only** — it never enforces constraints automatically.
Stage guidance surfaces in `cairn_context()` when confidence >= 0.5. To confirm
a stage as official, use `cairn stage confirm` or via AI-mediated `cairn_stage_accept`.

---

## `.cairn/` Directory Structure

```
.cairn/
├── config.yaml              # Project config: name, domains, cognitive mode, tech stack
├── state.yaml               # Runtime state: last session, stage snapshot
├── skeleton/                # Domain ownership map (one YAML per domain)
│   ├── frontend.yaml
│   └── backend.yaml
├── blood/                   # Evolution events (decisions, rejections, transitions)
│   ├── evt_001.yaml
│   └── evt_002.yaml
├── dna/                     # Emergent project personality
│   ├── identity.yaml        # Current DNA traits
│   ├── imprint.yaml         # Inherited constraints (for forked projects)
│   └── staged/              # DNA trait candidates pending human ratification
├── domains/                 # Per-domain capillary projections
│   ├── frontend/
│   │   ├── constraints.yaml
│   │   ├── accepted_debt.yaml
│   │   └── rejected_paths.yaml
│   └── backend/
├── staged/                  # Entries awaiting human review
├── signals/                 # Signal dirs preserved for future audit infra
│   ├── raw_git/             # (not written to currently — audit lives in blood.source.refs)
│   ├── raw_conversation/    # (not written to currently)
│   └── raw_calibration/     # (not written to currently)
├── governance/              # Governance policy and audit log
│   ├── policy.yaml
│   └── audit.yaml
├── views/                   # Auto-generated markdown projections
│   ├── output.md            # Global constraint summary
│   ├── stage.md             # Stage advisory details
│   └── domains/             # Per-domain summaries
├── sessions/                # Session audit records
```

---

## Examples

- [`examples/saas-18mo/`](examples/saas-18mo/) — 18-month SaaS project
  (stage `growth`, no-go: tRPC/Redux, 3 domains, 4 blood events)

---

## Verification

Cairn ships a 25-scenario reverse-regression harness that turns the core promise — "AI does not walk into the same wall twice" — into CI-assertable evidence. Each scenario boots a fixture project, spawns a real MCP server, drives a real LLM through Claude Code's and Codex's protocols, and asserts the tool-call trace and assistant response against `expected.yaml`.

| Category | Scenarios | What it locks down |
|----------|-----------|---------------------|
| **A** core red line (10) | A1-A10 | `no_go`, `constraint_declaration`, `accepted_debt`, `hard_constraint`, `trauma`, domain `rejected_paths`, `stage_constraint`, archived reactivation, DNA bias, DNA reevaluation pause |
| **B** signal capture (6) | B1-B6 | AI captures `historical_reference / decision / user_rejection / debt_acceptance / stage_constraint`; rejects noise |
| **C** protocol (5) | C1-C5 | `cairn_context` first, `cairn_session_end` last, staged prompts, three-level challenges, doctor side-effect transparency |
| **D** robustness (4) | D1-D4 | duplicate de-dup, degraded mode, cold init, 1000-event scale |

Each scenario runs twice — once with Claude Code's protocol, once with Codex's. Run with:

```bash
cd mcp
export ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
npm run scenarios            # full pass (50 LLM sessions)
npm run scenarios -- a1      # filter by id
```

See [`mcp/tests/scenarios/README.md`](mcp/tests/scenarios/README.md) for the coverage matrix, scenario authoring guide, and `expected.yaml` schema.

---

## Documentation

| Document | Contents |
|----------|----------|
| [`spec/FORMAT.md`](spec/FORMAT.md) | Complete schema reference for all `.cairn/` data files |
| [`spec/DESIGN.md`](spec/DESIGN.md) | Design rationale: signal capture, Gravity, stage engine, Blood/Views separation |
| [`spec/vs-adr.md`](spec/vs-adr.md) | How Cairn relates to Architecture Decision Records |
| [`spec/adoption-guide.md`](spec/adoption-guide.md) | Install and daily usage guide |
| [`spec/glossary.md`](spec/glossary.md) | Terminology reference |
| [`mcp/README.md`](mcp/README.md) | MCP Server tool schemas and configuration |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history |

---

## License

MIT
