# Cursor Adapter

## Platform Rules

Cursor supports MCP servers. This protocol installs into `.cursorrules` or `.cursor/rules/` at the project root.

You must actively use Cairn during technical work. Do not treat Cairn as optional memory.

Always follow the lifecycle:

```
context -> plan -> signal -> observe -> session_end
```

---

## Setup

**1. Install the MCP server**

```bash
npm install -g cairn-mcp-server
```

Requires Node.js 18+.

**2. Register the server with Cursor**

Add to `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "cairn": { "command": "cairn-mcp-server" }
  }
}
```

For multi-project setups, pin the project root:

```json
{
  "mcpServers": {
    "cairn": {
      "command": "cairn-mcp-server",
      "env": { "CAIRN_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

**3. Verify the install**

```bash
cairn status
cairn doctor
```

---

## Degraded Mode

If MCP tools are unavailable from Cursor, fall back to reading `.cairn/views/` directly:

1. `.cairn/views/output.md` — global constraints
2. `.cairn/views/domains/<name>.md` — per-domain context
3. `.cairn/views/stage.md` — stage advisory

Signal capture is unavailable in degraded mode.
