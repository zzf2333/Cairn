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
| `cairn_write_history` | Write a new decision event directly to `.cairn/history/` after a task crystallizes |
| `cairn_doctor` | Run `cairn doctor --json` and return structured health check results |
| `cairn_match` | Match keywords (and optional `files` paths) against domain `hooks` — returns confidence levels (`high`/`medium`/`low`) and related domain advisory |

## Resources

| URI | Description |
|-----|-------------|
| `cairn://output` | Static read of `output.md` |
| `cairn://domain/{name}` | Template read of any domain file |

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

# After a task produces a recordable decision:
cairn_write_history(type="rejection", domain="api-layer", ...)
→ writes a canonical entry to .cairn/history/

# After writing memory or before finishing a session:
cairn_doctor()
→ returns JSON health checks and write-back drift signals
```

## Write-back Workflow

For v0.0.12+, there is no MCP staging ceremony. AI assistants maintain `.cairn/`
directly using either their native file tools or the `cairn_write_history` MCP tool.
After writing memory, run `cairn_doctor` to verify the structure and surface stale
domains or write-back drift.

```text
1. Read cairn_output at session start.
2. Use cairn_match and cairn_domain before planning in a matched domain.
3. Use cairn_query when full historical reasoning is needed.
4. Use cairn_write_history only after a real decision, rejection, transition, debt, or experiment crystallizes.
5. Run cairn_doctor before final response when memory was changed.
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
│   ├── staging.ts            # History-entry serialization and filename helpers
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
│       ├── cairn-write-history.ts
│       ├── cairn-doctor.ts
│       └── cairn-match.ts
└── tests/
    ├── fixtures/.cairn/      # Real example data from examples/saas-18mo/
    ├── parsers/
    └── tools/
```
