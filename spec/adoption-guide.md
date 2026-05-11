[中文](adoption-guide.zh.md) | English

# Cairn v2 Adoption Guide

Cairn v2 is a dynamic memory engine. The v1 workflow of manual init scripts and
hand-written `output.md` is replaced by a TypeScript CLI with automatic initialization
and an MCP Server that captures, routes, and consolidates project memory.

This guide covers three phases:

1. **Install & Init** — one-time setup per machine + per project
2. **Daily Usage** — fully automatic, driven by AI tool calls
3. **Migration from v1** — how to transition existing `.cairn/` directories

---

## Phase 1: Install & Init

### Step 1: Install

**From npm (recommended):**

```bash
npm install -g cairn-mcp-server
```

**From source:**

```bash
git clone https://github.com/zzf2333/Cairn
cd Cairn/mcp && npm install && npm run build
```

Requires Node.js 18+.

### Step 2: Initialize a Project

```bash
cd my-project
cairn init
```

The interactive flow walks you through:

1. **Project name** — identifier used in config and views
2. **Project start date** — used by the Stage Advisory Engine to infer project age
3. **Domain selection** — pick from 11 standard domains, add custom ones in `kebab-case`
4. **Git history scan** — detects reverts, dependency changes, large file movements, and
   other candidate signals from your commit history
5. **Directory generation** — creates the complete `.cairn/` structure

After init, your project has:

```
.cairn/
├── config.yaml          # Project configuration (domains, trust policy)
├── state.yaml           # Server runtime state
├── signals/             # L1 candidate signal pool
├── staged/              # L2 entries awaiting human review
├── memory/              # Confirmed memories (source of truth)
├── views/               # Auto-generated AI-consumable views
│   ├── output.md        # Global constraints snapshot
│   ├── stage.md         # Stage advisory details
│   └── domains/         # Per-domain summaries
└── sessions/            # Session audit records
```

### The 11 Standard Domains

| Key | Area |
|-----|------|
| `state-management` | Frontend state management |
| `api-layer` | API design and communication |
| `database` | Data storage |
| `auth` | Authentication and authorization |
| `frontend-framework` | Frontend framework |
| `testing` | Testing strategy |
| `deployment` | Deployment and infrastructure |
| `monitoring` | Monitoring and alerting |
| `architecture` | Overall architecture patterns |
| `performance` | Performance optimization |
| `security` | Security strategy |

Add custom domains in `kebab-case` (e.g. `payments`, `data-pipeline`, `ml-inference`).
Once locked in `config.yaml`, the domain list is the canonical set — the AI uses these
keys when capturing signals.

**Choosing guidance:**

- Early-stage (solo, pre-PMF): `api-layer`, `database`, `auth`, `deployment`
- Full-stack team (2-5 engineers): add `state-management`, `frontend-framework`, `testing`
- When in doubt, pick fewer. You can always expand later.

### Step 3: Configure MCP

MCP is the primary integration path for AI tools that support it. Add the Cairn
server to your tool's MCP configuration.

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

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

**From source** — use the built entry point:

```json
{
    "mcpServers": {
        "cairn": {
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"]
        }
    }
}
```

The server resolves `.cairn/` by walking up from `process.cwd()`, or via the
`CAIRN_ROOT` environment variable.

### Step 4: Verify

```bash
cairn status    # System state overview
cairn doctor    # Health diagnostics
```

`cairn doctor` checks config integrity, memory consistency, view freshness, and
reports any conflicts or stale entries.

---

## Phase 2: Daily Usage

After init and MCP configuration, daily operation is fully automatic. No manual
file editing, no CLI ceremonies.

### How It Works

```
AI opens project
  → MCP Server starts (stdio, per-project instance)
  → Git Ear scans commits since last session
  → Memory and state loaded

AI calls cairn_context()
  → Returns: stage advisory, no-go list, relevant domains, active debt, warnings
  → AI works within these constraints

AI calls cairn_signal() during work
  → Captures decisions, rejections, experiments, constraints
  → Trust Router routes each signal: L0 drop / L1 candidate / L2 staged / L3 auto-write

AI calls cairn_session_end()
  → Batch processes accumulated signals
  → Regenerates views from memory

AI closes project → Server exits
```

### MCP Tools

| Tool | Purpose | Writes Memory? |
|------|---------|---------------|
| `cairn_context` | Get constraints before working | No (read-only) |
| `cairn_signal` | Capture a decision/rejection/constraint | Indirect (via Trust Router) |
| `cairn_session_end` | End-of-session batch processing | Indirect (via Trust Router) |
| `cairn_status` | System state overview | No (read-only) |
| `cairn_plan` | History-aware planning framework | No (read-only, experimental) |
| `cairn_doctor` | Health diagnostics | No (read-only, experimental) |

### Trust Router: How Signals Become Memory

Every signal passes through the Trust Router. No signal bypasses it.

| Level | Name | Destination | Behavior |
|-------|------|-------------|----------|
| L0 | Drop | Discarded | Noise, duplicates, low confidence |
| L1 | Candidate | `signals/` | Accumulates; upgrades to L2 when threshold met |
| L2 | Staged | `staged/` | Awaits human review via `cairn review` |
| L3 | Auto-write | `memory/` | Strict conditions met; written automatically |

**Hard rules (never overridden):**

- New global no-go → always L2
- Stage change → always L2
- Global-scope behavior_effect → always L2
- Items in `config.yaml` `never_auto` list → always L2

### Periodic Review

```bash
cairn review    # Walk through staged entries: accept / edit / skip / delete
cairn doctor    # Health check: stale domains, conflicts, orphan no-go entries
```

`cairn review` is the only human-in-the-loop step. Run it when you have staged
entries to process. Accepted entries move to `memory/` and trigger view regeneration.

---

## AI Tools Without MCP Support (Fallback Path)

For tools that do not support MCP, Cairn provides skill adapter files that read
the `views/` directory directly. Views are v1-compatible Markdown — the same format
that v1 skill adapters already consume.

| Tool | Adapter location |
|------|-----------------|
| Cline / Roo Code | `.clinerules` (append) |
| Windsurf | `.windsurfrules` (append) |
| GitHub Copilot | `.github/copilot-instructions.md` (append) |
| Codex CLI | `AGENTS.md` (append) |
| Gemini CLI | `GEMINI.md` (append) |
| OpenCode | `AGENTS.md` (append) |

**MCP tools vs. fallback adapters:**

| Capability | MCP (primary) | Skill adapter (fallback) |
|-----------|--------------|------------------------|
| Read constraints | `cairn_context()` — filtered by task | Reads `views/output.md` in full |
| Capture signals | `cairn_signal()` — routed automatically | Not available |
| Session lifecycle | `cairn_session_end()` — batch processing | Not available |
| Diagnostics | `cairn_doctor()` — structured results | `cairn doctor` CLI |

The fallback path provides read-only access to the latest view snapshot. Signal
capture and memory evolution require MCP.

---

## Phase 3: Migration from v1

### What Changed

| v1 | v2 |
|----|----|
| `.cairn/output.md` (hand-written) | `.cairn/views/output.md` (auto-generated from memory) |
| `.cairn/domains/*.md` (hand-written) | `.cairn/views/domains/*.md` (auto-generated) |
| `.cairn/history/*.md` (Markdown) | `.cairn/memory/*.yaml` (structured YAML) |
| `.cairn/SKILL.md` | `skills/claude-code/SKILL.md` (v2 version) |
| `.cairn/staged/` (v1 format) | `.cairn/staged/` (v2 YAML format) |
| No config file | `.cairn/config.yaml` |
| No state tracking | `.cairn/state.yaml` |
| No signal pipeline | `.cairn/signals/` |
| No session records | `.cairn/sessions/` |
| Manual file writing | Automatic via MCP + Trust Router |

### How to Migrate

**Recommended: fresh start with seed signals.**

```bash
cd my-project
cairn init
```

Then manually import key v1 history entries as seed signals using `cairn_signal()`.
Your v1 `output.md` and `domains/` serve as reference during this process — read them,
extract the important decisions, and feed them through the signal pipeline.

**What you can reuse:**

- v1 `output.md` → reference for initial domain selection and no-go entries
- v1 `domains/*.md` → reference for rejected paths and known pitfalls
- v1 `history/*.md` → import via `cairn_signal()` one entry at a time

**What you do not need to migrate manually:**

- `views/` files are auto-generated from memory — do not copy v1 output/domain files into views
- v1 SKILL.md is superseded by the v2 protocol

### Parallel Operation

During migration, you can keep v1 files alongside v2:

- v2 views are in `.cairn/views/` — they do not conflict with v1's `.cairn/output.md`
- Once v2 memory has enough entries, remove v1 files and let views take over
- Skill adapters for non-MCP tools will read `views/` automatically

---

## Architecture Overview

### Memory / Views Separation

v2 strictly separates source data from AI-consumable views:

**`memory/`** is the source of truth. Each entry is a structured YAML file with
full provenance, confidence scores, and behavior_effect declarations. Humans
review memory.

**`views/`** is auto-generated. `output.md`, `domains/*.md`, and `stage.md` are
projections of memory — regenerated whenever memory changes. AI consumes views.

This separation means:
- Memory edits propagate to views automatically
- Views can be regenerated at any time from memory
- Git diffs show whether a change is a fact change (memory) or a projection change (views)

### Dual-Ear Signal Capture

Cairn captures signals from two sources:

**Git Ear** (startup scan): reverts, dependency changes, large file movements,
commit frequency, new contributors. Provides "what happened."

**Conversation Ear** (real-time MCP): user rejections, historical references,
constraints, decisions, debt acceptance. Provides "why."

Both ears produce signals. Neither writes memory directly. The Trust Router
decides what becomes memory.

### Stage Advisory Engine

Infers project phase (exploration / growth / maturity / maintenance) from
multi-dimensional signals: project age, commit trends, dependency change rate,
new file ratio.

- Outputs advisory only — no hard constraints unless human-confirmed
- Confidence < 0.7 → no constraints generated
- Stage changes → always L2 (requires human review)

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `cairn init` | Interactive project initialization |
| `cairn status` | System state (memory count, staged count, stage, conflicts) |
| `cairn review` | Review staged entries (accept / edit / skip / delete) |
| `cairn doctor` | Health diagnostics |
| `cairn stage confirm` | Confirm stage advisory as official |
| `cairn memory show <id>` | View a single memory entry |
| `cairn memory archive <id>` | Archive a memory entry |

---

## Troubleshooting

**`cairn doctor` reports stale domains:**
Stale domains have new memory entries that haven't been reflected in views.
Run `cairn_session_end()` or trigger a view regeneration.

**Staged backlog growing:**
Run `cairn review` to process pending entries. Unreviewed staged entries do not
affect AI behavior — they are waiting for human confirmation.

**MCP server not connecting:**
1. Verify installation: `which cairn-mcp-server` or `node /path/to/dist/index.js`
2. Check MCP config file location matches your AI tool
3. Ensure `.cairn/` exists in the project (run `cairn init` if not)

**Conflicts in memory:**
`cairn doctor` reports conflicting behavior_effects within the same domain.
Review the conflicting entries with `cairn memory show <id>` and archive or
edit the outdated one.
