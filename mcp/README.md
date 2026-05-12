[中文](README.zh.md) | English

# Cairn MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that provides
AI tools with typed access to Cairn's dynamic memory engine — signal capture, trust-routed
memory, and constraint views.

## Why

Cairn is a dynamic memory engine: project signals are captured automatically from
Git history and AI conversations, routed through a Trust Router (L0–L3), and consolidated
into structured memory. The MCP Server is the primary interface — AI tools call typed
tools instead of reading raw files.

For tools that don't support MCP, `views/` provides a read-only fallback (see
[Degraded Mode](#degraded-mode)).

## Tools

Six MCP tools, four stable and two experimental:

### Stable

| Tool | Description | Writes Memory? |
|------|-------------|---------------|
| `cairn_context` | Get project constraints before working. Returns: stage advisory, no-go list, relevant domains, active debt, warnings. | No (read-only) |
| `cairn_signal` | Report a project signal from conversation: user rejection, decision, constraint, historical reference, debt acceptance. Routed through Trust Router. | Indirect (via Trust Router) |
| `cairn_session_end` | End-of-session processing: batch L1 signals, create session record, regenerate views. | Indirect (via Trust Router) |
| `cairn_status` | System status: memory count, staged count, signals count, conflicts, stale domains, stage advisory. | No (read-only) |

### Experimental

| Tool | Description | Writes Memory? |
|------|-------------|---------------|
| `cairn_plan` | History-aware planning framework. Returns historical constraints and recommended direction for a task. | No (read-only) |
| `cairn_doctor` | Health diagnostics: token budget check, orphan no-gos, stale domains, conflicts, staged backlog. | No (read-only) |

### Input Schemas

**`cairn_context`**
```json
{
    "task": "string (optional) — current task description",
    "files": "string[] (optional) — files being worked on"
}
```

**`cairn_signal`**
```json
{
    "type": "enum — user-rejection | user-constraint | historical-reference | decision | debt-acceptance | ...",
    "domain": "string (optional) — affected domain",
    "details": {
        "what": "string — what happened",
        "reason": "string (optional) — why",
        "rejected_alternatives": "string[] (optional)",
        "revisit_when": "string[] (optional)"
    },
    "evidence": {
        "user_said": "string (optional)",
        "files": "string[] (optional)",
        "commit": "string (optional)"
    }
}
```

**`cairn_session_end`**
```json
{
    "summary": "string — session summary",
    "changed_domains": "string[] (optional)",
    "decisions_made": "string[] (optional)",
    "unresolved": "string[] (optional)"
}
```

**`cairn_plan`**
```json
{
    "task": "string — task to plan for"
}
```

`cairn_status` and `cairn_doctor` take no input.

## Recommended Workflow

```
Session start:
  cairn_context({ task: "refactor auth module" })
  → Returns constraints: no-go list, relevant domains, active debt

During work:
  cairn_signal({ type: "user-rejection", domain: "auth", details: { what: "OAuth2 PKCE", reason: "too complex for current team size" } })
  → Trust Router routes: L1 candidate / L2 staged / L3 auto-write

  cairn_signal({ type: "decision", domain: "api-layer", details: { what: "REST stays", rejected_alternatives: ["GraphQL"] } })
  → Routed based on trust policy

Before design tasks:
  cairn_plan({ task: "redesign notification system" })
  → Returns historical constraints and recommended direction

Session end:
  cairn_session_end({ summary: "Refactored auth, rejected OAuth2 PKCE", changed_domains: ["auth"] })
  → Batch processes signals, regenerates views, creates session record

Diagnostics (any time):
  cairn_status()
  cairn_doctor()
```

## Installation

### From npm (recommended)

```bash
npm install -g cairn-mcp-server
```

### From source

```bash
cd mcp/
npm install
npm run build
```

Requires Node.js 18+.

### Configuration

#### Claude Code

Add to `~/.claude/mcp.json` (global) or `.claude/mcp.json` (project):

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

From source:
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

#### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

### Project root detection

The server resolves the `.cairn/` directory in this order:

1. `CAIRN_ROOT` environment variable (set in MCP config if needed)
2. Walk up from `process.cwd()` until `.cairn/` is found

If neither finds a `.cairn/` directory, all tool calls return an actionable error.

To pin the server to a specific project:

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server",
            "env": {
                "CAIRN_ROOT": "/path/to/your/project"
            }
        }
    }
}
```

## CLI

The same package provides a `cairn` CLI for initialization and maintenance:

| Command | Description |
|---------|-------------|
| `cairn init` | Interactive project initialization (creates `.cairn/` with config, state, and directory structure) |
| `cairn status` | System state overview (memory count, staged count, stage, conflicts) |
| `cairn review` | Review staged entries: accept / edit / skip / delete |
| `cairn doctor` | Health diagnostics |
| `cairn stage confirm` | Confirm stage advisory as official |
| `cairn memory show <id>` | View a single memory entry |
| `cairn memory archive <id>` | Archive a memory entry |

## Degraded Mode

For AI tools that don't support MCP, `views/` provides read-only access:

- `views/output.md` — global constraints
- `views/domains/*.md` — per-domain summaries
- `views/stage.md` — stage advisory details

Views are auto-generated from memory whenever memory changes. They are always
a consistent snapshot of the last known state.

Skill adapter files for non-MCP tools read `views/` directly. See each adapter
in the `skills/` directory.

## Development

```bash
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run build         # Compile TypeScript
npm run dev           # Run server directly (tsx, no build needed)
```

## Architecture

```
mcp/src/
├── index.ts              # MCP stdio entry point + startup git scan trigger
├── cli.ts                # CLI entry point
├── server.ts             # McpServer factory: registers 6 tools + startup git scan
├── paths.ts              # .cairn/ root detection + path resolution
├── tokens.ts             # Token counting utilities
├── errors.ts             # Typed error codes
├── schemas/              # Zod schemas for all data types
│   ├── memory-entry.ts   # MemoryEntry (decision, rejection, transition, debt, experiment)
│   ├── signal.ts         # Signal (10 signal types, L0-L3 routing)
│   ├── staged-entry.ts   # StagedEntry (pending human review)
│   ├── config.ts         # Config (domains, trust_policy)
│   ├── stage-snapshot.ts # StageSnapshot (exploration/growth/maturity/maintenance)
│   └── session-record.ts # SessionRecord
├── stores/               # YAML file read/write layer
│   ├── memory-store.ts   # memory/*.yaml CRUD
│   ├── signal-store.ts   # signals/*.yaml CRUD
│   ├── staged-store.ts   # staged/*.yaml CRUD + accept/reject
│   └── state-store.ts    # state.yaml read/write
├── engines/              # Core processing engines
│   ├── views-engine.ts   # Generates views/ from memory (token-budget-aware)
│   ├── trust-router.ts   # L0-L3 signal routing with hard rules
│   ├── git-ear.ts        # Git history signal detection (auto-scans on startup)
│   ├── stage-engine.ts   # Project stage inference (rule-based)
│   └── memory-engine.ts  # Memory health + conflict detection
├── tools/                # MCP tool implementations
│   ├── cairn-context.ts
│   ├── cairn-signal.ts
│   ├── cairn-session-end.ts
│   ├── cairn-status.ts
│   ├── cairn-plan.ts
│   └── cairn-doctor.ts
└── cli/                  # CLI subcommands
    ├── init.ts
    ├── status.ts
    ├── review.ts
    ├── doctor.ts
    ├── stage.ts
    └── memory.ts
```
