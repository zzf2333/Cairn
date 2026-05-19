# Claude Code Adapter

## Platform Rules

Claude Code obeys long structured instructions well. This adapter leverages that strength with strong imperative language and explicit lifecycle ordering.

You must actively use Cairn during technical work. Do not treat Cairn as optional memory.

Always follow the lifecycle:

```
context -> plan -> signal -> observe -> session_end
```

If blocked by an unclosed session:

```
recover first
```

Before giving architecture advice:

```
call cairn_plan
```

Before coding:

```
call cairn_context
```

Do not skip lifecycle steps silently.

---

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

---

## Initialization

On first encounter with a project that has no `.cairn/`:

1. Call `cairn_init_status()`
2. If `status` is `not_initialized`, `empty_scaffold`, or `partial`, perform step-by-step initialization
3. Steps (in order): config -> skeleton -> blood -> dna -> stage
4. For each step:
   - Analyze what the step needs. For blood: cross-reference git history, code structure, team memory/lessons, AND project instructions (CLAUDE.md, ADRs)
   - Call `cairn_init_commit({ step, ..., dry_run: true })` to preview
   - Present preview to user for confirmation
   - Call `cairn_init_commit({ step, ... })` to write
   - Call `cairn_init_status()` to check next step
5. Blood candidates auto-confirm during init (no staging)
6. DNA traits are staged — after committing the dna step, call `cairn_dna_list` to review, then `cairn_dna_accept` for each trait
7. DNA and stage steps are optional but recommended

---

## Degraded Mode

If MCP tools are unavailable from Claude Code, fall back in this order:

1. Read `.cairn/views/output.md` (global constraints), `.cairn/views/domains/<name>.md` (per-domain), `.cairn/views/stage.md` (stage advisory)
2. These are auto-generated and read-only. Do not write to views.
3. Signal capture is unavailable in degraded mode.

When `cairn_*` tools fail:

1. Ask user to run `cairn doctor` — if CLI errors, the install is broken
2. If CLI works but MCP doesn't, check `.claude/mcp.json` has `"cairn": { "command": "cairn-mcp-server" }`
3. If MCP runs but returns path errors, set `CAIRN_ROOT` in the MCP config env
