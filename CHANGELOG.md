# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-12

Complete architecture rewrite — from static context files to a dynamic memory engine.

### Breaking Changes

- **Architecture**: Cairn is now a dynamic memory engine. Automatic signal capture, trust-routed memory, and auto-generated views replace manual file maintenance.
- **MCP tools**: 6 tools replace the previous API — `cairn_context`, `cairn_signal`, `cairn_session_end`, `cairn_status` (stable); `cairn_plan`, `cairn_doctor` (experimental).
- **Directory structure**: New `.cairn/` layout — `memory/` (YAML source of truth), `views/` (auto-generated), `signals/`, `staged/`, `sessions/`, `config.yaml`, `state.yaml`.
- **CLI**: TypeScript CLI with commands: `cairn init`, `cairn status`, `cairn review`, `cairn doctor`, `cairn stage confirm`, `cairn memory show/archive`.

### Added

- **Dual-ear signal capture**: Git Ear detects reverts, dependency changes, large refactors, commit patterns, new contributors. Conversation Ear captures user rejections, decisions, constraints, debt acceptance via `cairn_signal()`.
- **Trust Router (L0–L3)**: Four-level routing with hard rules. L0 drop (noise), L1 candidate (accumulates ≥3 to promote), L2 staged (human review), L3 auto-write (strict conditions). Global no-go and stage changes always route to L2.
- **Structured YAML memory**: Entries carry `type`, `domain`, `scope`, `status`, `confidence`, `subject`, `source`, `behavior_effect`, `revisit`, `relations`. Five types: decision, rejection, transition, debt, experiment. Four behavior effects: avoid_suggestion, prefer_approach, warn_before, require_review.
- **Views Engine**: Auto-generates `views/output.md`, `views/domains/*.md`, `views/stage.md` from memory with token budget control (300/500 tokens per domain). Regenerated on every memory change.
- **Stage Advisory Engine**: Infers project phase (exploration → growth → maturity → maintenance) from project age, commit trends, dependency churn, new file ratio. Advisory only — no hard constraints unless human-confirmed via `cairn stage confirm`.
- **Memory Engine**: Conflict detection (same domain + subject + different behavior_effect), health tracking, supersession management.
- **6 Zod schemas**: MemoryEntry, Signal, StagedEntry, Config, StageSnapshot, SessionRecord — runtime validation for all `.cairn/` data files.
- **4 YAML stores**: MemoryStore, SignalStore, StagedStore, StateStore — typed CRUD with schema validation.
- **`cairn review` CLI**: Interactive review for staged entries (accept / edit / skip / delete). Accepted entries promote to memory and trigger view regeneration.
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
