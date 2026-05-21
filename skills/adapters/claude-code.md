# Claude Code Adapter

Platform-specific rules for Claude Code. The lifecycle protocol is defined in `protocol/core.md`.

## Platform Behavior

Claude Code obeys long structured instructions well. Use strong imperative language and explicit ordering.

- Follow the lifecycle from `core.md` during every technical session
- Do not skip steps silently — if a step is skipped, it must match a `minimal-intervention.md` exclusion
- Do not treat Cairn as optional memory

## Setup (Recommended: Skill + CLI)

Install the CLI:

```bash
npm install -g cairn-rt
```

Install as Claude Code skill:

```bash
npx skills add zzf2333/Cairn/skill-dist
```

The skill protocol instructs the AI to run lifecycle commands via `cairn` CLI. No MCP config needed.

## Setup (Alternative: MCP)

Add to `.claude/mcp.json` (project) or `~/.claude/mcp.json` (global):

```json
{
  "mcpServers": {
    "cairn": { "command": "cairn-rt" }
  }
}
```

For multi-project setups, pin the project root:

```json
{
  "mcpServers": {
    "cairn": {
      "command": "cairn-rt",
      "env": { "CAIRN_ROOT": "/absolute/path/to/your/project" }
    }
  }
}
```

Restart Claude Code after editing MCP config.

## Initialization

On first encounter with a project that has no `.cairn/`:

1. Run `cairn init` or `cairn_init_status()` — check state
2. If `not_initialized` / `empty_scaffold` / `partial`: run step-by-step init
3. Steps (in order): config → skeleton → blood → dna → stage
4. For each step: analyze → preview → user confirms → commit → check next
5. For blood: cross-reference git history, code structure, team memory, AND project instructions (CLAUDE.md, ADRs)
6. Blood auto-confirms during init. DNA traits staged for human review.

## Degraded Mode

If both CLI and MCP tools are unavailable:

1. Read `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. These are auto-generated, read-only. Do not write to views.
3. Signal capture unavailable.

When `cairn` CLI fails:

1. Run `cairn doctor` — if it errors, the install is broken
2. Reinstall with `npm install -g cairn-rt`
3. For path issues, set `CAIRN_ROOT` environment variable
