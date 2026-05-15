# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] - 2026-05-15

### Fixed

- **Cross-project availability**: MCP server now registers with `user` scope (`-s user`) instead of `local`, making cairn available in all projects after a single install
- **Project root resolution**: Lazy root resolver with 2s timeout — `listRoots()` no longer blocks startup indefinitely when client doesn't respond
- **Home directory guard**: `bootstrapCairnDir()` refuses to create `.cairn/` in home directory, preventing misconfigured global installs from polluting `~/`

## [0.2.3] - 2026-05-15

### Fixed

- **Project root resolution**: MCP server now resolves project root via MCP `listRoots()` instead of `process.cwd()`, fixing `.cairn/` being created in the home directory instead of the project root when globally installed

## [0.2.2] - 2026-05-14

### Added

- **Zero-config installation**: `npm install -g` auto-registers MCP server with detected AI tools (Claude Code, Cursor, Windsurf, Claude Desktop) via postinstall
- **Auto-initialization**: First MCP tool call bootstraps `.cairn/` directory with project metadata and Git history scan — no manual `cairn init` needed
- **`cairn_review` MCP tool**: AI-mediated review of staged entries (list/accept/reject), replacing interactive CLI
- **`cairn_memory` MCP tool**: Browse and manage memory entries (list/show/archive), replacing CLI commands
- **`cairn_status` stage operations**: Extended with `stage_show` and `stage_confirm` actions

### Changed

- **CLI simplified**: Only `cairn version` remains; all project operations are MCP tools called by AI
- **MCP tools**: 6 → 8 stable tools + 2 experimental
- **Documentation**: All spec documents, adoption guide, glossary, and 3 architecture diagrams updated

### Removed

- CLI commands: `init`, `status`, `review`, `doctor`, `stage`, `memory` (replaced by MCP tools)

## [0.2.1] - 2026-05-12

### Fixed

- `cli.ts` VERSION was still `2.0.0-alpha.0` after v0.2.0 release; now correctly synced
- `sync-version.sh` now covers `cli.ts` as a sync target
- `release.yml` version consistency check now includes `cli.ts`

### Added

- E2E smoke tests: 10 tests covering CLI binary, MCP transport, and full signal→memory→context pipeline

## [0.2.0] - 2026-05-12

Complete architecture rewrite — from static context files to a dynamic memory engine.

### Breaking Changes

- **Architecture**: Cairn is now a dynamic memory engine. Automatic signal capture, trust-routed memory, and auto-generated views replace manual file maintenance.
- **MCP tools**: 8 tools replace the previous API — `cairn_context`, `cairn_signal`, `cairn_session_end`, `cairn_status`, `cairn_review`, `cairn_memory` (stable); `cairn_plan`, `cairn_doctor` (experimental).
- **Directory structure**: New `.cairn/` layout — `memory/` (YAML source of truth), `views/` (auto-generated), `signals/`, `staged/`, `sessions/`, `config.yaml`, `state.yaml`.
- **CLI**: `cairn version` (all project operations are MCP tools called by AI).

### Added

- **Dual-ear signal capture**: Git Ear detects reverts, dependency changes, large refactors, commit patterns, new contributors. Conversation Ear captures user rejections, decisions, constraints, debt acceptance via `cairn_signal()`.
- **Trust Router (L0–L3)**: Four-level routing with hard rules. L0 drop (noise), L1 candidate (accumulates ≥3 to promote), L2 staged (human review), L3 auto-write (strict conditions). Global no-go and stage changes always route to L2.
- **Structured YAML memory**: Entries carry `type`, `domain`, `scope`, `status`, `confidence`, `subject`, `source`, `behavior_effect`, `revisit`, `relations`. Five types: decision, rejection, transition, debt, experiment. Four behavior effects: avoid_suggestion, prefer_approach, warn_before, require_review.
- **Views Engine**: Auto-generates `views/output.md`, `views/domains/*.md`, `views/stage.md` from memory with token budget control (300/500 tokens per domain). Regenerated on every memory change.
- **Stage Advisory Engine**: Infers project phase (exploration → growth → maturity → maintenance) from project age, commit trends, dependency churn, new file ratio. Advisory only — no hard constraints unless human-confirmed via `cairn_status(action: 'stage_confirm')`.
- **Memory Engine**: Conflict detection (same domain + subject + different behavior_effect), health tracking, supersession management.
- **6 Zod schemas**: MemoryEntry, Signal, StagedEntry, Config, StageSnapshot, SessionRecord — runtime validation for all `.cairn/` data files.
- **4 YAML stores**: MemoryStore, SignalStore, StagedStore, StateStore — typed CRUD with schema validation.
- **`cairn_review` MCP tool**: AI-mediated review of staged entries (list / accept / reject). Accepted entries promote to memory and trigger view regeneration.
- **`cairn_memory` MCP tool**: Browse and manage memory entries (list / show / archive).
- **Session records**: `cairn_session_end()` creates audit records in `sessions/` with signal counts, routing stats, and domain coverage.
- **GitEar integration**: Automatic Git history scan on MCP server startup, detecting signals since last session.
- **9 AI tools supported via MCP**: Claude Code, Cursor, Claude Desktop, Cline/Roo Code, Windsurf, GitHub Copilot, Codex CLI, Gemini CLI, OpenCode.
- **8 Skill adapter files**: Alternative path for all supported tools when MCP is not configured.
- **193 tests**: schemas (10), stores (12), engines (45), tools (10), CLI (21), integration (6), utilities (18), views (8), startup scan (13), GitEar (50).
- **6 architecture diagrams**: Problem vs Solution, Signal Pipeline, Integration Overview, How It Works, Daily Usage, Trust Router Decision Flow.
- **Spec documents**: FORMAT.md (schema reference), DESIGN.md (design rationale), adoption-guide.md, glossary.md — all synced with implementation.

## [0.1.2] - 2026-05-10

### Added

- Structured history memory semantics
- Core memory loop strengthening
- Verifiable onboarding for v0.1.0

## [0.1.1] - 2026-05-09

### Added

- Initial MCP server with static context management
- Basic skill adapter files for AI tools

## [0.1.0] - 2026-05-08

### Added

- Initial release
- Static `.cairn/` directory with `output.md` context file
- MCP server with `cairn_output` and `cairn_query` tools
- CLI with `cairn init`
