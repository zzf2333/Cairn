[中文](README.zh.md) | English

# Cairn MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that provides
AI tools with typed access to Cairn's engineering cognition engine — signal capture,
gravity-based trust routing, and constraint views.

## Why

Cairn is an AI-native engineering cognition engine: project signals are captured
automatically from Git history, AI conversations, and calibration checks, routed
through a Gravity system (G0–G3), and consolidated into blood events (evolution
records). The MCP Server is the primary interface — AI tools call typed tools
instead of reading raw files.

For tools that don't support MCP, `views/` provides a read-only fallback (see
[Degraded Mode](#degraded-mode)).

## Tools

Eleven MCP tools:

### Initialization

| Tool | Description | Writes Data? |
|------|-------------|-------------|
| `cairn_init_status` | Check Cairn initialization status. Returns whether `.cairn/` exists, has config, and has been populated. | No (read-only) |
| `cairn_init_commit` | Batch write initial cognition after project analysis. Accepts config, skeleton nodes, blood candidates, stage, and DNA traits. | Yes (writes all stores) |

### Core Workflow

| Tool | Description | Writes Data? |
|------|-------------|-------------|
| `cairn_context` | Activate relevant cognition for the current task. Returns: stage advisory, no-go list, relevant domains, active debt, challenges. | No (read-only) |
| `cairn_signal` | Report a conversation signal: user rejection, decision, constraint, historical reference, debt acceptance. Routed through Trust Router. | Indirect (via Trust Router) |
| `cairn_session_end` | End-of-session processing: batch signals, create session record, regenerate views. | Indirect (via Trust Router) |
| `cairn_status` | System status overview: blood count, staged count, signal count, stage advisory, DNA status. | No (read-only) |
| `cairn_plan` | History-aware planning framework. Returns historical constraints and recommended direction for a task. | No (read-only) |

### Staged Review

| Tool | Description | Writes Data? |
|------|-------------|-------------|
| `cairn_stage_list` | List pending staged entries for review. | No (read-only) |
| `cairn_stage_accept` | Accept a staged entry into blood. | Yes (writes blood) |
| `cairn_stage_reject` | Reject a staged entry with reason. | Yes (updates staged) |

### Diagnostics

| Tool | Description | Writes Data? |
|------|-------------|-------------|
| `cairn_doctor` | Run cognitive consistency validation: skeleton drift, blood conflicts, orphan domains, DNA coherence. | No (read-only) |

### Input Schemas

**`cairn_init_status`** — no input

**`cairn_init_commit`**
```json
{
    "config": {
        "project_name": "string",
        "domains": "string[]",
        "cognitive_mode": "lightweight | standard | institutional"
    },
    "skeleton": [{
        "domain": "string",
        "role": "string",
        "owns": "string[]",
        "does_not_own": "string[]",
        "causal_keywords": "string[]",
        "dependencies": "string[] (optional)"
    }],
    "blood_candidates": "object[] — draft evolution events",
    "stage": {
        "phase": "exploration | growth | maturity | maintenance",
        "confidence": "number (0–1)",
        "evidence": "string[]"
    },
    "dna": {
        "traits": [{
            "name": "string",
            "level": "low | medium | high",
            "confidence": "number (0–1)",
            "reasoning": "string"
        }]
    }
}
```

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
    "signal_type": "string — user_rejection | constraint_declaration | historical_reference | decision | debt_acceptance | stage_constraint",
    "domain": "string (optional) — affected domain",
    "details": {
        "what": "string — what happened",
        "reason": "string (optional) — why",
        "rejected_alternatives": [{ "path": "string", "reason": "string" }],
        "revisit_when": "string[] (optional)"
    },
    "evidence": {
        "user_said": "string (optional)",
        "files": "string[] (optional)",
        "commit_ref": "string (optional)"
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

**`cairn_status`** — no input

**`cairn_stage_list`** — no input

**`cairn_stage_accept`**
```json
{
    "id": "string — staged entry ID"
}
```

**`cairn_stage_reject`**
```json
{
    "id": "string — staged entry ID",
    "reason": "string — rejection reason"
}
```

**`cairn_doctor`** — no input

## Recommended Workflow

```
First session (initialization):
  cairn_init_status()
  → Returns: not initialized / empty scaffold / ready

  cairn_init_commit({ config, skeleton, blood_candidates, stage, dna })
  → Writes initial cognition: skeleton nodes, blood events, DNA traits, stage

Session start:
  cairn_context({ task: "refactor auth module" })
  → Returns constraints: no-go list, relevant domains, active debt, challenges

During work:
  cairn_signal({ signal_type: "user_rejection", domain: "auth", details: { what: "OAuth2 PKCE", reason: "too complex for current team size" } })
  → Trust Router routes: G0 drop / G1 suggestion / G2 staged / G3 blood

  cairn_signal({ signal_type: "decision", domain: "api-layer", details: { what: "REST stays", rejected_alternatives: [{ path: "GraphQL", reason: "insufficient tooling" }] } })
  → Routed based on gravity

Before design tasks:
  cairn_plan({ task: "redesign notification system" })
  → Returns historical constraints and recommended direction

Session end:
  cairn_session_end({ summary: "Refactored auth, rejected OAuth2 PKCE", changed_domains: ["auth"] })
  → Batch processes signals, regenerates views, creates session record

Reviewing staged entries:
  cairn_stage_list()
  → Returns pending entries with draft event details
  cairn_stage_accept({ id: "staged_..." })
  → Accepts entry into blood
  cairn_stage_reject({ id: "staged_...", reason: "not relevant" })
  → Rejects entry

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

#### Codex CLI

Add to `~/.codex/config.toml` or `.codex/config.toml`:

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
```

### Project root detection

The server resolves the `.cairn/` directory in this order:

1. `CAIRN_ROOT` environment variable (set in MCP config if needed)
2. Walk up from `process.cwd()` until `.cairn/` is found

If neither finds a `.cairn/` directory, the server auto-initializes one on first tool call.

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

```
cairn <command> [options]

Commands:
  init                     Initialize .cairn/ scaffold and print setup guide
  init --empty             Initialize .cairn/ scaffold (silent, for scripts)
  status                   Show project cognitive status (DNA mode, drift, stage)
  doctor                   Consistency checks + auto-resurrect low-gravity archived events
  review                   List pending staged entries
  audit                    Show governance audit log
  dna show                 Show DNA traits + drift warnings + reevaluation_mode
  dna reevaluate           Toggle DNA reevaluation_mode
  dna list                 List pending DNA trait candidates
  dna accept <id>          Confirm a DNA trait candidate
  dna reject <id> <reason> Reject a DNA trait candidate
  skeleton show            Show skeleton nodes
  blood show [id]          Show blood events
  blood archive <id>       Archive a blood event
  blood resurrect <id>     Resurrect an archived event
  blood trauma <id>        Mark event as trauma
  stage confirm            Confirm stage advisory as official
  stage list               List pending stage_transition entries
  stage accept <id>        Accept a stage transition (applies new phase)
  stage reject <id> <reason> Reject a stage transition

Options:
  --version                Show version
```

## Degraded Mode

For AI tools that don't support MCP, `views/` provides read-only access:

- `views/output.md` — global constraints
- `views/domains/*.md` — per-domain summaries
- `views/stage.md` — stage advisory details

Views are auto-generated from blood events whenever data changes. They are always
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
├── index.ts                 # MCP stdio entry point
├── constants.ts             # Version, gravity constants, cognitive mode parameters
├── context.ts               # CairnContext factory: wires all stores and engines
├── bootstrap.ts             # Empty scaffold creation
├── server.ts                # McpServer factory: registers 14 tools
├── paths.ts                 # .cairn/ root detection + path resolution
├── tokens.ts                # Token counting utilities
├── errors.ts                # Typed error codes
├── schemas/                 # Zod schemas for all data types
│   ├── shared.ts            # Gravity, Source, Subject, BehaviorEffect, Lifecycle, Trauma, Revisit, Health
│   ├── evolution-event.ts   # EvolutionEvent (blood entries)
│   ├── skeleton.ts          # SkeletonNode (domain ownership)
│   ├── dna.ts               # DNAIdentity, DNAImprint, DNATrait
│   ├── domain-capillary.ts  # DomainConstraints, DomainAcceptedDebt, DomainRejectedPaths
│   ├── signal.ts            # GitSignal, ConversationSignal, CalibrationSignal
│   ├── staged-entry.ts      # StagedEntry (pending human review)
│   ├── config.ts            # Config (cognitive_mode, domains, tech_stack)
│   ├── state.ts             # State (stage snapshot, last session)
│   ├── governance.ts        # GovernancePolicy, AuditEntry
│   └── session-record.ts    # SessionRecord
├── stores/                  # YAML file read/write layer
│   ├── blood-store.ts       # blood/*.yaml CRUD + duplicate detection
│   ├── skeleton-store.ts    # skeleton/*.yaml CRUD
│   ├── dna-store.ts         # dna/identity.yaml + dna/imprint.yaml
│   ├── domain-store.ts      # domains/*/constraints.yaml, accepted_debt.yaml, rejected_paths.yaml
│   ├── signal-store.ts      # signals/raw_git/, raw_conversation/, raw_calibration/
│   ├── staged-store.ts      # staged/*.yaml CRUD + accept/reject
│   ├── state-store.ts       # state.yaml read/write
│   ├── config-store.ts      # config.yaml read/write
│   ├── governance-store.ts  # governance/policy.yaml + audit.yaml
│   └── session-store.ts     # sessions/*.yaml
├── engines/                 # Core processing engines
│   ├── activation-engine.ts # Context-aware cognition activation
│   ├── challenge-engine.ts  # Reflective challenge generation
│   ├── trust-router.ts      # G0–G3 gravity-based signal routing
│   ├── git-ear.ts           # Git history signal detection
│   ├── calibration-ear.ts   # Consistency drift detection
│   ├── stage-engine.ts      # Project stage inference (rule-based)
│   ├── blood-engine.ts      # Blood event management + domain capillary sync
│   ├── decay-engine.ts      # Stale event aging by cognitive mode
│   ├── compression-engine.ts # DNA trait candidate identification
│   ├── resurrection-engine.ts # Archived event resurrection detection
│   ├── consistency-engine.ts # Cross-subsystem consistency validation
│   ├── governance-engine.ts # 3-tier governance permission checks
│   └── views-engine.ts     # Generates views/ from blood (token-budget-aware)
├── tools/                   # MCP tool implementations
│   ├── cairn-init-status.ts
│   ├── cairn-init-commit.ts
│   ├── cairn-context.ts
│   ├── cairn-signal.ts
│   ├── cairn-session-end.ts
│   ├── cairn-status.ts
│   ├── cairn-plan.ts
│   ├── cairn-stage-list.ts
│   ├── cairn-stage-accept.ts
│   ├── cairn-stage-reject.ts
│   └── cairn-doctor.ts
└── cli/                     # CLI subcommands
    ├── index.ts
    ├── init.ts
    ├── status.ts
    ├── doctor.ts
    ├── review.ts
    ├── audit.ts
    ├── dna.ts
    ├── skeleton.ts
    ├── blood.ts
    └── stage.ts
```
