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

- `cairn` — the CLI (`status`, `doctor`, `migrate`, `dna`, `blood`, ...)
- `cairn-mcp-server` — the MCP server your AI talks to via stdio

Verify:

```bash
cairn --version
# 0.4.x
```

> **Note:** You do not need to run `cairn init`. The MCP server auto-bootstraps `.cairn/` on startup if it doesn't exist. The CLI `cairn init` command still works but is optional — useful only for pre-creating the directory structure before configuring your AI tool.

---

## 2. Wire it into your AI tool

### Claude Code

Edit `.claude/mcp.json` at project root (or `~/.claude.json` for global) and add:

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

## 3. Install the protocol

The protocol tells the AI *when* to call which tool — the full session contract. Without it, the AI falls back to a compressed version in the MCP tool descriptions (sufficient for initialization but not for full lifecycle enforcement).

| Host | Command |
|------|---------|
| Claude Code | `npx skills add zzf2333/Cairn` |
| Codex | `cairn skill show codex >> AGENTS.md` |

For Claude Code, this installs the Cairn protocol as a native skill in `.claude/skills/cairn/`. Claude Code auto-loads it at session start.

The protocol defines: when to capture signals, how to respond to challenges, when lifecycle steps can be skipped, and when to call `cairn_session_end`. For production use, protocol installation is required. See [`protocol.md`](./protocol.md) for the full contract.

---

## 4. Initialize — tell the AI one sentence

You do not manually populate `.cairn/`. Just tell your AI to do it:

| Host | What to type |
|------|--------------|
| Claude Code | `Initialize Cairn for this project` or `初始化 Cairn` |
| Codex | `Initialize Cairn for this project` |

That's the trigger. The AI takes it from here — the whole process takes about 2 minutes.

### What happens behind the scenes

1. **AI calls `cairn_init_status()`** — gets a structured guide with analysis steps, all valid enum values, and tips
2. **AI analyzes your project** — reads README, deps, git log, directory structure
3. **AI proposes initial cognition (dry run)** — calls `cairn_init_commit({ dry_run: true, ... })` and shows you:
   ```
   Proposed:
     - 4 skeletons: api, data, auth, ui
     - 9 blood_candidates_auto_confirmed (G0/G1)
     - 3 blood_candidates_staged (G2+, need your review)
     - stage: maturity (confidence 0.78)
   ```
4. **You confirm** — the AI writes the cognition
5. **You review staged events** — high-gravity decisions (G2+) need your explicit accept/reject
6. **Done** — `cairn_context()` now returns real constraints; the AI is ready for work

The dry-run step matters. The AI can be wrong about your project structure on first analysis; the dry-run is the chance to catch it before anything writes.

---

## 5. Verify the install

After initialization is complete:

```bash
cairn doctor --metrics
```

Output should look something like:

```
.cairn health:
  cairn_version:       0.4.3
  blood events:        10 (10 active, 0 archived, 0 trauma)
  DNA identity:        emerging
  DNA traits:          1 (simplicity_bias: medium)
  staged backlog:      0
  last session_end:    never
  stage:               growth (confidence 0.80, advisory)
```

Non-zero blood events and a stamped `cairn_version` confirm initialization succeeded.

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
