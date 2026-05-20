# Claude Code Adapter

Platform-specific rules for Claude Code. The lifecycle protocol is defined in `protocol/core.md`.

## Platform Behavior

Claude Code obeys long structured instructions well. Use strong imperative language and explicit ordering.

- Follow the lifecycle from `core.md` during every technical session
- Do not skip steps silently — if a step is skipped, it must match a `minimal-intervention.md` exclusion
- Do not treat Cairn as optional memory

## Setup

Add to `.claude/mcp.json` (project) or `~/.claude/mcp.json` (global):

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

Restart Claude Code after editing MCP config.

## Initialization

On first encounter with a project that has no `.cairn/`:

1. `cairn_init_status()` — check state
2. If `not_initialized` / `empty_scaffold` / `partial`: run step-by-step init
3. Steps (in order): config → skeleton → blood → dna → stage
4. For each step: analyze → `dry_run: true` preview → user confirms → commit → `cairn_init_status()` for next
5. For blood: cross-reference git history, code structure, team memory, AND project instructions (CLAUDE.md, ADRs)
6. Blood auto-confirms during init. DNA traits staged for human review.

## Degraded Mode

If MCP tools unavailable:

1. Read `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. These are auto-generated, read-only. Do not write to views.
3. Signal capture unavailable.

When `cairn_*` tools fail:

1. Ask user to run `cairn doctor` — if CLI errors, install is broken
2. If CLI works but MCP doesn't, check `.claude/mcp.json` config
3. If MCP runs but returns path errors, set `CAIRN_ROOT` in env
