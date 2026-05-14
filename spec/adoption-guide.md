[中文](adoption-guide.zh.md) | English

# Cairn Adoption Guide

Cairn is a dynamic memory engine. An MCP Server captures, routes, and consolidates
project memory. All operations are MCP tools called by your AI assistant.

This guide covers two phases:

1. **Install** — one-time setup (auto-registers MCP, auto-initializes on first use)
2. **Daily Usage** — fully automatic, driven by AI tool calls

---

## Phase 1: Install

### Step 1: Install

```bash
npm install -g cairn-mcp-server
```

Requires Node.js 18+. Installation automatically registers the MCP server with
detected AI tools (Claude Code, Cursor, Windsurf, Claude Desktop). No manual
configuration needed.

<details>
<summary>Install from source</summary>

```bash
git clone https://github.com/zzf2333/Cairn
cd Cairn/mcp && npm install && npm run build
```

</details>

### Step 2: Start using

Cairn auto-initializes on first use. When AI first calls `cairn_context()`, the
server automatically:

1. **Detects project metadata** — project name from directory, start date from first commit
2. **Git history scan** — detects reverts, dependency changes, large file movements
3. **Creates `.cairn/` structure** — config, state, and all subdirectories

After initialization, your project has:

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

<details>
<summary>Manual MCP configuration</summary>

If auto-setup didn't detect your tool, add this to your MCP config:

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

Config file locations:
- **Claude Code** — `~/.claude/mcp.json` or `.claude/mcp.json`
- **Cursor** — `~/.cursor/mcp.json`
- **Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

The server resolves `.cairn/` by walking up from `process.cwd()`, or via the
`CAIRN_ROOT` environment variable.

</details>

---

## Phase 2: Daily Usage

After installation, daily operation is fully automatic. No manual
file editing, no CLI commands needed.

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
  → Captures constraint-relevant events (see signal types below)
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
| `cairn_status` | System status + stage management | `stage_confirm` writes state |
| `cairn_review` | Review staged memory entries | `accept` writes memory |
| `cairn_memory` | Browse and manage memories | `archive` writes memory |
| `cairn_plan` | History-aware planning framework | No (read-only, experimental) |
| `cairn_doctor` | Health diagnostics | No (read-only, experimental) |

### Signal Types

The AI calls `cairn_signal()` whenever it detects a constraint-relevant event:

| Event | signal_type |
|---|---|
| User rejects a suggestion with reason | `user-rejection` |
| User references a past attempt | `historical-reference` |
| User states a business or technical constraint | `user-constraint` |
| A significant technical decision is made | `decision` |
| A technical debt is discovered and accepted | `debt-acceptance` |
| Git revert detected | `revert` |
| Dependency removed from manifest | `dependency-removed` |
| Dependency replaced with alternative | `dependency-replaced` |
| Large-scale file movement (>10 files) | `large-refactor` |
| Commit frequency / project age data | `stage-signal` |

### What AI Does NOT Do

- **Does not** write to `.cairn/` files directly (memory, signals, staged, views)
- **Does not** produce "Cairn reflection" blocks
- **Does not** manually track event counts
- **Does not** update `output.md` or domain files — the Views Engine handles this
- **Does not** decide trust levels — the Trust Router handles routing

### Trust Router: How Signals Become Memory

Every signal passes through the Trust Router. No signal bypasses it.

| Level | Name | Destination | Behavior |
|-------|------|-------------|----------|
| L0 | Drop | Discarded | Noise, duplicates, low confidence |
| L1 | Candidate | `signals/` | Accumulates; upgrades to L2 when threshold met |
| L2 | Staged | `staged/` | Awaits human review via `cairn_review` MCP tool |
| L3 | Auto-write | `memory/` | Strict conditions met; written automatically |

**Hard rules (never overridden):**

- New global no-go → always L2
- Stage change → always L2
- Global-scope behavior_effect → always L2
- Items in `config.yaml` `never_auto` list → always L2

### Periodic Review

When staged entries accumulate, AI calls `cairn_review(action: 'list')` to present
them. You decide to accept or reject each entry, and AI calls
`cairn_review(action: 'accept', id: '...')` or `reject` accordingly.

This is the only human-in-the-loop step. Accepted entries move to `memory/` and
trigger view regeneration.

---

## AI Tools Without MCP Support (Fallback Path)

For tools that do not support MCP, Cairn provides skill adapter files that read
the `views/` directory directly. Views are standard Markdown files.

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
| Diagnostics | `cairn_doctor()` — structured results | Not available |

The fallback path provides read-only access to the latest view snapshot. Signal
capture and memory evolution require MCP.

---

## Architecture Overview

### Memory / Views Separation

Cairn strictly separates source data from AI-consumable views:

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
- Confidence < 0.5 → no constraints generated
- Stage changes → always L2 (requires human review)

---

## CLI Reference

All project memory operations are MCP tools called by your AI assistant.

| Command | Description |
|---------|-------------|
| `cairn version` | Show version |

---

## Troubleshooting

**Stale domains:**
Stale domains have new memory entries that haven't been reflected in views.
AI can call `cairn_session_end()` to trigger a view regeneration.

**Staged backlog growing:**
AI will prompt you when staged entries need review. Use `cairn_review` MCP tool
to process them. Unreviewed staged entries do not affect AI behavior.

**MCP server not connecting:**
1. Verify installation: `which cairn-mcp-server` or `node /path/to/dist/index.js`
2. Check MCP config file location matches your AI tool
3. `.cairn/` will be auto-created on first MCP tool call

**Conflicts in memory:**
AI can call `cairn_doctor()` to detect conflicting behavior_effects within the
same domain. Use `cairn_memory(action: 'show', id: '...')` to inspect and
`cairn_memory(action: 'archive', id: '...')` to archive the outdated entry.
