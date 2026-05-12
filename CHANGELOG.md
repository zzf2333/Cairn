# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-alpha.0] - 2026-05-11

### Breaking Changes

- **Architecture**: Cairn is a dynamic memory engine. Automatic signal capture, trust-routed memory, and auto-generated views replace manual file maintenance.
- **MCP tools**: 6 tools: `cairn_context` (stable), `cairn_signal` (stable), `cairn_session_end` (stable), `cairn_status` (stable), `cairn_plan` (experimental), `cairn_doctor` (experimental).
- **Directory structure**: `memory/` (YAML source of truth), `views/` (auto-generated Markdown projections), `signals/`, `staged/`, `sessions/`. Config files: `config.yaml`, `state.yaml`.
- **TypeScript CLI**: Commands: `cairn init`, `cairn status`, `cairn review`, `cairn doctor`, `cairn stage confirm`, `cairn memory show/archive`.

### Added

- **Dual-ear signal capture**: Git Ear detects reverts, dependency changes, large refactors, commit patterns, new contributors. Conversation Ear captures user rejections, decisions, constraints, debt acceptance via `cairn_signal()`.
- **Trust Router (L0–L3)**: Four-level routing with hard rules. L0 drop (noise), L1 candidate (accumulates), L2 staged (human review), L3 auto-write (strict conditions). Global no-go and stage changes always route to L2.
- **Structured YAML memory**: Memory entries carry `type`, `domain`, `scope`, `status`, `confidence`, `source`, `behavior_effect`, `revisit`, `relations`. Five memory types: decision, rejection, transition, debt, experiment. Four behavior effects: avoid_suggestion, prefer_approach, warn_before, require_review.
- **Views Engine**: Auto-generates `views/output.md`, `views/domains/*.md`, and `views/stage.md` from memory with token budget control. Regenerated on every memory change.
- **Stage Advisory Engine**: Infers project phase (exploration → growth → maturity → maintenance) from project age, commit trends, dependency change rate, new file ratio. Advisory only — no hard constraints unless human-confirmed.
- **Memory Engine**: Conflict detection (same domain + subject + different behavior_effect direction), health tracking, supersession management.
- **6 Zod schemas**: MemoryEntry, Signal, StagedEntry, Config, StageSnapshot, SessionRecord — runtime validation for all `.cairn/` data files.
- **4 YAML stores**: MemoryStore, SignalStore, StagedStore, StateStore — typed CRUD with schema validation.
- **`cairn review` CLI**: Interactive review for staged entries (accept / edit / skip / delete). Accepted entries promote to memory and trigger view regeneration.
- **Session records**: `cairn_session_end()` creates audit records in `sessions/` with signal counts, routing stats, and domain coverage.
- **62 tests**: schemas (10), stores (12), engines (19), tools (10), integration (6), startup scan (5).
