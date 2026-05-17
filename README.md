[中文](README.zh.md) | English

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>Give your AI the project context of a colleague who's been here for two years.</strong></p>

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

Cairn is an **AI-native engineering cognition engine**. It captures project decisions, rejected paths, and accepted trade-offs from Git history and AI conversations, routes them through a gravity-based trust system, and serves structured constraints that AI coding assistants consume as behavioral guardrails.

**Why this matters.** When code becomes abundant (AI can generate it) but cognition stays scarce (the team's reasoning history doesn't), the project repeatedly hits the same wall — the same library gets re-proposed, the same incident-driven rejection gets forgotten, the same architectural argument gets re-litigated. Cairn is the active maintenance layer that prevents that cognitive collapse. See [`PHILOSOPHY.md`](./docs/PHILOSOPHY.md) for the full thesis.

---

## Supported AI tools

Today, **two host platforms** are first-class:

| Host | Protocol file | Status |
|------|---------------|--------|
| **Claude Code** | [`skills/claude-code/SKILL.md`](./skills/claude-code/SKILL.md) | first-class |
| **Codex** | [`skills/codex.md`](./skills/codex.md) | first-class |

Other MCP-capable hosts (Cline, Windsurf, Cursor, Copilot, Gemini CLI, OpenCode) are **on the 1.x roadmap**. We removed their adapters in 0.4.1 to focus on getting the two supported platforms right — they will return when each can pass the same reverse-regression test suite as Claude Code and Codex.

---

## Quick Start

```bash
# 1. Install
npm install -g cairn-mcp-server

# 2a. For Claude Code — add to ~/.claude.json
#     "mcpServers": { "cairn": { "command": "cairn-mcp-server" } }

# 2b. For Codex — add to ~/.codex/config.toml
#     [mcp_servers.cairn]
#     command = "cairn-mcp-server"

# 3. Verify
cairn doctor --metrics
```

Then append the relevant protocol file (`skills/claude-code/SKILL.md` or `skills/codex.md`) to your project's `CLAUDE.md` / `AGENTS.md`.

Full walkthrough: [**QUICK_START.md**](./docs/QUICK_START.md).

---

## How it works

<p align="center"><img src="docs/diagrams/04-how-it-works.png" alt="How it works" width="880"/></p>

Three sources of signal — git commits, conversation turns, code-vs-cognition drift — pass through a single gate (**TrustRouter**) and land in one of three destinations: `dropped` (G0 noise), `staged` (needs human review), or `blood` (confirmed evolution event). At session end, a maintenance pipeline runs: decay, calibration, stage inference, DNA compression, views regeneration.

Two diagrams worth reading in order:
- [**Integration overview**](./docs/diagrams/03-integration-overview.png) — who talks to whom
- [**TrustRouter flow**](./docs/diagrams/06-trust-router-flow.png) — the decision tree every signal traverses

---

## Documentation

| Doc | Read when... |
|-----|--------------|
| [PHILOSOPHY.md](./docs/PHILOSOPHY.md) | You want the "why" — what cognition scarcity is, and why ADRs are not enough |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | You want the "how" — four layers, signal flow, the six-step `cairn_session_end` pipeline |
| [QUICK_START.md](./docs/QUICK_START.md) | You want to be up in 5 minutes |
| [SCHEMA.md](./docs/SCHEMA.md) | You want the exact YAML field reference for everything under `.cairn/` |
| [GLOSSARY.md](./docs/GLOSSARY.md) | A term you saw needs a definition |
| [EXAMPLES.md](./docs/EXAMPLES.md) | You want to see realistic `.cairn/` shapes for small / mid / mature projects |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Something feels off |
| [RECOVERY.md](./docs/RECOVERY.md) | A file is corrupted or a session crashed mid-pipeline |
| [PERFORMANCE.md](./docs/PERFORMANCE.md) | You want benchmark numbers and SLO methodology |
| [STABILITY.md](./docs/STABILITY.md) | You want to know what's Stable / Experimental / Internal |
| [MIGRATION.md](./docs/MIGRATION.md) | You are upgrading and need the diff |

---

## CLI

```
cairn init [--empty]              Initialize .cairn/ scaffold
cairn status                      Cognitive status snapshot
cairn doctor                      Consistency + auto-resurrection
cairn doctor --fix                Quarantine corrupted yaml files
cairn doctor --recover            Clear an incomplete session checkpoint
cairn doctor --metrics            Print .cairn/ health (blood/DNA/staged/last session)
cairn review                      List staged entries awaiting human review
cairn audit                       Show governance audit log
cairn dna show | list | accept <id> | reject <id> <reason>
cairn skeleton show
cairn blood list | show <id> | archive <id> | resurrect <id> | trauma <id>
cairn stage confirm | list | accept <id> | reject <id> <reason>
cairn migrate                     Stamp cairn_version, apply pending migrations
```

Full reference: `cairn --help`.

---

## Contributing

- Issues + PRs: https://github.com/zzf2333/Cairn
- Engine architecture rules-of-the-road: [CLAUDE.md](./CLAUDE.md)
- Release checklist: [docs/RELEASE_READINESS.md](./docs/RELEASE_READINESS.md)

---

## License

MIT
