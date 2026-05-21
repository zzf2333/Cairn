[中文](README.zh.md) | English

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>A software project is not a pile of code. It is a path-dependent cognitive organism.</strong></p>

<p>Cairn is the cognitive runtime protocol that keeps that organism's memory alive across AI sessions — delivered as a CLI + skill protocol with a behavioral contract the AI follows.</p>

<p>
  <a href="https://github.com/zzf2333/Cairn/stargazers"><img src="https://img.shields.io/github/stars/zzf2333/Cairn?style=flat-square&color=f59e0b" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/cairn-mcp-server"><img src="https://img.shields.io/npm/v/cairn-mcp-server?style=flat-square&label=npm&color=2563eb" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="License MIT"/></a>
  <img src="https://img.shields.io/badge/node-18%2B-6b7280?style=flat-square" alt="Node 18+"/>
</p>

</div>

---

When code becomes abundant (AI generates it) but cognition stays scarce (the team's reasoning history doesn't), a project keeps hitting the same wall — the same library gets re-proposed, the same incident-driven rejection gets forgotten, the same architectural argument gets re-litigated.

Cairn is the active maintenance layer that prevents that cognitive collapse. It treats a project as a living organism with **skeleton** (domain map), **blood** (evolution events), **DNA** (emerged personality), **capillaries** (per-domain detail), **gravity** (decision weight), and **governance** (the human-ratification ladder). The Host AI is a passing visitor; Cairn is what stays.

---

## What Cairn gives the AI

Cairn works through two layers:

**Skill Runtime Protocol** — behavioral rules installed as a native skill (`npx skills add zzf2333/Cairn` for Claude Code). The protocol defines *when* each command must run, how to process constraints, and when lifecycle steps can be skipped.

**CLI Runtime** — the commands the protocol calls. The AI runs these as shell commands during its session:

| Command | When | What it does |
|---------|------|--------------|
| `cairn context` | At task start (session guard) | Creates session, activates constraints, detects stale sessions |
| `cairn plan` | Before architecture work | Surfaces historical constraints + DNA guidance |
| `cairn signal` | On decision / rejection / constraint | Routes through TrustRouter |
| `cairn observe` | Before git commit | Extracts and routes candidate signals |
| `cairn session-end` | Session close | Git scan → decay → calibration → stage → DNA compression |
| `cairn session-recover` | When stale session detected | Runs session-end pipeline for interrupted session |

**Mandatory every session**: `cairn context` (start) + `cairn session-end` (close). `cairn context` acts as the session guard — it tracks an active session state machine and detects interrupted sessions.

<details>
<summary><strong>Advanced: MCP mode</strong></summary>

MCP tools (`cairn_context`, `cairn_plan`, etc.) map 1:1 to CLI commands. Add to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "cairn": { "command": "cairn-mcp-server" }
  }
}
```

MCP mode provides tool-level integration for AI runtimes that support the Model Context Protocol. The protocol and behavior are identical to skill + CLI mode.

</details>

---

## How it works (one image)

<p align="center"><img src="docs/diagrams/04-how-it-works.png" alt="How it works" width="880"/></p>

Three sources of signal — git commits, conversation turns, code-vs-cognition drift — pass through a single gate (**TrustRouter**) and land in one of three destinations: `dropped` (G0 noise), `staged` (needs human review), or `blood` (confirmed). At session end, a maintenance pipeline runs: decay, calibration, stage inference, DNA compression, views regeneration.

<p align="center"><img src="docs/diagrams/02-three-layer-architecture.png" alt="Three-layer architecture" width="880"/></p>

More diagrams: [Integration overview](./docs/diagrams/03-integration-overview.png) · [TrustRouter decision flow](./docs/diagrams/06-trust-router-flow.png).

---

## Quick Start — Claude Code

```bash
# 1. Install the CLI (provides the `cairn` command)
npm install -g cairn-mcp-server

# 2. Install the protocol skill
npx skills add zzf2333/Cairn
```

Then tell Claude Code:

> Initialize Cairn for this project

The AI analyzes your project, proposes initial cognition for your review, and writes it after you confirm. Takes about 2 minutes.

<details>
<summary><strong>Optional: MCP mode (for runtimes that support MCP)</strong></summary>

If your AI runtime supports MCP natively, you can also add Cairn to `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "cairn": { "command": "cairn-mcp-server" }
  }
}
```

MCP tools map 1:1 to CLI commands. The skill + CLI path above is the recommended default.

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
npm install -g cairn-mcp-server
cairn skill show codex >> AGENTS.md
```

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
```

Restart Codex, then say: `Initialize Cairn for this project`

</details>

Full walkthrough with verification steps: [`docs/v-intervene/enter.md`](./docs/v-intervene/enter.md)

---

## A session in flight

```
cairn context  →  [your work]  →  cairn signal (×N)  →  cairn session-end
session guard       AI codes         on decision           maintenance
(+ stale detect)                                       cairn session-recover
                                                          (if previous crashed)
```

Four concrete flows the AI runs on its own:

- **Fresh task** — `cairn context` creates session + activates constraints → AI codes → flags decisions via `cairn signal` → `cairn session-end` compresses.
- **Stale recovery** — `cairn context` detects unclosed session → `cairn session-recover` runs maintenance pipeline → new session begins cleanly.
- **Design review** — `cairn plan` surfaces what was tried before → AI proposes only un-tried paths.
- **Ratification** — `cairn review` (you) → `cairn stage accept` / `cairn stage reject` → blood updated.

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

**Runtime commands** (called by AI / scripts, all support `--json`):

| Command | When | What it does |
|---------|------|--------------|
| `cairn context [--task <t>]` | At task start | Creates session, activates constraints, detects stale sessions |
| `cairn plan --task <t>` | Before architecture work | Surfaces historical constraints + DNA guidance |
| `cairn signal --type <t> --what <w>` | On decision / rejection | Routes through TrustRouter |
| `cairn observe --summary <s>` | Before git commit | Extracts and routes candidate signals |
| `cairn session-end --summary <s>` | Session close | Git scan → decay → calibration → stage → DNA compression |
| `cairn session-recover` | After stale session detected | Runs session-end pipeline for interrupted session |

**Management commands**:

| Command | When | What it does |
|---------|------|--------------|
| `cairn init [--empty]` | Optional — pre-create scaffold | Scaffolds `.cairn/` directory |
| `cairn status` | Quick health glance | Cognitive snapshot |
| `cairn doctor [--fix\|--recover\|--metrics]` | Something feels off | Consistency, auto-resurrection, repairs |
| `cairn review` | Catch up on staged queue | Lists entries awaiting ratification |
| `cairn audit` | Governance trail | Shows audit log |
| `cairn dna show \| list \| accept \| reject \| reevaluate` | DNA trait management | Inspect or ratify traits |
| `cairn skeleton show` | Domain map check | Prints skeleton tree |
| `cairn blood list \| show \| archive \| resurrect \| trauma` | Event-level surgery | Manage individual evolution events |
| `cairn stage confirm \| list \| accept \| reject` | Event ratification | Process the staged queue |
| `cairn skill show [platform]` | Protocol preview | Print assembled protocol to stdout |
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
- Protocol: [`SKILL.md`](./SKILL.md)
- Release checklist (contributor-facing, internal): see `docs/internal/` in repo

---

## License

MIT
