# Cairn

**AI path-dependency constraint system.**

Cairn structures your project's historical decisions, rejected paths, and accepted
trade-offs into a three-layer format that AI coding assistants read automatically —
so they work within your project's real constraints instead of suggesting in a vacuum.

---

## The Problem

Every AI coding session starts from zero. The assistant doesn't know:

- Which directions were already tried and rejected (and why)
- What technical debt was intentionally accepted and should not be touched
- What stage the project is in and what trade-offs are appropriate right now

The result: AI tools repeatedly suggest directions you've already ruled out, propose
refactors you've deliberately deferred, and give advice calibrated for a project they
can't actually see.

Cairn solves this by placing structured constraint files in your repository that AI
tools read at the start of every session.

---

## How It Works

Cairn uses a three-layer directory at your repository root:

```
.cairn/
├── output.md          # Layer 1: global constraints, read every session
├── domains/           # Layer 2: domain design context, read during planning
│   ├── api-layer.md
│   └── auth.md
└── history/           # Layer 3: raw decision events, queried on demand
    ├── 2023-09_trpc-experiment-rejection.md
    └── 2024-01_auth-debt-accepted.md
```

| Layer | File | When AI Reads | Token Budget |
|-------|------|---------------|--------------|
| Global Constraints | `.cairn/output.md` | Every session, always | 500 target / 800 max |
| Domain Context | `.cairn/domains/*.md` | During planning & design | 200–400 per file |
| Decision History | `.cairn/history/*.md` | On-demand precise queries | Unlimited |

The AI reads `output.md` first to establish what's off-limits and what the current
project stage is. When planning a feature, it reads the relevant domain file to
understand the evolution of that area and the pitfalls to avoid. When it needs to
know exactly why a past decision was made, it queries `history/`.

---

## Key Concepts

Three types of constraints, each producing different AI behavior:

| Concept | What It Means | AI Behavior |
|---------|---------------|-------------|
| **no-go** | A direction that was evaluated and excluded | Do not suggest it |
| **accepted debt** | A known defect that was intentionally left in place | Do not attempt to fix it |
| **known pitfalls** | An operational trap in a specific domain | Actively avoid trigger conditions |

---

## Quick Start

### Option A: Interactive init script (recommended)

```bash
# Download and run
curl -sL https://raw.githubusercontent.com/zzf2333/Cairn/main/scripts/cairn-init.sh -o cairn-init.sh
chmod +x cairn-init.sh
./cairn-init.sh
```

The script guides you through 5 steps in about 30 minutes:
1. Choose your project's domains (from 11 standard options)
2. Fill in `output.md` (stage, no-go, stack, accepted debt)
3. Initialize `history/` with an entry template
4. Initialize `domains/` (empty — this is normal)
5. Install the Skill adapter for your AI tool

### Option B: Manual setup

1. Create `.cairn/output.md` with the five required sections. See [`spec/FORMAT.md`](spec/FORMAT.md) for the exact format and [`examples/saas-18mo/.cairn/output.md`](examples/saas-18mo/.cairn/output.md) for a complete example.

2. Create `.cairn/domains/` and `.cairn/history/` directories (both empty to start).

3. Copy the appropriate Skill adapter file to your AI tool's expected location (see table below).

---

## Supported AI Tools

| Tool | Adapter File | Install Location |
|------|-------------|-----------------|
| Claude Code | `skills/claude-code/SKILL.md` | `.claude/skills/cairn/SKILL.md` |
| Cursor | `skills/cursor.mdc` | `.cursor/rules/cairn.mdc` |
| Cline / Roo Code | `skills/cline.md` | `.clinerules` (append) |
| Windsurf | `skills/windsurf.md` | `.windsurfrules` (append) |
| GitHub Copilot | `skills/copilot-instructions.md` | `.github/copilot-instructions.md` (append) |
| Codex CLI | `skills/codex.md` | `AGENTS.md` (append) |
| Gemini CLI | `skills/gemini-cli.md` | `GEMINI.md` (append) |
| OpenCode | `skills/opencode.md` | `AGENTS.md` (append, shared with Codex) |

Adapter templates are in [`skills/`](skills/). Copy the relevant file and place it at the install location above, relative to your project root. `cairn-init.sh` handles this automatically for all eight tools.

---

## Example

[`examples/saas-18mo/`](examples/saas-18mo/) contains a complete three-layer example
from an 18-month SaaS project, including:

- `output.md` with stage, no-go rules (tRPC, Redux, Kubernetes), active stack, and accepted debts
- Three domain files: `api-layer`, `auth`, `state-management`
- Four history events: state management migration, tRPC experiment rejection, auth debt acceptance, growth stage transition

---

## Documentation

| Document | Contents |
|----------|----------|
| [`spec/FORMAT.md`](spec/FORMAT.md) | Complete format reference for all three layers |
| [`spec/DESIGN.md`](spec/DESIGN.md) | Why Cairn is designed the way it is |
| [`spec/vs-adr.md`](spec/vs-adr.md) | How Cairn relates to Architecture Decision Records |
| [`spec/adoption-guide.md`](spec/adoption-guide.md) | Step-by-step Init and Reactive adoption guide |

---

## Repository Structure

```
cairn/
├── spec/
│   ├── FORMAT.md               # Three-layer format specification
│   ├── DESIGN.md               # Design rationale
│   ├── vs-adr.md               # Cairn vs. ADR comparison
│   └── adoption-guide.md       # Init + Reactive adoption guide
├── skills/
│   ├── claude-code/SKILL.md    # Claude Code adapter
│   ├── cursor.mdc              # Cursor adapter
│   ├── cline.md                # Cline / Roo Code adapter
│   ├── windsurf.md             # Windsurf adapter
│   ├── copilot-instructions.md # GitHub Copilot adapter
│   ├── codex.md                # Codex CLI adapter (AGENTS.md)
│   ├── gemini-cli.md           # Gemini CLI adapter (GEMINI.md)
│   └── opencode.md             # OpenCode adapter (AGENTS.md)
├── examples/
│   └── saas-18mo/              # 18-month SaaS project example
│       └── .cairn/
│           ├── output.md
│           ├── domains/
│           └── history/
├── scripts/
│   └── cairn-init.sh           # Standalone interactive initialization script
├── cli/
│   ├── cairn                   # CLI entry point (cairn init/status/log/sync)
│   └── cmd/
│       ├── init.sh             # cairn init — delegates to scripts/cairn-init.sh
│       ├── status.sh           # cairn status — three-layer summary + stale detection
│       ├── log.sh              # cairn log — record history entries
│       └── sync.sh             # cairn sync — generate AI prompt for domain updates
└── docs/
    └── design.md               # Internal design working draft (Chinese)
```

---

## CLI (Phase 2)

Cairn includes a command-line tool for working with the three-layer directory.

### Installation

Add the `cli/` directory to your `PATH`, or symlink `cli/cairn` to `/usr/local/bin/cairn`:

```bash
git clone https://github.com/your-org/cairn
ln -s "$(pwd)/cairn/cli/cairn" /usr/local/bin/cairn
```

Requires Bash 3.2+ (macOS system bash is sufficient).

### Commands

```bash
# Initialize .cairn/ in the current project (interactive)
cairn init

# Show three-layer summary and stale domain warnings
cairn status

# Record a history entry (interactive or flag mode)
cairn log
cairn log --type rejection --domain api-layer --summary "Rejected GraphQL after evaluation" \
    --rejected "GraphQL: data complexity doesn't justify it" \
    --reason "Current team size makes GraphQL overhead unwarranted" \
    --revisit-when "Frontend needs regular cross-resource aggregation"

# Generate an AI prompt to update a domain file from its history entries
cairn sync api-layer            # specific domain
cairn sync --stale              # all stale domains
cairn sync api-layer --dry-run  # preview what would be included
cairn sync api-layer --copy     # copy prompt to clipboard
```

### Stale Detection

`cairn status` compares each domain file's `updated:` frontmatter field against the
`recorded_date` of its history entries. A domain is stale when history entries have
been added after the domain file's last update:

```
$ cairn status

stage:   early-growth (2024-09+)
domains: 3 active, 1 not created

⚠  api-layer   last updated 2024-03 · 2 new history entries since
               run: cairn sync api-layer

✓  auth        up to date (2024-06)
✓  state-management  up to date (2024-03)
·  database    not yet created (0 history entries)

history: 4 entries total
```

---

## Roadmap

- **Phase 1 ✓:** Protocol — format specification, tool adapters, examples, init script
- **Phase 2 ✓:** CLI — `cairn init`, `cairn status`, `cairn log`, `cairn sync`
- **Phase 3 ✓:** MCP Server — 6 typed tool calls + 2 resources for AI-native Cairn access (`mcp/`)

---

## License

MIT
