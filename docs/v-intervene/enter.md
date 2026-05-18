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

## 3. (Optional) Hand the AI its protocol

The skill files tell the AI *when* to call which tool — the full session contract:

| Host | File | Action |
|------|------|--------|
| Claude Code | `skills/claude-code/SKILL.md` | Append to your `CLAUDE.md` (project root or `~/.claude/`) |
| Codex | `skills/codex.md` | Append to your `AGENTS.md` (project root or `~/.codex/`) |

Without the skill file, the AI still has Cairn's built-in MCP instructions and can perform initialization. The skill file adds stronger enforcement for ongoing session behavior — when to capture signals, how to respond to challenges, when to call `cairn_session_end`. See [`protocol.md`](./protocol.md) for the full contract.

---

## 4. First session — the AI drives

You do not manually populate `.cairn/`. The AI does, guided by Cairn's built-in instructions. Here's what happens:

### Step 1: AI detects uninitialized state

The AI calls `cairn_init_status()` and gets back:

```json
{
  "status": "not_initialized",
  "guide": {
    "analysis_steps": [
      "Read README.md and docs/",
      "Check package.json / Cargo.toml / go.mod",
      "Run git log --oneline -20",
      "Examine directory structure for domain boundaries",
      "..."
    ],
    "schema_reference": {
      "event_types": ["architecture_decision", "rejection", "constraint_added", ...],
      "behavior_effect_types": ["avoid_suggestion", "prefer_approach", "warn_before", "require_review"],
      "validity_levels": ["transient", "tactical", "strategic", "identity"],
      "..."
    },
    "tips": ["Always call with dry_run: true first", "Aim for 5-15 blood_candidates", "..."]
  }
}
```

The `guide` contains everything the AI needs: what to analyze, all valid enum values for every field, and practical tips. The AI follows this guide to analyze your project.

### Step 2: AI proposes initial cognition (dry run)

```
cairn_init_commit({ dry_run: true, config, skeleton, blood_candidates, stage?, dna? })
```

The dry-run shows what would be written and how TrustRouter would route each blood candidate:

```
Proposed:
  - 4 skeletons: api, data, auth, ui
  - 9 blood_candidates_auto_confirmed (G0/G1)
  - 3 blood_candidates_staged (G2+, need your review)
  - stage: maturity (confidence 0.78)
```

### Step 3: You confirm, AI writes

You review the dry-run output and confirm. The AI calls `cairn_init_commit(...)` without `dry_run` to write.

### Step 4: Review staged events

High-gravity events (G2+ in standard mode) go to the staged queue. The AI calls `cairn_stage_list()` and presents each entry for your accept/reject decision.

### Step 5: Ready

`cairn_context()` now returns real constraints and domain activations. The AI proceeds with whatever you originally asked for, now with cognition loaded.

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
