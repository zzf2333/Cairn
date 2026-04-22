[中文](README.zh.md) | English

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>Give your AI the project context of a colleague who's been here for two years.</strong></p>

<p>
  <a href="https://github.com/zzf2333/Cairn/stargazers"><img src="https://img.shields.io/github/stars/zzf2333/Cairn?style=flat-square&color=f59e0b" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/cairn-mcp-server"><img src="https://img.shields.io/npm/v/cairn-mcp-server?style=flat-square&label=mcp%20server&color=2563eb" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="License MIT"/></a>
  <img src="https://img.shields.io/badge/bash-3.2%2B-6b7280?style=flat-square" alt="Bash 3.2+"/>
  <img src="https://img.shields.io/badge/node-18%2B-6b7280?style=flat-square" alt="Node 18+"/>
</p>

</div>

---

Cairn structures your project's historical decisions, rejected paths, and accepted trade-offs
into a three-layer format that AI coding assistants read automatically — so they work within
your project's real constraints instead of suggesting in a vacuum.

---

## The Problem

Your project is 18 months old. In month 7, you migrated from Redux to Zustand — the boilerplate
cost wasn't worth it for a two-person team. In month 11, you tried tRPC, hit integration
issues with your existing REST clients, and rolled back. Neither decision is documented
anywhere except your memory.

Today, you open a new AI session to refactor a module.

> **AI suggestion #1:** Use Redux Toolkit.  
> **AI suggestion #2:** Migrate your API layer to tRPC.

Both are reasonable — if you don't know the history. You spend 10 minutes explaining what's
already been ruled out. Next week, same session, same loop.

This isn't a model capability problem. Claude, GPT, Gemini — they're all smart enough. They
just don't know **what this specific project has already tried and why it didn't work.**

Every new session, AI is a brilliant architect who just walked in. Cairn gives it the project
memory of a colleague who's been here from the start.

![Problem vs Solution](docs/diagrams/01-problem-vs-solution.png)

---

## What is Cairn

Cairn is an **AI path-dependency constraint system** — a structured format for recording
what your project has decided, what it has rejected, and what trade-offs it has accepted.

It is **not** a documentation system. Every entry must change what AI suggests. If a piece
of information doesn't alter AI behavior, it doesn't belong in Cairn.

Cairn fills the gap between what AI tools already handle well:

| What tools handle today | What Cairn adds |
|------------------------|-----------------|
| Coding style, naming conventions | Rejected directions and why |
| Current tech stack and architecture | Stage-aware constraints (MVP vs growth) |
| What's being built now | Accepted debt that should not be touched |
| How to write code | What paths have already been walked |

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

![Three-Layer Architecture](docs/diagrams/02-three-layer-architecture.png)

| Layer | File | When AI Reads | Token Budget |
|-------|------|---------------|--------------|
| Global Constraints | `.cairn/output.md` | Every session, always | 500 target / 800 max |
| Domain Context | `.cairn/domains/*.md` | During planning & design | 200–400 per file |
| Decision History | `.cairn/history/*.md` | On-demand precise queries | Unlimited |

**Runtime flow:**
1. AI reads `output.md` at session start — establishes what's off-limits and the current project stage
2. When planning a feature, AI reads the relevant domain file — understands that area's evolution and pitfalls
3. When full historical detail is needed, AI queries `history/` — the raw decision events with rejected alternatives

### Three Constraint Types

Three concepts produce distinct AI behavior changes:

| Concept | What It Means | AI Behavior |
|---------|---------------|-------------|
| **no-go** | A direction evaluated and excluded | Never suggest it |
| **accepted debt** | A known defect intentionally left in place | Never attempt to fix it |
| **known pitfalls** | An operational trap in a specific domain | Actively avoid trigger conditions |

---

## Implementation

Cairn is a **pure file format** — no runtime, no background process, no external service required.
The `.cairn/` directory is plain Markdown with a defined structure, versioned alongside your code.

**Layer 1 (`output.md`):** Six required YAML-headlined sections (`stage`, `no-go`, `hooks`,
`stack`, `debt`, `open questions`). Hard-limited to 800 tokens. AI reads this before every response.

**Layer 2 (domain files):** YAML frontmatter with `hooks` keyword lists for intent detection,
followed by Markdown sections for no-go rules, known pitfalls, and evolution history. Written
to be **replaced wholesale**, not appended — the raw events stay in `history/`.

**Layer 3 (history files):** Bare `key: value` format (no YAML fences). Each file is one
decision event with fields: `type`, `domain`, `summary`, `rejected`, `chosen`, `reason`,
`revisit_when`. The `rejected` field is the most critical — it's what AI is most likely to
re-propose.

**Behavior layer (adapters):** Each AI tool gets a skill file that instructs it when and how
to read the `.cairn/` layers. The data layer is tool-agnostic; the behavior layer is maintained
per-tool to preserve semantic equivalence.

**Language support (v0.0.2):** `.cairn/` content can be maintained in any language.
The CLI and init script follow `CAIRN_LANG` (auto-detected from `$LANG`). AI skill
adapters include language-continuity rules so new entries match existing file language.
Format contracts (section headers, field names) remain English ASCII regardless of
content language.

---

## Quality Guarantees

**Specification-driven:** `spec/FORMAT.md` is the authoritative reference for all three layers.
Every tool, script, and example must conform to it. When in doubt, the spec wins.

**Test coverage:**
- Shell test suite: **902 assertions** across 10 test files (CLI, init script, format validation)
- MCP Server test suite: **125 assertions** across 15 Vitest test files (parsers, all 6 tools)

**Human-in-the-loop principle:** The MCP `cairn_propose` tool writes to `.cairn/staged/` —
never directly to `history/`. AI proposes; humans approve by moving the file.

---

## Quick Start

### Install

**Option A: Interactive init script (recommended)**

```bash
curl -sL https://raw.githubusercontent.com/zzf2333/Cairn/main/scripts/cairn-init.sh -o cairn-init.sh
chmod +x cairn-init.sh
./cairn-init.sh
```

The script guides you through 5 steps (~30 minutes):
1. Choose your project's domains (11 standard options)
2. Fill in `output.md` (stage, no-go, stack, accepted debt)
3. Initialize `history/` with an entry template
4. Initialize `domains/` (empty to start — this is normal)
5. Install the skill adapter for your AI tool(s)

**Option B: CLI**

```bash
git clone https://github.com/zzf2333/Cairn ~/.cairn
echo 'export PATH="$HOME/.cairn/cli:$PATH"' >> ~/.zshrc   # or ~/.bashrc
source ~/.zshrc
cairn init    # interactive, delegates to cairn-init.sh
```

Requires Bash 3.2+ (macOS system bash is sufficient). Symlinks are also supported — the script resolves its real path via `readlink`.

**Option C: MCP Server only**

```bash
# From npm
npm install -g cairn-mcp-server

# Or from source
git clone https://github.com/zzf2333/Cairn
cd Cairn/mcp && npm install && npm run build
```

Requires Node.js 18+.

---

### Daily Usage

```bash
# Show three-layer summary and detect stale domains
cairn status

# Record a new decision event (interactive)
cairn log

# Record a rejection (flag mode)
cairn log --type rejection --domain api-layer \
    --summary "Rejected GraphQL after evaluation" \
    --rejected "GraphQL: data complexity doesn't justify it" \
    --reason "Current team size makes GraphQL overhead unwarranted" \
    --revisit-when "Frontend needs regular cross-resource aggregation"

# Generate a prompt to refresh a stale domain file
cairn sync api-layer
cairn sync --stale          # all stale domains at once
cairn sync api-layer --copy # copy prompt to clipboard
cairn sync --hooks          # regenerate output.md ## hooks from domain frontmatter

# After a feature or refactor — reflect on recent commits and stage update candidates
cairn reflect --since HEAD~10
cairn stage review           # review, accept, edit, or skip each candidate

# Track migration cleanup obligations
cairn audit start state-management --trigger "migrated from Redux to Zustand"
cairn audit scan              # scan source for rejected-path keyword residue
```

**Stale detection:** `cairn status` compares each domain file's `updated:` frontmatter
against the `recorded_date` of its history entries. A domain is stale when new history
entries have been added since the domain's last update:

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

### Update

**Init script / CLI:**
```bash
cd ~/.cairn && git pull
# PATH stays valid — no re-install needed
```

**MCP Server (npm):**
```bash
npm install -g cairn-mcp-server@latest
```

**MCP Server (from source):**
```bash
cd /path/to/Cairn && git pull
cd mcp && npm install && npm run build
# Running server picks up the new build automatically on next restart
```

**Skill adapters:** Run `cairn install-skill` to reinstall or migrate skill files
without touching the `.cairn/` data layer. See the [upgrade guide](spec/adoption-guide.md#upgrading-from-v009-or-earlier) for details.

---

### Uninstall

**CLI:**
```bash
# Remove the PATH export line from ~/.zshrc (or ~/.bashrc), then:
rm -rf ~/.cairn
```

**MCP Server:**
```bash
npm uninstall -g cairn-mcp-server
# Remove the "cairn" block from your MCP settings file
# (Claude Code: ~/.claude/settings.json or .claude/settings.json)
```

**Skill adapters:**  
Delete the adapter file you copied during setup (see table in Supported AI Tools below).

**Project data (`.cairn/`):**  
The `.cairn/` directory belongs to your project repository. Removing Cairn tooling
does not delete it — remove it manually if desired, or leave it as documentation.

---

## MCP Server

The MCP Server (Phase 3) upgrades Cairn from file-injection to typed tool calls.
Instead of relying on AI tools to infer when to load context, it exposes six precise
tools that match AI intent against domain frontmatter `hooks` fields.

![Integration Overview](docs/diagrams/03-integration-overview.png)

### Tools

| Tool | Description |
|------|-------------|
| `cairn_output` | Read `.cairn/output.md` — Layer 1 global constraints |
| `cairn_domain` | Read `.cairn/domains/<name>.md` — Layer 2 domain context |
| `cairn_query` | Search `.cairn/history/` — Layer 3 events, with domain/type filters |
| `cairn_match` | Match keywords (and optional `files` paths) against domain `hooks` — returns confidence levels (`high`/`medium`/`low`) and related domain advisory |
| `cairn_propose` | Draft a history entry to `.cairn/staged/` for human review |
| `cairn_sync_domain` | Generate context to regenerate a stale domain file |

### Configuration

**Claude Code** — add to `~/.claude/mcp.json` (global) or `.claude/mcp.json` (project):
```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

**Cursor** — add to `.cursor/mcp.json` in your project:
```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

The server resolves `.cairn/` by walking up from `process.cwd()`, or via the
`CAIRN_ROOT` environment variable if you need to pin to a specific project.

See [`mcp/README.md`](mcp/README.md) for full configuration options and the recommended AI workflow.

---

## Supported AI Tools

| Tool | Adapter File | Install Location |
|------|-------------|-----------------|
| Claude Code | `skills/claude-code/SKILL.md` | `.claude/CLAUDE.md` (append) |
| Cursor | `skills/cursor.mdc` | `.cursor/rules/cairn.mdc` |
| Cline / Roo Code | `skills/cline.md` | `.clinerules` (append) |
| Windsurf | `skills/windsurf.md` | `.windsurfrules` (append) |
| GitHub Copilot | `skills/copilot-instructions.md` | `.github/copilot-instructions.md` (append) |
| Codex CLI | `skills/codex.md` | `AGENTS.md` (append) |
| Gemini CLI | `skills/gemini-cli.md` | `GEMINI.md` (append) |
| OpenCode | `skills/opencode.md` | `AGENTS.md` (append, shared with Codex) |

`cairn-init.sh` handles installation for all eight tools automatically.

The data layer (`.cairn/`) is fully tool-agnostic — it travels with your repository.
The behavior layer (skill adapter files) is maintained per-tool to preserve semantic equivalence.

---

## Example

[`examples/saas-18mo/`](examples/saas-18mo/) is a complete three-layer example from an
18-month SaaS project — the same project from the story at the top of this document:

- `output.md` — stage `early-growth`, no-go rules (tRPC, Redux, Kubernetes), active stack, accepted debts
- Three domain files: `api-layer`, `auth`, `state-management`
- Four history events: state management migration, tRPC rejection, auth debt acceptance, growth stage transition

---

## Documentation

| Document | Contents |
|----------|----------|
| [`spec/FORMAT.md`](spec/FORMAT.md) | Complete format reference for all three layers (authoritative) |
| [`spec/DESIGN.md`](spec/DESIGN.md) | Why Cairn is designed the way it is |
| [`spec/vs-adr.md`](spec/vs-adr.md) | How Cairn relates to Architecture Decision Records |
| [`spec/adoption-guide.md`](spec/adoption-guide.md) | Step-by-step Init and Reactive adoption guide |
| [`mcp/README.md`](mcp/README.md) | MCP Server configuration and tool reference |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history |

---

## License

MIT
