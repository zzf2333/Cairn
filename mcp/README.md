[中文](README.zh.md) | English

# Cairn MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes structured tool access to the Cairn three-layer memory system (`.cairn/` directory).

## Why

The MCP server upgrades the precision of Cairn's domain injection from the behavior layer (AI reads skill files and infers when to load context) to the tool layer (machine-precise keyword matching against domain frontmatter `hooks` fields). This removes the need for each AI tool to handle raw file injection manually.

## Tools

| Tool | Description |
|------|-------------|
| `cairn_output` | Read `.cairn/output.md` — Layer 1 global constraints (stage, no-go, hooks, stack, debt) |
| `cairn_domain` | Read `.cairn/domains/<name>.md` — Layer 2 domain design context |
| `cairn_query` | Search `.cairn/history/` — Layer 3 raw decision events, with domain/type filters |
| `cairn_propose` | Draft a history entry to `.cairn/staged/` for human review |
| `cairn_sync_domain` | Generate context to regenerate a domain file from its history entries |
| `cairn_match` | Match keywords (and optional `files` paths) against domain `hooks` — returns confidence levels (`high`/`medium`/`low`) and related domain advisory |

## Resources

| URI | Description |
|-----|-------------|
| `cairn://output` | Static read of `output.md` |
| `cairn://domain/{name}` | Template read of any domain file |

## Installation

### From source

```bash
cd mcp/
npm install
npm run build
```

### Configuration

#### Claude Code

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

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
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"]
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
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"]
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
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"],
            "env": {
                "CAIRN_ROOT": "/path/to/your/project"
            }
        }
    }
}
```

## Recommended AI workflow

```
# At the start of every session:
cairn_output()

# When the user's request touches a domain:
cairn_match(["api", "endpoint", "design"])
→ returns: "api-layer (matched: api, endpoint)"

cairn_domain("api-layer")
→ returns full domain context with rejected paths + known pitfalls

# When you need full historical detail:
cairn_query(domain="api-layer", type="rejection")

# When you want to propose recording a decision:
cairn_propose(type="rejection", domain="api-layer", ...)
→ writes to .cairn/staged/ for human review

# When domain files are out of date:
cairn_sync_domain("api-layer")
→ returns context to regenerate the domain file
```

## `cairn_propose` staging workflow

The `cairn_propose` tool writes to `.cairn/staged/` instead of directly to `.cairn/history/`. This enforces the human-in-the-loop principle — the AI proposes, the human approves.

```bash
# Review the staged entry
cat .cairn/staged/2024-03_rejected-graphql.md

# Approve: move to canonical history
mv .cairn/staged/2024-03_rejected-graphql.md .cairn/history/

# Or discard
rm .cairn/staged/2024-03_rejected-graphql.md
```

## Development

```bash
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run build         # Compile TypeScript
npm run dev           # Run server directly (tsx, no build needed)
```

## Architecture

```
mcp/
├── src/
│   ├── index.ts              # stdio entry point
│   ├── server.ts             # McpServer factory: registers all tools + resources
│   ├── paths.ts              # .cairn/ root detection
│   ├── hooks.ts              # Frontmatter hooks index for cairn_match
│   ├── staging.ts            # Staging area logic for cairn_propose
│   ├── errors.ts             # Typed error codes
│   ├── parsers/
│   │   ├── frontmatter.ts    # YAML frontmatter extraction (domain files)
│   │   ├── output.ts         # output.md section parser
│   │   ├── domain.ts         # Domain file parser
│   │   └── history.ts        # History file parser (bare key:value format)
│   └── tools/
│       ├── cairn-output.ts
│       ├── cairn-domain.ts
│       ├── cairn-query.ts
│       ├── cairn-propose.ts
│       ├── cairn-sync-domain.ts
│       └── cairn-match.ts
└── tests/
    ├── fixtures/.cairn/      # Real example data from examples/saas-18mo/
    ├── parsers/
    └── tools/
```
