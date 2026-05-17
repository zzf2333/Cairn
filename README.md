[中文](README.zh.md) | English

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>A software project is not a pile of code. It is a path-dependent cognitive organism.</strong></p>

<p>
  <a href="https://github.com/zzf2333/Cairn/stargazers"><img src="https://img.shields.io/github/stars/zzf2333/Cairn?style=flat-square&color=f59e0b" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/cairn-mcp-server"><img src="https://img.shields.io/npm/v/cairn-mcp-server?style=flat-square&label=mcp%20server&color=2563eb" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="License MIT"/></a>
  <img src="https://img.shields.io/badge/node-18%2B-6b7280?style=flat-square" alt="Node 18+"/>
</p>

</div>

---

<p align="center"><img src="docs/diagrams/02-three-layer-architecture.png" alt="Three-layer architecture" width="880"/></p>

---

Cairn is the layer that keeps a project's cognition alive after every session ends. When code becomes abundant (AI can generate it) but cognition stays scarce (the team's reasoning history doesn't), the project repeatedly hits the same wall — the same library gets re-proposed, the same incident-driven rejection gets forgotten, the same architectural argument gets re-litigated. Cairn is the active maintenance layer that prevents that cognitive collapse.

It treats a project as a living organism with **skeleton** (domain map), **blood** (evolution events), **DNA** (emerged personality), **capillaries** (per-domain detail), **gravity** (decision weight), and **governance** (the human-ratification ladder). The Host AI is a passing visitor; Cairn is what stays.

---

## Read the docs as a single argument

The full docs at [`docs/0-enter.md`](./docs/0-enter.md) are organized as **six volumes**, meant to be read in order on a first pass:

| Volume | What |
|--------|------|
| **[i. Origin](./docs/i-origin/)** | Why this exists — the shift from code scarcity to cognition scarcity |
| **[ii. Anatomy](./docs/ii-anatomy/)** | The organs — skeleton, blood, DNA, capillaries, gravity, governance |
| **[iii. Life](./docs/iii-life/)** | The lifecycle — capture, decay, resurrection, compression, trauma |
| **[iv. Self](./docs/iv-self/)** | The reflexivity — TrustRouter, calibration, the safety valve |
| **[v. Intervene](./docs/v-intervene/)** | How you engage — install, the AI protocol, maintenance |
| **[vi. Coordinates](./docs/vi-coordinates/)** | Reference — schema, glossary, stability, performance, migration |

If you only have ten minutes, read [`0-enter.md`](./docs/0-enter.md) then [`i-origin/cognitive-collapse.md`](./docs/i-origin/cognitive-collapse.md).

---

## Supported AI tools

Two host platforms are first-class today:

| Host | Protocol file | Status |
|------|---------------|--------|
| **Claude Code** | [`skills/claude-code/SKILL.md`](./skills/claude-code/SKILL.md) | first-class |
| **Codex** | [`skills/codex.md`](./skills/codex.md) | first-class |

Other MCP-capable hosts (Cline, Windsurf, Cursor, Copilot, Gemini CLI, OpenCode) are **on the 1.x roadmap**. We removed their adapters in 0.4.1 to focus on getting the two supported platforms right; they return when each can pass the same reverse-regression bar as Claude Code and Codex.

---

## Install in 5 minutes

```bash
# 1. install
npm install -g cairn-mcp-server

# 2a. Claude Code — add to ~/.claude.json
#     "mcpServers": { "cairn": { "command": "cairn-mcp-server" } }

# 2b. Codex — add to ~/.codex/config.toml
#     [mcp_servers.cairn]
#     command = "cairn-mcp-server"

# 3. verify
cairn doctor --metrics
```

Then append the relevant protocol (`skills/claude-code/SKILL.md` or `skills/codex.md`) to your project's `CLAUDE.md` / `AGENTS.md`.

Full walkthrough in [`docs/v-intervene/enter.md`](./docs/v-intervene/enter.md).

---

## How it works (one image)

<p align="center"><img src="docs/diagrams/04-how-it-works.png" alt="How it works" width="880"/></p>

Three sources of signal — git commits, conversation turns, code-vs-cognition drift — pass through a single gate (**TrustRouter**) and land in one of three destinations: `dropped` (G0 noise), `staged` (needs human review), or `blood` (confirmed). At session end, a maintenance pipeline runs: decay, calibration, stage inference, DNA compression, views regeneration.

More diagrams:

- [Integration overview](./docs/diagrams/03-integration-overview.png) — who talks to whom
- [TrustRouter decision flow](./docs/diagrams/06-trust-router-flow.png) — what each signal goes through

---

## CLI

```
cairn init [--empty]              Initialize .cairn/ scaffold
cairn status                      Cognitive status snapshot
cairn doctor                      Consistency + auto-resurrection
cairn doctor --fix                Quarantine corrupted yaml files
cairn doctor --recover            Clear an incomplete session checkpoint
cairn doctor --metrics            .cairn/ health snapshot
cairn review                      List staged entries awaiting review
cairn audit                       Show governance audit log
cairn dna show | list | accept <id> | reject <id> <reason> | reevaluate
cairn skeleton show
cairn blood list | show <id> | archive <id> | resurrect <id> | trauma <id>
cairn stage confirm | list | accept <id> | reject <id> <reason>
cairn migrate                     Stamp cairn_version, apply pending migrations
```

Full reference: `cairn --help`.

---

## Contributing

- Issues + PRs: https://github.com/zzf2333/Cairn
- Engine rules-of-the-road: [`CLAUDE.md`](./CLAUDE.md)
- Release checklist (contributor-facing, internal): see `docs/internal/` in repo

---

## License

MIT
