# Enter

> The install path is short on purpose. The hard work — building cognition — happens after you're in.

---

## What you need

- Node.js **18+**
- An AI tool that speaks MCP — today: **Claude Code** or **Codex**
- A git repository (non-git also works, with reduced calibration features)

---

## 1. Install the runtime

```bash
npm install -g cairn-mcp-server
```

This puts two binaries on your `$PATH`:

- `cairn` — the CLI (`init`, `doctor`, `migrate`, `dna`, `blood`, ...)
- `cairn-mcp-server` — the MCP server your AI talks to via stdio

Verify:

```bash
cairn --version
# 0.4.x
```

---

## 2. Wire it into your AI tool

### Claude Code

Edit `~/.claude.json` (or `.claude/mcp.json` at project root) and add:

```json
{
  "mcpServers": {
    "cairn": {
      "command": "cairn-mcp-server"
    }
  }
}
```

Multi-project? Pin the project root explicitly:

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

Restart Claude Code. The `cairn_*` tool family should now appear in the tool palette.

### Codex

Edit `~/.codex/config.toml` (global) or `.codex/config.toml` (project):

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
```

With per-project pin:

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
env = { CAIRN_ROOT = "/absolute/path/to/your/project" }
```

Restart the `codex` CLI.

---

## 3. Hand the AI its protocol

The runtime is wired. The AI still doesn't know *when* to call which tool. That contract lives in the skill files:

| Host | File | Action |
|------|------|--------|
| Claude Code | `skills/claude-code/SKILL.md` | Append to your `CLAUDE.md` (project root or `~/.claude/`) |
| Codex | `skills/codex.md` | Append to your `AGENTS.md` (project root or `~/.codex/`) |

The skill file explains: when to call `cairn_init_status`, when to call `cairn_context`, when to capture a signal, how to handle staged review, when to call `cairn_session_end`, what to do with `interaction_hint`, how to respond to challenges. The full protocol — see [`protocol.md`](./protocol.md).

Without the skill file, the AI sees the tools but doesn't know when to use them. With it, behavior changes immediately.

---

## 4. Verify the install

```bash
cairn doctor --metrics
```

Output should look like:

```
.cairn health:
  cairn_version:       (unstamped)
  blood events:        0 (0 active, 0 archived, 0 trauma)
  DNA identity:        not_yet_emerged
  DNA traits:          0 (none)
  staged backlog:      0
  last session_end:    never
  stage:               exploration (confidence 0.00, advisory)
```

That's a healthy fresh install. Now ask your AI:

> "Call `cairn_init_status` and show me the raw response."

A JSON object with `status`, `has_cairn_dir`, `cairn_version`, `warnings` confirms MCP is live and the AI can reach Cairn.

---

## 5. First session — the AI drives

You do not manually populate `.cairn/`. The AI does, by following the skill protocol. A typical first session looks like:

1. AI calls `cairn_init_status` → sees `status: not_initialized`
2. AI analyzes your project (README, deps, git log, source structure)
3. AI calls `cairn_init_commit({ dry_run: true, ... })` — proposes initial skeleton + blood candidates + possibly stage / DNA
4. AI shows you the dry-run report:
   ```
   Proposed:
     - 4 skeletons: api, data, auth, ui
     - 12 blood_candidates_auto_confirmed (G0/G1)
     - 3 blood_candidates_staged (G2+, need your review)
     - stage: maturity (confidence 0.78)
   ```
5. You read it, confirm or adjust
6. AI calls `cairn_init_commit({ ... })` (without `dry_run`) to write
7. AI proceeds with whatever you originally asked for, now with cognition loaded

The dry-run step matters. The AI can be wrong about your project structure on first analysis; the dry-run is the chance to catch it before anything writes.

---

## 6. From here

| Want to | Read |
|---------|------|
| Understand the AI's protocol in detail | [`protocol.md`](./protocol.md) |
| Maintain the system (recovery, drift, performance) | [`tend.md`](./tend.md) |
| Understand what Cairn is doing under the hood | [`../ii-anatomy/`](../ii-anatomy/) and [`../iii-life/`](../iii-life/) |
| Diagnose why something feels off | [`tend.md`](./tend.md) starts with the diagnostic surface |

---

## A note on `.cairn/`

After the first session, your project has a `.cairn/` directory. Commit it.

`.cairn/` is **git-tracked by design**. It's not a cache, not a database, not a per-developer convenience — it is the project's cognition export. It belongs to the repo. Adding it to `.gitignore` is the most common newcomer mistake; it makes the whole system local-only and erases the value the next time someone clones.

A `.gitignore` entry of `.cairn/logs/` is fine (those are local tool-call logs). A `.gitignore` entry of `.cairn/` is not.

---

## Two supported hosts, deliberately

Today: Claude Code, Codex. That's it.

The other six MCP-capable hosts (Cline, Windsurf, Cursor, Copilot, Gemini CLI, OpenCode) had adapters in earlier releases. They're being held out of 0.4.x while the supported two get tested rigorously against the reverse-regression suite. They return in the 1.x line, one at a time, after each one passes the same bar.

This is a refusal to grow the supported surface faster than the supported quality. The cost of half-working integration is borne by users; the cost of waiting is borne by the project. We chose to bear the latter.

---

## See also

- [`protocol.md`](./protocol.md) — what the AI does once it has the skill file
- [`tend.md`](./tend.md) — keeping the system healthy
- [`../0-enter.md`](../0-enter.md) — the conceptual entry point, if you arrived here via install and want to understand what you just turned on
