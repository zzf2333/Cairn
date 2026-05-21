[中文](README.zh.md) | English

# Cairn

**Cognitive runtime for AI-native engineering.** Cairn keeps a project's reasoning history alive across AI sessions — decisions, rejections, constraints, and trade-offs are captured, routed through a trust system, and enforced as active cognition.

## Quick Start

```bash
# 1. Install the CLI (provides the `cairn` command)
npm install -g cairn-rt

# 2. Install the protocol skill (Claude Code)
npx skills add zzf2333/Cairn
```

Then tell your AI tool:

> Initialize Cairn for this project

## How it works

Cairn works through two layers:

**Skill Runtime Protocol** — behavioral rules installed as a native skill. The protocol defines *when* each command must run, how to process constraints, and when lifecycle steps can be skipped.

**CLI Runtime** — the commands the protocol calls:

| Command | When | What it does |
|---------|------|--------------|
| `cairn context` | At task start (session guard) | Creates session, activates constraints, detects stale sessions |
| `cairn plan` | Before architecture work | Surfaces historical constraints + DNA guidance |
| `cairn signal` | On decision / rejection / constraint | Routes through TrustRouter |
| `cairn observe` | Before git commit | Extracts and routes candidate signals |
| `cairn session-end` | Session close | Git scan → decay → calibration → stage → DNA compression |
| `cairn session-recover` | When stale session detected | Runs session-end pipeline for interrupted session |

**Mandatory every session**: `cairn context` (start) + `cairn session-end` (close).

## CLI

**Runtime commands** (called by AI / scripts, all support `--json`):

| Command | What it does |
|---------|--------------|
| `cairn context [--task <t>]` | Creates session, activates constraints |
| `cairn plan --task <t>` | Surfaces historical constraints + DNA guidance |
| `cairn signal --type <t> --what <w>` | Routes through TrustRouter |
| `cairn observe --summary <s>` | Extracts and routes candidate signals |
| `cairn session-end --summary <s>` | Git scan → decay → calibration → stage → DNA compression |
| `cairn session-recover` | Runs session-end pipeline for interrupted session |

**Management commands**:

| Command | What it does |
|---------|--------------|
| `cairn init [--empty]` | Initialize `.cairn/` scaffold |
| `cairn status` | Cognitive status snapshot |
| `cairn doctor [--fix\|--recover\|--metrics]` | Consistency checks, repairs |
| `cairn review` | List pending staged entries |
| `cairn audit` | Governance audit log |
| `cairn dna show \| list \| accept \| reject \| reevaluate` | DNA trait management |
| `cairn skeleton show` | Domain map |
| `cairn blood list \| show \| archive \| resurrect \| trauma` | Event management |
| `cairn stage confirm \| list \| accept \| reject` | Event ratification |
| `cairn skill show [platform]` | Print assembled protocol |
| `cairn migrate` | Apply pending migrations after upgrade |

Full reference: `cairn --help`.

## Configuration

### Platform setup

<details>
<summary><strong>Claude Code</strong></summary>

```bash
npm install -g cairn-rt
npx skills add zzf2333/Cairn
```

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
npm install -g cairn-rt
cairn skill show codex >> AGENTS.md
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g cairn-rt
cairn skill show cursor >> .cursorrules
```

</details>

### Project root detection

The runtime resolves `.cairn/` in this order:

1. `CAIRN_ROOT` environment variable
2. Walk up from `process.cwd()` until `.cairn/` is found

To pin to a specific project, set `CAIRN_ROOT` in your shell environment.

## Development

```bash
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run build         # Compile TypeScript
npm run dev           # Run server directly (tsx, no build needed)
```

### Reverse-regression scenarios

25 end-to-end scenarios verify Cairn's core promise — "AI does not walk into the same wall twice" — against real Claude Code and Codex sessions.

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
npm run scenarios            # both platforms × 25 scenarios
npm run scenarios:cc         # Claude Code only
npm run scenarios:codex      # Codex only
```

See `tests/scenarios/README.md` for the full coverage matrix.

## Architecture

```
cli/src/
├── actions/                 # Shared business logic
│   ├── context-action.ts
│   ├── plan-action.ts
│   ├── signal-action.ts
│   ├── observe-action.ts
│   ├── session-end-action.ts
│   └── session-recover-action.ts
├── cli/                     # CLI subcommands + runtime commands
│   ├── index.ts             # CLI router
│   ├── runtime-*.ts         # Runtime commands (delegate to actions/)
│   └── *.ts                 # Management commands
├── engines/                 # Core processing engines
│   ├── activation-engine.ts # Context-aware cognition activation
│   ├── trust-router.ts      # G0–G3 gravity-based signal routing
│   ├── challenge-engine.ts  # Reflective challenge generation
│   ├── compression-engine.ts # DNA trait identification
│   ├── decay-engine.ts      # Stale event aging
│   ├── views-engine.ts      # Generates views/ from blood
│   └── ...
├── stores/                  # YAML file read/write layer
├── schemas/                 # Zod schemas for all data types
└── utils/                   # Shared utilities
```

## License

MIT — [github.com/zzf2333/Cairn](https://github.com/zzf2333/Cairn)
