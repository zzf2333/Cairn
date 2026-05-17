# Quick Start

> Install Cairn and finish the first session in under 5 minutes. Two supported AI platforms today: **Claude Code** and **Codex**.

---

## Prerequisites

- Node.js **18+**
- An AI tool that supports MCP — Claude Code or Codex
- A git repository (Cairn scans git history; non-git directories work but with reduced features)

---

## 1. Install

```bash
npm install -g cairn-mcp-server
```

Verify:

```bash
cairn --version
# 0.4.x
```

This installs:

- The `cairn` CLI (`cairn init`, `cairn doctor`, `cairn migrate`, ...)
- The `cairn-mcp-server` binary (the MCP server your AI talks to over stdio)

---

## 2. Configure your AI tool

### Claude Code

Edit `~/.claude.json` (or `.claude/mcp.json` in your project root) and add:

```json
{
  "mcpServers": {
    "cairn": {
      "command": "cairn-mcp-server"
    }
  }
}
```

For multi-project setups, pin the project root via env:

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

Restart Claude Code. The `cairn` tool family should now show in the tool palette.

Also add `skills/claude-code/SKILL.md` content to your project-level `CLAUDE.md` or `~/.claude/CLAUDE.md`. The protocol it documents is what makes Claude Code call Cairn correctly.

### Codex

Edit `~/.codex/config.toml` (global) or `.codex/config.toml` (project-local):

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
```

For multi-project:

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
env = { CAIRN_ROOT = "/absolute/path/to/your/project" }
```

Restart `codex` CLI. Append the contents of `skills/codex.md` to your project's `AGENTS.md` (or `~/.codex/AGENTS.md` for global scope) so Codex follows the Cairn protocol.

---

## 3. Verify the install

```bash
cairn doctor --metrics
```

Should print:

```
.cairn health:
  cairn_version:       (unstamped)
  blood events:        0
  ...
```

Then in your AI tool, ask:

> "Call `cairn_init_status` and show me the raw response."

A JSON object with `status`, `has_cairn_dir`, `cairn_version`, `warnings` confirms MCP is live.

---

## 4. First session

Cairn is **AI-driven**: the AI tool calls Cairn's MCP tools at the right moments. The protocol files (`skills/claude-code/SKILL.md`, `skills/codex.md`) document those moments. The summary:

| When | Tool | What |
|------|------|------|
| First-ever encounter with `.cairn/` | `cairn_init_status` → `cairn_init_commit({ dry_run: true })` → review → `cairn_init_commit()` | AI analyzes your project, drafts initial cognition, asks you to confirm |
| Before every AI response | `cairn_context({ task, files? })` | AI loads relevant constraints, debts, challenges |
| When user makes a decision / rejects a suggestion / mentions a past attempt | `cairn_signal({ signal_type, details, evidence })` | AI captures the signal for routing |
| Before architecture-level work | `cairn_plan({ task })` | AI gets historical constraint + DNA guidance |
| At session close | `cairn_session_end({ summary, ... })` | AI runs the maintenance pipeline (git scan, decay, calibration, compression, views regen) |

You generally won't type any of these yourself. Trigger them by talking naturally to your AI tool. If you don't see the AI calling `cairn_context` before each response, the skill protocol is not loaded — re-check the SKILL.md / AGENTS.md setup.

### Worked example

```
You:    "Add caching for the /products endpoint."

AI:     (calls cairn_context with task="add caching products endpoint")

AI:     "Two things to know:
         - The project has a G3 no-go on Redis (rejected 2024-11 for
           operational complexity, see evo_087).
         - DNA trait: simplicity_bias=high.
         I'll propose in-process LRU with TTL, no new infra. OK?"

You:    "Yes, and let's not bother with cache invalidation for now —
         products list rarely changes."

AI:     (calls cairn_signal type=debt_acceptance with details about
         the deferred invalidation, revisit_when=['cache miss rate > 5%'])

AI:     (writes the code)

You:    "Looks good, ship it."

AI:     (at session close, calls cairn_session_end with a summary)
```

---

## 5. CLI fallback (when MCP isn't available)

The CLI works without MCP. Use it to inspect state, fix problems, or run maintenance in CI:

```bash
cairn status                # snapshot
cairn doctor                # consistency + auto-resurrect low-gravity archived events
cairn doctor --metrics      # health snapshot
cairn doctor --fix          # quarantine corrupted yamls
cairn doctor --recover      # clear an incomplete session checkpoint

cairn review                # list staged entries (proposed events awaiting ratification)
cairn dna show              # list DNA traits + drift warnings + reevaluation mode
cairn dna list              # list pending DNA trait candidates
cairn dna accept <id>       # accept a DNA trait candidate
cairn dna reject <id> <reason>
cairn skeleton show         # list skeleton nodes
cairn blood list            # list blood events
cairn stage list / accept / reject

cairn migrate               # stamp cairn_version into state.yaml; future schema migrations
```

Full CLI reference: `cairn --help`.

---

## 6. Where to go next

| Curious about... | Read |
|------------------|------|
| Why Cairn exists at all | [`PHILOSOPHY.md`](./PHILOSOPHY.md) |
| How it works under the hood | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Exact field-level YAML reference | [`SCHEMA.md`](./SCHEMA.md) |
| Terms used everywhere | [`GLOSSARY.md`](./GLOSSARY.md) |
| Realistic `.cairn/` shapes at different project stages | [`EXAMPLES.md`](./EXAMPLES.md) |
| Something is broken | [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) |
| File corruption or session crash | [`RECOVERY.md`](./RECOVERY.md) |
| Performance / SLO | [`PERFORMANCE.md`](./PERFORMANCE.md) |
| What's Stable vs Experimental | [`STABILITY.md`](./STABILITY.md) |
| Upgrading | [`MIGRATION.md`](./MIGRATION.md) |
