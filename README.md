[中文](README.zh.md) | English

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>A software project is not a pile of code. It is a path-dependent cognitive organism.</strong></p>

<p>Cairn is the MCP layer that keeps that organism's cognition alive across AI sessions.</p>

<p>
  <a href="https://github.com/zzf2333/Cairn/stargazers"><img src="https://img.shields.io/github/stars/zzf2333/Cairn?style=flat-square&color=f59e0b" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/cairn-mcp-server"><img src="https://img.shields.io/npm/v/cairn-mcp-server?style=flat-square&label=mcp%20server&color=2563eb" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="License MIT"/></a>
  <img src="https://img.shields.io/badge/node-18%2B-6b7280?style=flat-square" alt="Node 18+"/>
</p>

</div>

---

When code becomes abundant (AI generates it) but cognition stays scarce (the team's reasoning history doesn't), a project keeps hitting the same wall — the same library gets re-proposed, the same incident-driven rejection gets forgotten, the same architectural argument gets re-litigated.

Cairn is the active maintenance layer that prevents that cognitive collapse. It treats a project as a living organism with **skeleton** (domain map), **blood** (evolution events), **DNA** (emerged personality), **capillaries** (per-domain detail), **gravity** (decision weight), and **governance** (the human-ratification ladder). The Host AI is a passing visitor; Cairn is what stays.

---

## What Cairn gives the AI

Cairn exposes 14 MCP tools. Two are mandatory in every session flow; the rest are queue management and maintenance.

| Tool | When the AI calls it | What it does |
|------|----------------------|--------------|
| `cairn_context` | At task start or file pivot | Activates domain-relevant cognition, constraints, challenges |
| `cairn_plan` | Before design / architecture work | Pulls historical constraints + DNA guidance for the task |
| `cairn_signal` | On detecting a decision / rejection / constraint | Routes through TrustRouter, logs governance result |
| `cairn_session_end` | Session close with summary | Git scan → decay → calibration → stage inference → DNA compression |
| `cairn_status` | Mid-session health check | Snapshot of blood / staged / DNA / phase |
| `cairn_stage_list` | Reviewing pending events | Lists staged evolution candidates awaiting ratification |
| `cairn_stage_accept` | Approve event candidate | Promotes to blood, applies stage transition, logs audit |
| `cairn_stage_reject` | Decline event candidate | Rejects entry, logs governance decision |
| `cairn_dna_list` | Reviewing DNA candidates | Lists trait candidates from compression |
| `cairn_dna_accept` | Approve trait | Writes trait to identity, regenerates views |
| `cairn_dna_reject` | Decline trait | Marks rejected in staged store |
| `cairn_init_status` | Startup or recovery | Checks init, version mismatch, incomplete sessions |
| `cairn_init_commit` | Bootstrap after analysis | Writes initial config, skeleton, blood, DNA |
| `cairn_doctor` | Diagnostics / troubleshooting *(maintenance)* | Consistency checks, decay actions, resurrection candidates |

**Mandatory every flow**: `cairn_context` (start) + `cairn_session_end` (close). Everything else is on-demand or human-ratification.

---

## How it works (one image)

<p align="center"><img src="docs/diagrams/04-how-it-works.png" alt="How it works" width="880"/></p>

Three sources of signal — git commits, conversation turns, code-vs-cognition drift — pass through a single gate (**TrustRouter**) and land in one of three destinations: `dropped` (G0 noise), `staged` (needs human review), or `blood` (confirmed). At session end, a maintenance pipeline runs: decay, calibration, stage inference, DNA compression, views regeneration.

<p align="center"><img src="docs/diagrams/02-three-layer-architecture.png" alt="Three-layer architecture" width="880"/></p>

More diagrams: [Integration overview](./docs/diagrams/03-integration-overview.png) · [TrustRouter decision flow](./docs/diagrams/06-trust-router-flow.png).

---

## Install in 3 minutes

**Step 1 — Install**

```bash
npm install -g cairn-mcp-server
```

**Step 2 — Wire MCP** (pick your host)

| Host | Config file | Add this |
|------|-------------|----------|
| Claude Code | `.claude/mcp.json` or `~/.claude.json` | `"mcpServers": { "cairn": { "command": "cairn-mcp-server" } }` |
| Codex | `~/.codex/config.toml` | `[mcp_servers.cairn]`<br>`command = "cairn-mcp-server"` |

Restart your AI tool after editing.

**Step 3 — Initialize** (one sentence in your AI tool)

No `cairn init` needed — just tell your AI:

> **Claude Code**: `Initialize Cairn for this project`
>
> **Codex**: `Initialize Cairn for this project`

The AI will analyze your project, propose initial cognition (skeleton + decisions + stage) for your review, and write it after you confirm. The whole process takes about 2 minutes.

**Step 4 (optional) — Add the protocol file**

Append the skill file to your project instructions for stronger ongoing session enforcement:

| Host | File | Append to |
|------|------|-----------|
| Claude Code | `skills/claude-code/SKILL.md` | `CLAUDE.md` |
| Codex | `skills/codex.md` | `AGENTS.md` |

Full walkthrough in [`docs/v-intervene/enter.md`](./docs/v-intervene/enter.md).

### Supported hosts

| Host | Protocol file | Status |
|------|---------------|--------|
| **Claude Code** | [`skills/claude-code/SKILL.md`](./skills/claude-code/SKILL.md) | first-class |
| **Codex** | [`skills/codex.md`](./skills/codex.md) | first-class |

Other MCP-capable hosts (Cline, Windsurf, Cursor, Copilot, Gemini CLI, OpenCode) are on the 1.x roadmap. We removed their adapters in 0.4.1 to focus on getting the two supported platforms right; they return once each can pass the same reverse-regression bar.

---

## A session in flight

```
cairn_init_status  →  cairn_context  →  [your work]  →  cairn_signal (×N)  →  cairn_session_end
   one-time            every task         AI codes         on decision           maintenance
```

Three concrete flows the AI runs on its own:

- **Fresh task** — `cairn_context` activates constraints → AI codes → flags one decision via `cairn_signal` → `cairn_session_end` compresses.
- **Design review** — `cairn_plan` surfaces what was tried before → AI proposes only un-tried paths.
- **Ratification** — `cairn_stage_list` (you) → `cairn_stage_accept` / `cairn_stage_reject` → blood updated.

---

## What's in `.cairn/`

Cairn writes plain YAML you can read, diff, and git-track. Nothing leaves your machine.

| File | What's in it |
|------|--------------|
| `.cairn/config.yaml` + `state.yaml` | Cognitive mode, version, last-session checkpoint |
| `.cairn/skeleton/` | Domain map (paths, owners) |
| `.cairn/blood/` | Confirmed evolution events — decisions, rejections, trade-offs |
| `.cairn/dna/` | Emerged project traits (e.g. `simplicity_bias`) |
| `.cairn/staged/` | Candidates awaiting your ratification |
| `.cairn/views/output.md` | Auto-generated digest for humans — read this if curious |

**Not written**: source code contents, tokens, credentials, anything outside `.cairn/`.
**Recommendation**: commit `.cairn/`. It is part of the project's memory.

---

## CLI

| Command | When | What it does |
|---------|------|--------------|
| `cairn init [--empty]` | Optional — pre-create scaffold | Scaffolds `.cairn/` directory (MCP server auto-bootstraps if missing) |
| `cairn status` | Quick health glance | Cognitive snapshot |
| `cairn doctor [--fix\|--recover\|--metrics]` | Something feels off | Consistency, auto-resurrection, repairs |
| `cairn review` | Catch up on staged queue | Lists entries awaiting ratification |
| `cairn audit` | Governance trail | Shows audit log |
| `cairn dna show \| list \| accept \| reject \| reevaluate` | DNA trait management | Inspect or ratify traits |
| `cairn skeleton show` | Domain map check | Prints skeleton tree |
| `cairn blood list \| show \| archive \| resurrect \| trauma` | Event-level surgery | Manage individual evolution events |
| `cairn stage confirm \| list \| accept \| reject` | Event ratification | Process the staged queue |
| `cairn migrate` | After upgrade | Stamps version, applies pending migrations |

Full reference: `cairn --help`.

---

## The six volumes

Full docs at [`docs/0-enter.md`](./docs/0-enter.md) — organized as six volumes meant to be read in order on a first pass.

| Volume | What | Read it if you... |
|--------|------|-------------------|
| **[i. Origin](./docs/i-origin/)** | Why this exists | want the philosophy first (10 min) |
| **[ii. Anatomy](./docs/ii-anatomy/)** | The organs — skeleton, blood, DNA, capillaries, gravity, governance | want the architecture map (20 min) |
| **[iii. Life](./docs/iii-life/)** | The lifecycle — capture, decay, resurrection, compression, trauma | care how cognition ages (15 min) |
| **[iv. Self](./docs/iv-self/)** | Reflexivity — TrustRouter, calibration, the safety valve | want to know how it checks itself (10 min) |
| **[v. Intervene](./docs/v-intervene/)** | Install, the AI protocol, maintenance | just want to use it (5 min) |
| **[vi. Coordinates](./docs/vi-coordinates/)** | Schema, glossary, stability, performance, migration | look up on demand |

**Three reading paths**:
- **Philosopher** → `0-enter` → `i. Origin` → `ii. Anatomy`
- **Engineer** → `0-enter` → `ii. Anatomy` → `vi. Coordinates`
- **Operator** → `0-enter` → `v. Intervene` → the CLI section above

If you only have ten minutes, read [`0-enter.md`](./docs/0-enter.md) then [`i-origin/cognitive-collapse.md`](./docs/i-origin/cognitive-collapse.md).

---

## Why Cairn

I kept watching AI agents propose paths the project had already tried and rejected — sometimes from a decision made three months earlier, sometimes from one made last week. The agents were not wrong; the project just had no memory it could hand back.

Cairn is the layer that remembers.

---

## Contributing

- Issues + PRs: https://github.com/zzf2333/Cairn
- Engine rules-of-the-road: [`CLAUDE.md`](./CLAUDE.md)
- Release checklist (contributor-facing, internal): see `docs/internal/` in repo

---

## License

MIT
