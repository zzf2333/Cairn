# Codex Adapter

## Platform Rules

`AGENTS.md` is the Codex CLI convention for project-level instructions (analogue of `CLAUDE.md`). This protocol block should be in your project's `AGENTS.md` or `~/.codex/AGENTS.md` for global scope.

You must actively use Cairn during technical work. Do not treat Cairn as optional memory.

Always follow the lifecycle:

```
context -> plan -> signal -> observe -> session_end
```

---

## Setup

**1. Install the MCP server**

```bash
npm install -g cairn-rt
```

Requires Node.js 18+.

**2. Register the server with Codex**

Add to `~/.codex/config.toml` (global) or `.codex/config.toml` (project):

```toml
[mcp_servers.cairn]
command = "cairn-rt"
```

For multi-project setups, pin the project root:

```toml
[mcp_servers.cairn]
command = "cairn-rt"
env = { CAIRN_ROOT = "/absolute/path/to/your/project" }
```

**3. Verify the install**

```bash
cairn status
cairn doctor
```

Then in a Codex session ask: "Call `cairn_init_status` and show the raw response." If it returns JSON with `status` and `has_cairn_dir` fields, MCP wiring is live.

---

## Degraded Mode

If MCP tools are unavailable from Codex, fall back in this order:

1. Read-only views: `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. CLI for state inspection: `cairn status`, `cairn doctor`, `cairn review`, `cairn dna list`, `cairn stage list`
3. CLI for review queues: `cairn dna accept/reject <id>`, `cairn stage accept/reject <id>`

Signal capture and session pipelines are unavailable in degraded mode.
