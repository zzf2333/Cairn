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

Cairn is an AI-maintained project memory engine. It automatically captures project
decisions, rejected paths, and accepted trade-offs from Git history and AI conversations,
then routes them through a trust system into structured memory that AI coding assistants
consume as behavioral constraints.

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

Cairn is a **dynamic memory engine for AI coding assistants** — it captures, routes, stores,
and serves project constraints so that AI works within your project's real history instead
of suggesting in a vacuum.

| What AI tools handle today | What Cairn adds |
|---------------------------|-----------------|
| Coding style, naming conventions | Rejected directions and why |
| Current tech stack and architecture | Stage-aware constraints (MVP vs growth) |
| What's being built now | Accepted debt that should not be touched |
| How to write code | What paths have already been walked |

---

## How It Works

Cairn captures project signals from two sources, routes them through a trust system,
and serves the results as structured constraints.

```
  Git history ──→ Git Ear ──→ signals ──┐
                                        ├──→ Trust Router ──→ memory/ ──→ Views Engine ──→ views/
  AI conversation ──→ cairn_signal() ──┘         │                                          │
                                            L0: drop                                   cairn_context()
                                            L1: candidate (signals/)                        │
                                            L2: staged (human review)               AI reads constraints
                                            L3: auto-write (memory/)
```

**Dual-ear signal capture:**
- **Git Ear** detects reverts, dependency changes, large refactors, commit patterns
- **Conversation Ear** captures user rejections, decisions, constraints, debt acceptance

**Trust Router (L0–L3):**
- **L0 Drop** — noise or duplicates, discarded
- **L1 Candidate** — saved to `signals/`, accumulates toward L2
- **L2 Staged** — awaits human review via `cairn review`
- **L3 Auto-write** — strict conditions met, written to `memory/` automatically

**Memory → Views → Constraints:**
- `memory/` is the source of truth (structured YAML, git-diff-friendly)
- `views/` is auto-generated (token-budget-aware Markdown for AI consumption)
- AI calls `cairn_context()` to get filtered constraints for the current task

![Signal Pipeline](docs/diagrams/02-three-layer-architecture.png)

### Four Constraint Behaviors

Every memory entry declares a `behavior_effect`:

| Type | AI Behavior |
|------|-------------|
| `avoid_suggestion` | AI MUST NOT suggest this direction |
| `prefer_approach` | AI should prefer this approach |
| `warn_before` | AI should warn before touching this area |
| `require_review` | Changes need human sign-off |

---

## Quick Start

### Install

```bash
npm install -g cairn-mcp-server
```

Or from source:

```bash
git clone https://github.com/zzf2333/Cairn
cd Cairn/mcp && npm install && npm run build
```

Requires Node.js 18+.

### Initialize a Project

```bash
cd my-project
cairn init
```

Interactive flow: project name → start date → domain selection → Git history scan → directory generation.

After init:

```
.cairn/
├── config.yaml          # Project configuration (domains, trust policy)
├── state.yaml           # Server runtime state
├── signals/             # L1 candidate signal pool
├── staged/              # L2 entries awaiting human review
├── memory/              # Confirmed memories (source of truth)
├── views/               # Auto-generated constraint views
│   ├── output.md        # Global constraints
│   ├── stage.md         # Stage advisory
│   └── domains/         # Per-domain summaries
└── sessions/            # Session audit records
```

### Configure MCP

**Claude Code** — `~/.claude/mcp.json` (global) or `.claude/mcp.json` (project):

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

**Cursor** — `.cursor/mcp.json`:

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

### Verify

```bash
cairn status    # System state overview
cairn doctor    # Health diagnostics
```

---

## Daily Usage

After init and MCP configuration, daily operation is fully automatic:

1. **Session start** — AI calls `cairn_context()` to load constraints
2. **During work** — AI calls `cairn_signal()` when it detects decisions, rejections, or constraints
3. **Session end** — AI calls `cairn_session_end()` to process signals and regenerate views

The only human action: periodically run `cairn review` to approve staged entries.

---

## MCP Tools

| Tool | Purpose | Stability |
|------|---------|-----------|
| `cairn_context` | Get constraints before working | Stable |
| `cairn_signal` | Report decisions, rejections, constraints | Stable |
| `cairn_session_end` | End-of-session batch processing | Stable |
| `cairn_status` | System status overview | Stable |
| `cairn_plan` | History-aware planning framework | Experimental |
| `cairn_doctor` | Health diagnostics | Experimental |

See [`mcp/README.md`](mcp/README.md) for full tool schemas and recommended workflow.

---

![Integration Overview](docs/diagrams/03-integration-overview.png)

## Supported AI Tools

### MCP (primary path)

| Tool | Config Location |
|------|----------------|
| Claude Code | `~/.claude/mcp.json` or `.claude/mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |

### Skill Adapters (fallback path)

For tools without MCP support, skill adapter files read `views/` directly:

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

| Command | Description |
|---------|-------------|
| `cairn init` | Interactive project initialization |
| `cairn status` | System state overview |
| `cairn review` | Review staged entries (accept / edit / skip / delete) |
| `cairn doctor` | Health diagnostics |
| `cairn stage confirm` | Confirm stage advisory |
| `cairn memory show <id>` | View a memory entry |
| `cairn memory archive <id>` | Archive a memory entry |

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
a stage as official:

```bash
cairn stage confirm
```

---

## Examples

- [`examples/saas-18mo/`](examples/saas-18mo/) — 18-month SaaS project
  (stage `growth`, no-go: tRPC/Redux, 3 domains, 4 memory entries)

---

## Documentation

| Document | Contents |
|----------|----------|
| [`spec/FORMAT.md`](spec/FORMAT.md) | Complete schema reference for all `.cairn/` data files |
| [`spec/DESIGN.md`](spec/DESIGN.md) | Design rationale: dual-ear, Trust Router, stage engine, memory/views separation |
| [`spec/vs-adr.md`](spec/vs-adr.md) | How Cairn relates to Architecture Decision Records |
| [`spec/adoption-guide.md`](spec/adoption-guide.md) | Install and daily usage guide |
| [`spec/glossary.md`](spec/glossary.md) | Terminology reference |
| [`mcp/README.md`](mcp/README.md) | MCP Server tool schemas and configuration |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history |

---

## License

MIT
