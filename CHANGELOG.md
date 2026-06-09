# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Global instruction architecture** — injected Claude/Codex blocks now present themselves as a Cairn Skill bootstrap guard instead of a complete protocol replacement. The block explicitly states that the Skill owns lifecycle semantics and the CLI is only the runtime actuator.

## [0.4.11] - 2026-06-09 (Runtime signal quality and auditability)

This release turns the runtime from a passive logger into a more reviewable cognitive system. It was validated against a long-running real project `.cairn/` directory from Meitheal, where historical noisy staged entries, weak domain attribution, missing evidence, and stalled stage/DNA signals were visible.

### Added

- **Evidence-based git signal mapping** — generated git events now include mapper version, routing reason, confidence, domain confidence, domain evidence, and compact signal snapshots.
- **Review queue clustering** — `cairn review --clusters [--json]` groups legacy noisy staged entries by safe review action.
- **Safe legacy backlog dismissal** — `cairn review dismiss --cluster noisy-large-refactor --dry-run|--yes [--json]` previews or removes known legacy large-refactor noise while writing governance audit records.
- **Runtime audit command** — `cairn doctor --runtime-audit [--json]` reports telemetry consistency, lifecycle coverage, generated-event evidence gaps, processed archive coverage, and duplicate compliance entries.
- **Processed signal archive** — `session-end` writes processed git/calibration/safety-valve observations under `.cairn/signals/processed/YYYY-MM/`, including dropped and merged observations.
- **Fast-cycle DNA candidates** — compression can propose project-specific staged DNA from repeated runtime corrections and session summaries before full long-horizon DNA emerges.
- **Evidence-based stage inference** — stage confidence now considers recent session summaries, test/acceptance evidence, docs presence, and bugfix/review cadence in addition to git metrics.
- **Operational Runtime Health views** — generated views now surface pending review, missing evidence, processed archive counts, missing archive counts, Emerging DNA, and Runtime Health sections.
- **Meitheal replay acceptance tests** — real-world replay coverage guards against returning to 50-item noisy architecture review backlogs.

### Changed

- **Large-refactor handling** — file count alone no longer creates a G2 architecture decision. Staging now requires semantic evidence such as architecture-like commit messages, architecture docs, API/runtime boundary changes, or strong owned-domain path evidence.
- **Domain attribution** — git signals now score domains using skeleton `owns` / `does_not_own` path evidence before keyword fallback, with `global` / `multi` outcomes for ambiguous commits.
- **Telemetry vocabulary** — session telemetry now uses source-specific counters such as `explicit_signals`, `git_signals_detected`, `git_signals_routed`, `events_staged`, and `events_dropped`.
- **Pending review counts** — staged counts now mean pending staged entries, not every YAML file ever written.

### Fixed

- **False pending counts after batch dismissal** — known-noise batch dismissal now removes staged files and preserves the rejection trail in governance audit.
- **Runtime-audit false positives** — human conversation-sourced staged entries are no longer reported as missing generated mapper evidence.
- **Docs/config large commits** — docs/config/generated-only churn no longer gets misclassified as feature-domain architecture decisions.
- **Review output** — pending staged entries now expose routing reason, confidence, domain evidence, and suggested action in JSON.
- **Package lock version drift** — `cli/package-lock.json` is refreshed for the release version.

### Verification

- `npm run build` — compilation clean.
- `npm test` — 457/457 tests passing.
- `npm audit --json` — 0 vulnerabilities.
- `npm pack --dry-run` — package contents verified.
- Meitheal read-only replay — legacy 50-item staged backlog clusters into actionable review groups; stage inference produces evidence-backed growth confidence instead of 0-confidence exploration.

## [0.4.10] - 2026-05-23 (Global instructions auto-injection)

`cairn init` and `npm install cairn-rt` now automatically inject the Cairn lifecycle protocol into the global instruction files of supported AI coding tools. This ensures the cognitive runtime protocol is enforced without relying on the AI to remember to load the skill.

### Added

- **Global instructions injection** — on install or `cairn init`, the Cairn lifecycle protocol is written to `~/.claude/CLAUDE.md` (Claude Code) and `~/.codex/AGENTS.md` (Codex CLI). Uses `<!-- cairn:start/end -->` markers for idempotent updates.
- **`cairn uninstall`** — removes Cairn protocol blocks from all supported AI tool global configs.
- **Legacy marker cleanup** — automatically strips old `<!-- cairn:global-protocol:start/end -->` blocks during injection.

### Changed

- **`cairn init` output** — now reports which AI tools received protocol injection and which were skipped (tool not installed).
- **`postinstall`** — triggers global instructions injection on `npm install cairn-rt`, with silent failure to avoid blocking installation.

### Context

Investigation showed that the Cairn skill lifecycle was not being followed in real projects because Claude Code's skill system only loads the skill description (not the full protocol) at session start, and AI auto-invocation is probabilistic. Injecting the protocol into global instruction files (which are always loaded into context) solves this by making the lifecycle rules visible to the AI in every session.

## [0.4.9] - 2026-05-22 (MCP removal, pure CLI + Skill architecture)

0.4.8 renamed the directory and switched CI to OIDC. 0.4.9 completes the architectural pivot: **MCP is fully removed** — the runtime is now exclusively CLI commands + Agent Skill protocol. The `@modelcontextprotocol/sdk` dependency is gone, the MCP server is deleted, and all test infrastructure is realigned to the CLI execution model.

### Removed

- **MCP server** — `cli/src/server.ts` and all 16 MCP tool registrations deleted. The `cairn-mcp-server` binary alias is removed.
- **MCP SDK dependency** — `@modelcontextprotocol/sdk` removed from `package.json`. No MCP code remains in the project.
- **MCP tool contracts** — `skills/protocol/tool-contracts.md` and `skills/protocol/mcp-instructions.md` deleted. Tool semantics are now defined by the CLI `--help` and SKILL.md.
- **Skill assembly pipeline** — `skill-assembler.ts`, `skill-paths.ts`, `skill-dist/`, `skills/_assembly-order.json`, `skills/modes/` (strict/balanced/lightweight), `cli/scripts/copy-skills.js` all deleted. Skills are now consumed directly from the `skills/cairn/` directory.
- **Platform adapters** — `skills/adapters/claude-code.md`, `skills/adapters/codex.md`, `skills/adapters/cursor.md`, `skills/codex.md` deleted. The unified SKILL.md serves all platforms.
- **`cairn skill show`** CLI subcommand removed (no assembly to preview).
- **MCP bridge in test runner** — `mcp-bridge.ts` deleted, replaced by `cli-bridge.ts`.

### Changed

- **Skills directory** — restructured from flat `skills/{protocol,adapters,modes,compliance,examples}/` to standard Agent Skills layout `skills/cairn/SKILL.md` with nested protocol/compliance/examples. Root `package.json` `main` field updated to `skills/cairn/SKILL.md`.
- **Test scenario runners** — all 4 platform drivers (claude-code SDK, codex SDK, claude-code CLI, codex CLI) rewritten from MCP tool simulation to CLI Bash tool execution. New `parse-cairn-command.ts` shared utility extracts cairn invocations from bash commands.
- **Test CLI bridge** — new `cli-bridge.ts` replaces `mcp-bridge.ts`. Executes `node dist/cli/index.js` with `CAIRN_ROOT` env var, maps tool names to CLI subcommands and flags.
- **9 scenario expected.yaml files** — assertion keys updated from MCP arg format (`signal_type`, `details.what`) to CLI flag format (`type`, `what`).
- **Smoke tests** — `smoke.ts`, `smoke-all.ts`, `smoke-lifecycle.ts` all switched from MCP bridge to CLI bridge.
- **postinstall** — simplified to CLI-only messaging, removed MCP configuration guidance.
- **Documentation** — remaining MCP references cleaned from docs, scenario README, and stability docs.

### Fixed

- **Root `package.json` `main`** — pointed to nonexistent `SKILL.md` instead of `skills/cairn/SKILL.md`, breaking `npx skills add zzf2333/Cairn`.
- **`cli/package.json` dev script** — pointed to nonexistent `src/index.ts` instead of `src/cli/index.ts`, breaking `npm run dev`.
- **Root `package.json`** — added `"private": true` to prevent accidental `npm publish` of the monorepo root.
- **Skill paths in test runners** — 4 runner files referenced deleted skill paths (`skills/claude-code/SKILL.md`, `skills/codex.md`), now corrected to `skills/cairn/SKILL.md`.

### Verification

- `npm run build` — compilation clean
- `npm test` — 440/440 unit tests passing
- `npm run smoke` — 39/39 scenario probes passing
- `npm run smoke:lifecycle` — 8/8 state machine checks passing

## [0.4.8] - 2026-05-21 (directory rename + OIDC publish)

### Changed

- **Directory rename** — `mcp/` → `cli/`, aligning with Skill-first + CLI-backed product direction. All CI workflows, scripts, and documentation updated.
- **npm README** — rewritten from MCP-first "Cairn MCP Server" to "Cairn" cognitive runtime. MCP tools folded into optional reference section.
- **CI publish** — `release.yml` → `publish.yml`, switched from `NPM_TOKEN` secret to npm Trusted Publisher (OIDC provenance).

## [0.4.7] - 2026-05-21 (Skill-first + CLI-backed, package rename)

0.4.6 aligned docs to position Protocol as the primary lifecycle driver. 0.4.7 completes the migration: the default product path is now **Skill Runtime Protocol + CLI commands**, MCP is demoted to optional/advanced, and the npm package is renamed from `cairn-mcp-server` to `cairn-rt`.

### Changed

- **Package rename** — npm package renamed from `cairn-mcp-server` to `cairn-rt`. The `cairn` CLI binary is unchanged. `cairn-mcp-server` binary kept as legacy alias for transition.
- **Runtime architecture** — extracted shared business logic into `mcp/src/actions/` layer. Both MCP tools and CLI runtime commands delegate to the same action functions, eliminating code duplication.
- **CLI runtime commands** — added 6 new CLI subcommands (`cairn context`, `cairn plan`, `cairn signal`, `cairn observe`, `cairn session-end`, `cairn session-recover`) backed by the actions layer. All support `--json` output for programmatic use by AI skills.
- **Skill installation** — migrated from `cairn skill install` (injecting into CLAUDE.md) to native Claude Code skill mechanism (`npx skills add zzf2333/Cairn`). Root `SKILL.md` is a compact entry point with progressive disclosure.
- **README narrative** — "What Cairn gives the AI" rewritten from "Protocol + 16 MCP tools" to "Skill Runtime Protocol + CLI Runtime". MCP moved to folded optional sections in both EN and ZH READMEs.
- **CLI** — removed `cairn skill install`, `cairn skill status`, `cairn skill update` subcommands. Retained `cairn skill show [platform]` for previewing assembled protocol.
- **postinstall** — now shows skill installation as recommended path, MCP config as optional.

### Added

- `mcp/src/actions/` — 6 action files (`context-action.ts`, `plan-action.ts`, `signal-action.ts`, `observe-action.ts`, `session-end-action.ts`, `session-recover-action.ts`) with typed interfaces and zero MCP dependencies.
- `mcp/src/cli/runtime-*.ts` — 6 CLI runtime command handlers.
- `skill-dist/` — pre-built skill bundle with wrapper scripts for Claude Code skill system.
- `mcp/tests/e2e/cli-smoke.test.ts` — CLI smoke tests.
- Root `package.json` with `"main": "SKILL.md"` for Claude Code skill discovery.

### Removed

- `skills/claude-code/SKILL.md` — replaced by root-level `SKILL.md`.
- CLAUDE.md injection logic (`hasProtocolBlock`, `replaceProtocolBlock`, `appendProtocolBlock`, `parseInstalledVersion`, `getTargetFileName`) from `skill-assembler.ts`.
- `<!-- cairn:start/end -->` marker system — no longer needed.

## [0.4.6] - 2026-05-21 (documentation alignment)

0.4.5 restructured the skill system into a Cognitive Runtime Protocol. 0.4.6 aligns project documentation to position the Protocol as the primary lifecycle driver rather than fallback to raw MCP instructions.

### Changed

- **CLAUDE.md** — repositioned `skills/` as the Cognitive Runtime Protocol: the primary mechanism that drives the project lifecycle. MCP tools are now described as mechanisms the protocol calls. Clarified that `mcp-instructions.md` is a compressed fallback, not the canonical source.

## [0.4.5] - 2026-05-21 (Cognitive Runtime Protocol + compliance telemetry)

0.4.4 completed the cognitive breakthrough test suite (T8–T10). 0.4.5 restructures the skill system into a **Cognitive Runtime Protocol** — a layered, adapter-agnostic architecture that any AI platform can consume — and adds **compliance telemetry** so lifecycle adherence is observable across sessions.

### Added

**Cognitive Runtime Protocol** (`skills/`)

The monolithic `SKILL.md` is replaced by a structured protocol tree:

- **`skills/protocol/`** (9 files) — adapter-agnostic "constitution": `core.md` (6-step behavioral protocol), `lifecycle.md` (detailed semantics), `runtime-rules.md` (DNA/trauma/debt processing), `tool-contracts.md` (16 tool specifications), `escalation-model.md` (suggestion/reflective_challenge/hard_constraint), `minimal-intervention.md` (when NOT to invoke Cairn), `reasoning-examples.md` (behavioral examples), `cognition-philosophy.md` (mental model), `mcp-instructions.md` (loaded by MCP server at startup).
- **`skills/adapters/`** (3 files) — platform-specific rules for Claude Code, Codex, and Cursor.
- **`skills/modes/`** (3 files) — cognitive mode adjustments: `strict.md`, `balanced.md`, `lightweight.md`.
- **`skills/compliance/`** (2 files) — `metrics.md` (6 observable compliance rates), `anti-patterns.md` (10 dangerous behaviors).
- **`skills/examples/`** (5 files) — lifecycle walkthroughs: architecture, refactor, debugging, incident, migration.
- **`skills/_assembly-order.json`** — protocol assembly manifest for `cairn skill install`.

**Compliance Tracking**

- **Compliance JSONL logger** — `cairn_session_end` appends to `.cairn/runtime/compliance.jsonl` with per-session metrics (context, plan, observe, signals, degraded, domains, duration). Enables `grep`/`jq` analysis across sessions.
- **`cairn_status` compliance rates** — new `compliance` object with `context_rate`, `plan_rate`, `observe_rate`, `signal_avg`, `degraded_rate` computed from last 10 sessions.
- **`cairn_observe` stats tracking** — tracks `observed_candidates_count` vs `captured_candidates_count` separately; increments `signals_count` by actual captured count.
- **`cairn_session_recover` compliance flag** — sets `recovered: true` on recovered session; returns compliance aggregation.
- **`session_end` highlights array** — top-of-response `highlights: string[]` surfacing reevaluation triggers, stage transitions, archived events, DNA candidates, and pending reviews. Fixes friction finding F1.

**L3 Skill Compliance Scenarios** (T11–T14)

- **T11: Architecture Context + Plan** — architecture task triggers context + plan, respects constraints.
- **T12: Blocked → Recover → Context** — stale session recovery flow.
- **T13: Explicit Rejection Signal** — user rejection captured via `cairn_signal`.
- **T14: Typo Minimal Intervention** — trivial task with minimal lifecycle calls.
- Test hierarchy updated with L3 level: 39 scenarios across 9 categories, 78 runs per full pass (×2 platforms).

**Compliance integration tests** — 3 new tests: tracking flow (context → plan → observe → session_end), JSONL appending, and status aggregation.

### Changed

- **MCP instructions** — loaded from `skills/protocol/mcp-instructions.md` at startup via `skill-paths.ts`; falls back to minimal hardcoded version if missing.
- **`ActiveSession` schema** — 4 new fields: `plan_called`, `observe_called`, `observed_candidates_count`, `captured_candidates_count`, `recovered`.
- **`SessionRecord` compliance object** — expanded with `observed_candidates_count`, `captured_candidates_count`, `recovered`.

### Verification

- `npm run build` clean.
- `npm test` 454/454 passing (21 test files).

## [0.4.4] - 2026-05-19 (evolution breakthrough tests + trauma recovery)

0.4.3 completed the cognitive maintenance test suite (T1–T7). 0.4.4 adds the missing counterpart: **cognitive breakthrough** — tests that verify Cairn can evolve past its own historical constraints rather than becoming a conservatism engine. Also introduces `BloodEngine.downgradeTrauma()`, the first mechanism for trauma recovery.

### Added

- **T8: Successful Paradigm Shift** — 11-step timeline verifying the full breakthrough flow: historical rejections → DNA drift detection → reevaluation_mode → old events decay → challenges weaken to advisory → new direction routes without DNA modulation.
- **T9: False Trauma Recovery** — 9-step timeline verifying trauma can be correctly downgraded when root cause is re-attributed. Tests the complete arc: trauma persists permanently → root cause discovered → `downgradeTrauma()` → routing normalizes → event becomes eligible for normal decay.
- **T10: Anti-Dogma Test** — 12-step timeline composing all breakthrough mechanisms: ConsistencyEngine detects DNA-event contradiction, CalibrationEar requires 3 drift rounds to overcome 0.9-confidence strong bias, old rejections decay and weaken, final "bookend" assertion proves the exact routing input blocked at step 1 is allowed at step 12.
- **`BloodEngine.downgradeTrauma(eventId, reason)`** — inverse of `markTrauma()`. Resets `is_trauma`, `decay_override`, `sensitivity_multiplier`, and restores normal `decay_policy`. Keeps the event as historical record.

### Changed

- **Session guard lifecycle tests** — full coverage for context → signal → observe → session_end chain, stale recovery, and degraded mode.
- **L2 cognitive behavior scenarios** — 10 new acceptance scenarios (E1–E2, F1–F2, G1–G3, H1–H3) with 3 new assertion types (`required_tool_result_patterns`, `required_final_decision`, `required_sequence`).
- **Assertion ID system** — stable `id` field on all assertion types for reliable `platform_overrides` targeting.

### Fixed

- DNA challenges now correctly downgrade to advisory during `reevaluation_mode`.
- `prefer` assertions use OR semantics (any pattern match satisfies).
- Removed non-schema `gravity.psychological` from fixtures.
- Narrowed G3 avoid pattern to prevent false positives on common words.
- Wired `assertion_overrides` into scenario runner evaluation.

## [0.4.3] - 2026-05-18 (README operational layer + diagram polish)

Docs-only release. No engine, store, or tool behavior changed; 274 unit tests pass unchanged.

0.4.2 rebuilt the deep documentation as a six-volume argument. 0.4.3 rebuilds the **surface** — the two READMEs and the two README-embedded diagrams — so a first-time visitor can see what Cairn gives the AI in one scan, without having to enter the volumes first. The volumes remain the canonical argument; the README is now the operational layer that points into them.

### Changed

**`README.md` / `README.zh.md`** — restructured from "philosophy entry + six-volume index" to a layered shape (operational surface → philosophical depth) while preserving Cairn's restrained voice:

- **Hero** — main tagline kept (`A software project is not a pile of code...`), new operational sub-tagline added (`Cairn is the MCP layer that keeps that organism's cognition alive across AI sessions.`)
- **"What Cairn gives the AI"** *(new)* — 14-row matrix of every MCP tool with columns `When the AI calls it` and `What it does`, sourced directly from `mcp/src/tools/`. Marks `cairn_context` + `cairn_session_end` as the two mandatory-per-session tools; tags `cairn_doctor` as *(maintenance)*
- **"A session in flight"** *(new)* — daily-flow arrow chain (`cairn_init_status → cairn_context → [work] → cairn_signal → cairn_session_end`) with three concrete scenario flows (fresh task / design review / ratification)
- **"What's in `.cairn/`"** *(new)* — trust section: per-file content table, explicit "not written" list (no source / no tokens / nothing outside `.cairn/`), explicit recommendation to commit `.cairn/`
- **CLI** — reformatted from a flat code block to a 3-column table (`Command / When / What it does`)
- **"The six volumes"** — preserved as-is but enhanced with a "Read it if you..." column showing per-volume reading time, plus three explicit reading paths (Philosopher / Engineer / Operator)
- **"Why Cairn"** *(new)* — 50-word origin note positioned just before Contributing, preserving the project's restrained tone

Section order is now: Hero → MCP tool matrix → How it works → 5-min install → Daily flow → `.cairn/` trust → CLI → Six volumes → Why Cairn → Contributing → License.

### Fixed

**`docs/diagrams/04-how-it-works.{svg,png}`** + **`docs/diagrams/02-three-layer-architecture.{svg,png}`** — visual style realigned to Style 6 (Claude Official) reference spec:

- All node `stroke-width` normalized to `2.5` (previously a mix of `1.2 / 1.5 / 2 / 2.5` which left card edges blurring into the background)
- All node rects now carry `filter="url(#shadow-soft)"` (`dy=2 stdDeviation=6 #000000 / opacity 0.06`) — Style 6's signature "warm card lift" was missing; nodes were flat against the cream backdrop
- Color palette, font stack, 12px radius, `#f8f6f3` background — all already compliant, untouched
- PNGs re-rendered at `@2x` (1920px wide) via `rsvg-convert -z 2`

### Unchanged

- `docs/` six-volume tree (the canonical argument)
- All engine, store, schema, tool, and CLI behavior
- Test suite (274 unit tests still pass)
- Skill protocol files (`skills/claude-code/SKILL.md`, `skills/codex.md`)

### Migration

None. Existing `.cairn/` directories require no changes. `cairn_version` remains stamped at the engine version, not the README version.

---

## [0.4.2] - 2026-05-17 (docs philosophical redesign)

Docs-only release. No engine, store, or tool behavior changed; 268 existing unit tests pass unchanged.

The flat docs/ layout shipped in 0.4.1 was a competent product manual. This release rebuilds it as the **operational shape of the philosophy itself** — six volumes organized around the cognitive-organism metaphor that the philosophy doc describes. Reading top-to-bottom now traces the same argument the system itself follows.

### Removed

- The flat `docs/*.md` layout from 0.4.1 (`PHILOSOPHY.md`, `ARCHITECTURE.md`, `QUICK_START.md`, `SCHEMA.md`, `GLOSSARY.md`, `EXAMPLES.md`, `TROUBLESHOOTING.md`, `RECOVERY.md`, `PERFORMANCE.md`, `STABILITY.md`, `MIGRATION.md`, `RELEASE_READINESS.md`).

### Added

Six-volume `docs/` tree:

- **`0-enter.md`** — single-page conceptual entry
- **`i-origin/`** (3) — `code-abundance.md`, `cognitive-collapse.md`, `not-a-memory.md`
- **`ii-anatomy/`** (6) — `skeleton.md`, `blood.md`, `dna.md`, `capillaries.md`, `gravity.md`, `governance.md`
- **`iii-life/`** (4) — `capture-and-ratify.md`, `decay-and-resurrection.md`, `compression.md`, `trauma.md`
- **`iv-self/`** (3) — `trust-router.md`, `calibration.md`, `reevaluation.md`
- **`v-intervene/`** (3) — `enter.md`, `protocol.md`, `tend.md`
- **`vi-coordinates/`** (5) — `glossary.md`, `schema.md`, `stability.md`, `performance.md`, `migration.md`

25 documents total. Each ~800–1500 words, one-line conceptual opener, philosophy + engineering interleaved (not separated), explicit "see also" cross-links forming the documentation as a graph rather than a tree.

### Rewritten

- `README.md` and `README.zh.md` — front pages restructured around the six-volume table; hero diagram is `02-three-layer-architecture`.

### Unchanged

- All 6 architecture / flow diagrams (`docs/diagrams/01-06`) — stay in Claude Official style 6 from 0.4.1.
- `docs/internal/{philosophy,architecture}.zh.md` — local-only Chinese source-of-intent; gitignored.

### Verification

- `npm run build` clean.
- `npm test` 268/268 passing.
- `npm pack --dry-run` does not include `.claude/`, deleted docs, or removed adapters.

## [0.4.1] - 2026-05-17 (docs redesign, two-platform focus)

Docs-and-scope-only patch on top of 0.4.0. No engine, store, or tool behavior changed; 268 existing unit tests pass unchanged.

### Removed

- **`spec/`** directory (9 files: DESIGN, FORMAT, adoption-guide, glossary, vs-adr × EN/ZH). Content folded into the redesigned `docs/` tree.
- **5 platform adapters** — `skills/{cline, copilot-instructions, cursor.mdc, gemini-cli, opencode, windsurf}`. Only Claude Code + Codex are actively maintained for now; the others will return in the 1.x line once each can pass the same reverse-regression suite as the supported two.
- **`TRANSLATIONS.md`** — its only job was to index the deleted `spec/` EN/ZH pairs.

### Added (English-only, authoritative)

- **`docs/PHILOSOPHY.md`** — why Cairn exists: cognition scarcity, cognitive thermodynamics, project as cognitive organism, the three principles, ADR comparison.
- **`docs/ARCHITECTURE.md`** — how the philosophy becomes a running system: four layers, signal flow, the six-step `cairn_session_end` pipeline, cognitive modes, `.cairn/` anatomy.
- **`docs/QUICK_START.md`** — 5-minute path: install + configure Claude Code or Codex + verify + worked example + CLI fallback.
- **`docs/SCHEMA.md`** — field-level YAML reference for every file under `.cairn/`, with examples and the load-bearing field semantics (gravity, behavior_effect, trauma, lifecycle, DNA traits).
- **`docs/GLOSSARY.md`** — every term used across docs, organized by conceptual dependency, plus comparisons to ADR / RFC / linter.

### Moved

- `docs/架构文档.md` → `docs/internal/architecture.zh.md` (still gitignored — local source-of-intent)
- `docs/设计哲学.md` → `docs/internal/philosophy.zh.md` (still gitignored)

### Repainted

All 6 architecture / flow / decision diagrams repainted using the fireworks-tech-graph **style 6 (Claude Official)** palette — warm cream background, soft blue/teal/beige nodes, 12px radius:

- `01-problem-vs-solution.{svg,png}` — comparison: AI without Cairn vs with
- `02-three-layer-architecture.{svg,png}` — Host AI → MCP server → `.cairn/`
- `03-integration-overview.{svg,png}` — Claude Code + Codex talking to one MCP server
- `04-how-it-works.{svg,png}` — three signal sources → TrustRouter → three destinations → maintenance pipeline
- `05-daily-usage.{svg,png}` — sequence diagram of one user turn
- `06-trust-router-flow.{svg,png}` — TrustRouter decision tree

### Rewritten

- `README.md` — new hero (02), explicit "Supported AI tools" section, doc table points only to the new English tree, dead links to deleted adapters / spec files removed.
- `README.zh.md` — slimmer Chinese overview, points to `docs/internal/*.zh.md` for depth, states English as the authoritative version.

### Verification

- `npm run build` clean.
- `npm test` 268/268 passing.
- `npm pack --dry-run` does not include `.claude/`, `spec/`, or any removed adapter.
- `git ls-files .claude` returns empty; `.claude/` remains gitignored.

## [0.4.0] - 2026-05-17 (release readiness — stability, recovery, observability)

Published to npm as `cairn-mcp-server@0.4.0`. Tag: [v0.4.0](https://github.com/zzf2333/Cairn/releases/tag/v0.4.0). First release on the 0.4 line — 0.3.x existed in git/CHANGELOG only and never reached npm; users on `0.2.10` should upgrade directly to `0.4.0`.

### Added

- **`docs/STABILITY.md`** — Stable / Experimental / Internal boundary + post-1.0 commitment window
- **`docs/MIGRATION.md`** — 0.x → 1.0 upgrade path (0.3 → 0.4 has no breaking changes)
- **`docs/RECOVERY.md`** — diagnosis + fix for 5 corruption / interruption scenarios
- **`docs/TROUBLESHOOTING.md`** — 10 common symptoms with diagnosis steps
- **`docs/EXAMPLES.md`** — `.cairn/` samples for small / mid / maintenance-stage projects
- **`docs/PERFORMANCE.md`** — SLO + benchmark data (p99 ≤ 500ms @ 1k blood events)
- **`state.cairn_version`** — new field recording the runtime version that wrote the data
- **`state.session_in_progress`** — new field; `cairn_session_end` writes step-level checkpoints so a mid-pipeline crash is recoverable
- **`cairn migrate`** CLI — stamps current version into `.cairn/state.yaml`; placeholder for future schema migrations
- **`cairn doctor --fix`** — scans `.cairn/` for corrupted yaml + orphan skeleton refs; quarantines broken files to `.cairn/quarantine/<timestamp>/`
- **`cairn doctor --recover`** — clears an incomplete `session_in_progress` checkpoint after a session crash
- **`cairn doctor --metrics`** — prints `.cairn/` health snapshot (blood / DNA / staged / last session_end)
- **`cairn_context` `interaction_hint`** — optional output field; emits `review_staged_first` or `needs_init` when the cwd is empty (fixes Codex C3 / D3 fall-through to "no source files" / "wrong project")
- **Structured tool-call logging** — written to `.cairn/logs/tools-YYYY-MM-DD.jsonl` with daily rotation; controlled by `config.yaml.logging.{ enabled, retention_days }`; default on
- **Codex CLI driver fix** — dropped `--ephemeral` flag from `codex exec`; the flag was disabling session persistence and breaking `codex exec resume` (fixes B3)

### Improved

- **BloodStore in-memory cache** — `cairn_context` p99 at 1k blood events dropped from 1715ms to 14.8ms (**~115× speedup**); `save` / `remove` automatically invalidate
- **`StateStore.recordActivationBatch`** — `cairn_context` no longer issues N writes to `state.yaml` per activation; batched into a single write
- **All 11 stores use `atomicWriteFile` (write + rename)** — concurrent writes never leave half-written state
- **`skills/codex.md` + 6 compact adapters** — maintenance phase explicitly = `reflective_challenge` strength (fixes A7); added empty-workspace response template (fixes C3 / D3)
- **`skills/claude-code/SKILL.md`** — same maintenance strength and empty-workspace template, kept symmetric with adapters

### Reverse-Regression Scenarios

- All 4 stable Codex platform diffs (A7 / B3 / C3 / D3) now have landed workarounds. Real pass-rate uplift pending the next CLI-driver run.
- New test suites: `tests/stores/atomic-write.test.ts` (4), `tests/engines/recovery-engine.test.ts` (4), `tests/e2e/cli-smoke.test.ts` (16), `tests/performance/benchmark.test.ts` (3). 268 unit tests + 6 perf tests, all passing.

### Fixed

- **CI test setup** — `git init && git commit` inside tests now passes inline `user.email` / `user.name` so GitHub Actions runners (which have no global git identity) no longer fail with `fatal: empty ident name`.

## [0.3.0] - 2026-05-16 (end-to-end usability patch)

### Added

- **`cairn_init_commit({ dry_run: true })`** — preview TrustRouter routing without writing. Returns predicted blood_auto_confirm / blood_staged / blood_dropped, plus warnings (unknown DNA trait names, missing skeleton/stage, too many candidates). AI is expected to call dry_run first, present to user, then call again without dry_run.
- **`cairn_session_end` decay and calibration details** — output now includes `decay: { events_processed, archived[], downgraded[] }` and `calibration: { signals_detected, by_type }` so the AI can proactively report side effects to the user.

### Improved

- **All 7 compact skill adapters expanded** — codex/cline/windsurf/copilot/gemini-cli/opencode/cursor now include: signal detection table with conversation triggers, three-level challenge response table, stage phase behavior table, archived constraint downgrade rule, DNA validation danger narrative, session_end non-optional warning with summary examples, and required follow-up reporting rules. Brings Codex-class platforms from ~50% to ~85% of Claude Code parity.
- **SKILL.md §0 INITIALIZATION** — documented dry-run two-step write flow with example output.
- **SKILL.md §5 SESSION END** — added summary good/bad examples, full output schema, and "required follow-up" section listing 4 silent side effects the AI must surface to the user.

### Previously (0.3.0 DX patch)

- **Quick Start rewritten** — removed misleading "auto-registers" claim; MCP configuration is now the explicit step 2 with platform-specific paths
- **postinstall hint** — `npm install -g cairn-mcp-server` now prints MCP setup instructions after install
- **`cairn init` improved** — bare `cairn init` (without `--empty`) creates scaffold AND prints setup guide; `--empty` stays silent for scripts
- **All 7 skill adapters gain Setup section** — each adapter file now includes MCP install + config path + CLI fallback instructions
- **mcp/README.md updated** — CLI section lists all commands (including dna/stage subcommands), Codex CLI config added, tool count corrected to 14
- **CAIRN_ROOT documented prominently** — multi-project/nested-repo tip in Quick Start

## [0.3.0] - 2026-05-16

### Added

- **DNA emergence closed loop** — `CompressionEngine.detectCandidates()` now runs automatically in `cairn_session_end`, producing trait candidates that flow into a dedicated `dna/staged/` channel for human review
- **3 new MCP tools** — `cairn_dna_list`, `cairn_dna_accept`, `cairn_dna_reject` for reviewing DNA trait candidates (total tools: 14)
- **`DnaStagedStore`** — new YAML-backed store at `.cairn/dna/staged/` for DNA trait candidates
- **DNA Safety Valve** — `CalibrationEar.applySafetyValve()` auto-reduces trait confidence (×0.9 per drift warning) and flips `reevaluation_mode = true` after ≥2 cumulative warnings with confidence <0.7
- **`DNATrait.drift_warning_count`** + **`DNATrait.last_safety_valve_at`** fields tracking safety valve state per trait
- **GitEar auto-scan** — `cairn_session_end` now calls `gitEar.scan(state.last_session.commit)` and routes signals (revert / dependency removed / dependency replaced / large refactor) through `TrustRouter` automatically
- **Automatic stage inference** — `StageEngine.infer()` runs in `cairn_session_end` with 14-day hysteresis and confidence ≥0.6 threshold; phase changes are emitted as `stage_transition` events to staged for human review
- **`state.stage.last_updated`** field powering stage hysteresis
- **Doctor auto-resurrection** — `cairn_doctor` now auto-resurrects archived G0/G1 events with high reactivation count (≥5 hits / 30 days); G2+ remain as human-reviewed candidates
- **Archived event surfacing** — `ActivationEngine` includes stale events with high recent hits as `archived: true` entries in `cairn_context` output, and `ChallengeEngine` emits downgraded challenges (G3 → reflective, G2 → suggestion) tagged `archived: true`
- **`subject.aliases` field** on EvolutionEvent — explicit synonyms (`["document store", "nosql"]`) used by ChallengeEngine for semantic matching beyond exact subject name
- **CLI subcommands** — `cairn dna list/accept/reject`, `cairn stage list/accept/reject`
- **Trauma sensitivity multiplier honored** — TrustRouter now applies the `sensitivity_multiplier` per trauma event (≥2.0 → gravity upgrades twice)
- **Cognitive Resurrection auto-trigger via Activation** — `cairn_context` records activations for archived events that match domain, advancing them toward resurrection candidacy
- **Constraints and Hooks sections** in `views/output.md`; **Owns / Does Not Own** in `views/domains/<d>.md`

### Changed

- `cairn_session_end` output expanded with `git_signals`, `stage`, `dna_compression`, `dna_safety_valve` sub-objects
- `cairn_status` exposes `dna.reevaluation_mode`, `dna.pending_candidates`, `dna.drift_warning_traits`, `stage.last_updated`, `staged.stage_transitions_pending`
- `cairn_plan` surfaces `dna_health: { reevaluation_mode, drift_warnings }`, archived-tagged constraints, and pending `stage_transition` entries as open questions
- `cairn_doctor` is no longer purely read-only — auto-resurrect is a side effect; output splits `resurrection_candidates` (G2+) and `auto_resurrected` (G0/G1)
- `ChallengeEngine` no longer filters to active-only events — stale no-go events still produce downgraded challenges
- `CompressionEngine` only emits `simplicity_bias` and `infra_aggressiveness` (the trait names recognized by trust-router/challenge-engine); other patterns are no longer surfaced as DNA candidates
- `TrustRouter` removed duplicated inline governance hard-rule branch; routing is fully delegated to `GovernanceEngine.checkPermission()` which respects cognitive_mode
- `cairn_init_commit` output restructured: `created`, `written: { config, skeleton, blood_auto_confirmed, blood_staged, stage, views }`, `pending_review`, `initialization_status`
- `ConversationSignal.evidence.files_involved` renamed to `files`
- Removed dead `commit_frequency_change`, `new_contributor`, `todo_fixme_cluster` from `GIT_SIGNAL_TYPES` (never properly consumed by mapper)

### Fixed

- `ActivationEngine.activate()` no longer returns empty challenges array — it now invokes `ChallengeEngine.detectConflicts()` internally and includes the result
- `ChallengeEngine.checkTrauma()` previously collected search terms but never filtered against them — trauma challenges now only fire when the task or subject_name actually relates
- `ConsistencyEngine.checkSkeletonReality()` now flags blood events whose domain has no skeleton node
- `CalibrationEar` now performs all four documented checks (no-go conflicts, skeleton drift, debt resolution candidates, DNA drift warnings)
- `cairn_init_commit` accepts `imprint` parameter (inherited cognition for forked projects)
- `runStageInference` no longer makes a redundant `getCommitStats()` call

### Architecture

- **All 13 engines now active at runtime** — previously dormant `StageEngine.infer`, `CompressionEngine.detectCandidates`, `GitEar.scan`, and partial `ResurrectionEngine` are now wired into `cairn_session_end` and `cairn_doctor`
- **14 MCP tools** (was 11)
- **11 YAML stores** (was 10, added `DnaStagedStore`)
- **14 engines** retained but all activated

## [0.3.0-rc.1] - 2026-05-15

### Breaking Changes

- Complete V3 rewrite — new architecture, new storage format, not backward compatible with V2
- `.cairn/memory/` replaced by `.cairn/blood/` (evolution events with full lifecycle metadata)
- Trust Router levels L0–L3 replaced by Gravity system G0–G3 (drop, suggestion, reflective challenge, hard constraint)
- `cairn_review` and `cairn_memory` MCP tools removed — replaced by `cairn_stage_list`, `cairn_stage_accept`, `cairn_stage_reject`
- `cairn_status` no longer accepts `action` parameter for stage management — stage operations moved to dedicated tools and CLI commands
- Config schema version bumped to `3.0` with new structure (cognitive_mode, stage.override)
- Signal schema split into three types: GitSignal, ConversationSignal, CalibrationSignal

### Added

- **Skeleton**: Domain ownership map — each domain declares what it owns, does not own, stability level, causal keywords, and dependencies
- **Blood**: Evolution events with full metadata — gravity, source, subject, behavior effect, lifecycle (validity/decay), trauma, governance status, health tracking
- **DNA**: Emergent project personality traits — compressed from repeated patterns, with identity status (not_yet_emerged → emerging → emerged) and imprint inheritance for forked projects
- **Capillaries**: Per-domain constraint projections — constraints, rejected paths, and accepted debt automatically derived from blood events
- **Gravity system (G0–G3)**: G0 drop, G1 suggestion, G2 reflective challenge, G3 hard constraint — with multi-dimensional gravity (architectural, operational, local)
- **Governance**: 3-tier validation (agent_proposed, system_validated, human_ratified) with full audit log
- **Cognitive modes**: lightweight / standard / institutional — controls governance threshold, decay aggressiveness, DNA evidence requirements, calibration depth
- **Trauma system**: Permanent domain sensitivity markers with configurable sensitivity multiplier, decay override, and DNA impact
- **Lifecycle management**: Validity levels (transient, tactical, strategic, identity) with configurable decay policies (downgrade, expire, permanent)
- **Calibration Ear**: Detects skeleton drift, consistency conflicts, debt resolution candidates, and DNA drift warnings
- **Activation Engine**: Context-aware cognition activation — filters blood events by domain relevance, generates challenges for current task
- **Challenge Engine**: Produces reflective challenges when AI approaches areas with known constraints
- **Decay Engine**: Ages stale blood events based on cognitive mode parameters
- **Compression Engine**: Identifies DNA trait candidates from repeated blood patterns
- **Resurrection Engine**: Detects access patterns that warrant resurrecting archived events
- **Consistency Engine**: Validates cross-subsystem consistency (skeleton vs blood, domain capillaries, DNA coherence)
- **11 MCP tools**: `cairn_init_status`, `cairn_init_commit`, `cairn_context`, `cairn_signal`, `cairn_session_end`, `cairn_status`, `cairn_plan`, `cairn_stage_list`, `cairn_stage_accept`, `cairn_stage_reject`, `cairn_doctor`
- **Two-phase initialization**: `cairn_init_status` checks project state, `cairn_init_commit` writes initial cognition (skeleton, blood, DNA, stage) in one atomic batch
- **CLI commands**: `cairn init --empty`, `cairn status`, `cairn doctor`, `cairn review`, `cairn audit`, `cairn dna show/reevaluate`, `cairn skeleton show`, `cairn blood show/archive/resurrect/trauma`, `cairn stage confirm`
- **11 Zod schemas**: EvolutionEvent, SkeletonNode, DNAIdentity, DNAImprint, DomainCapillary, Config, State, GovernancePolicy, AuditEntry, StagedEntry, SessionRecord, plus shared schemas (Gravity, Source, Subject, BehaviorEffect, Lifecycle, Trauma, Revisit, Health)
- **11 YAML stores**: BloodStore, SkeletonStore, DnaStore, DomainStore, SignalStore, StagedStore, StateStore, ConfigStore, GovernanceStore, SessionStore
- **14 engines**: ActivationEngine, ChallengeEngine, StageEngine, DecayEngine, CompressionEngine, ResurrectionEngine, ConsistencyEngine, BloodEngine, ViewsEngine, GovernanceEngine, TrustRouter, GitEar, CalibrationEar

### Changed

- **Architecture**: From flat memory engine to Skeleton + Blood + DNA + Capillaries + Gravity + Governance
- **Storage format**: `memory/*.yaml` (flat entries) → `blood/*.yaml` (evolution events with gravity, lifecycle, trauma, governance)
- **Trust routing**: L0–L3 level-based → G0–G3 gravity-based with multi-dimensional weight (architectural, operational, local)
- **Signal types**: Unified signal type → three specialized types (GitSignal, ConversationSignal, CalibrationSignal)
- **Initialization**: Single auto-bootstrap → two-phase AI-mediated initialization (init_status + init_commit)
- **Views engine**: Regenerated from blood events instead of memory entries, with skeleton and DNA context
- **Stage management**: `cairn_status(action: 'stage_confirm')` → dedicated `cairn stage confirm` CLI and `cairn_stage_accept` MCP tool
- **Domain model**: Flat domain list → rich domain capillaries with constraints, rejected paths, and accepted debt

### Removed

- `memory/` directory and MemoryEntry schema (replaced by `blood/` and EvolutionEvent)
- `cairn_review` MCP tool (replaced by `cairn_stage_list` + `cairn_stage_accept` + `cairn_stage_reject`)
- `cairn_memory` MCP tool (blood management via CLI `cairn blood` commands)
- L0–L3 trust levels (replaced by G0–G3 gravity system)
- `trust_policy` config section (replaced by cognitive mode parameters and governance)
- `MemoryStore` (replaced by BloodStore)
- Single-phase auto-bootstrap (replaced by two-phase init_status + init_commit)

## [0.2.10] - 2026-05-15

### Changed

- **Full-history git analysis**: First bootstrap now scans the complete commit history instead of only the last 5 commits. Dependency changes, large refactors, and reverts across the entire project history are detected
- **Per-commit dependency analysis**: Rewrote `detectDependencyChanges` to analyze each commit individually via `git log --diff-filter=M`, fixing the "net diff" bug where intermediate removals were masked by the final state
- **Rich signal metadata**: All git-ear signals now populate `what`, `reason`, and `subject` fields in `raw_data`, producing human-readable memory summaries instead of signal-type placeholders
- **Package.json key filtering**: `extractPackageName` now skips structural keys (`dependencies`, `name`, `scripts`, etc.) to avoid false positive dependency signals
- **Tech stack storage**: Moved from 22 individual memory YAML files (660 lines) to a lightweight `tech_stack` array in `config.yaml`. Memory is now reserved for non-derivable decisions, rejections, and constraints
- **Compact stack view**: `views/output.md` stack section now renders domain-grouped format (`frontend: React, Next.js, Tailwind CSS`) instead of one-per-line with redundant summaries

### Added

- **Monorepo workspace scanning**: Bootstrap discovers and scans workspace packages from `pnpm-workspace.yaml`, `package.json` workspaces, and `pyproject.toml` uv workspaces. Tech stack detection coverage goes from root-only to all workspace packages
- **Expanded tech detection**: Added 15+ packages to NODE_TECH_MAP (React Query, Zustand, Redux, Turborepo, React Flow, Socket.IO, etc.) and 10+ Python libraries (SQLAlchemy, Alembic, asyncpg, Redis, APScheduler, Uvicorn, Pydantic, HTTPX)
- **Domain inference from file paths**: New `classifyFilePath` and `inferDomainFromFiles` methods map changed files to domains (frontend, backend, worker, database, deployment, auth, testing)
- **Dependency file domain inference**: `inferDomainFromDepFile` classifies dep files by their workspace location (e.g., `apps/api/pyproject.toml` → backend)
- **Commit message pattern analysis**: New `detectCommitPatterns` method extracts domain activity signals from commit messages using keyword matching and conventional commit scope parsing
- **Tech transition detection**: Detects migration patterns in commit messages (`migrate from X to Y`, `replace X with Y`, etc.) and produces decision signals
- **Young project stage inference**: Projects younger than 3 months now default to "exploration" phase instead of falling through to the default "growth 0.4" branch
- **Stage evidence enrichment**: Stage advisory now includes total commit count and top active domains (by commit keyword frequency) in the evidence section
- **Tests**: 15 new test cases covering full-history scanning, signal metadata, domain inference, commit patterns, tech transitions, young project stage, and monorepo workspace detection

## [0.2.9] - 2026-05-15

### Changed

- **Config-driven L3 trust routing**: Removed hardcoded conversation signal bypass in `matchesL3Policy()`. Replaced manual `.includes()` pattern matching with a generic `evaluateRule()` method that parses `key == 'value' AND ...` expressions — trust_policy L3_auto_write rules are now truly configurable
- **Unified default L3 rules**: Extracted `DEFAULT_L3_AUTO_WRITE` shared constant (5 rules) to eliminate inconsistent copies across bootstrap, server, cairn-signal, and cairn-session-end fallback configs
- **Schema default updated**: `ConfigSchema` L3_auto_write default now includes all 5 rules (was 2 git-only rules)

### Added

- **Performance tests**: 8 benchmarks covering 200-entry scale — loadAll, findDuplicate, findConflicts, regenerate, consecutive regenerates, route with large memory, sequential signals, full pipeline
- **Lifecycle Session 4**: historical-reference signal routing, review reject, memory show/archive, stage_confirm
- **evaluateRule edge case tests**: single condition, extra whitespace, unknown variables, malformed rules, empty strings, multi-condition matching
- **Config variation tests**: custom L3 rules, conversation-only config, stricter scope constraints, malformed rule strings

## [0.2.8] - 2026-05-15

### Fixed

- **Critical: conversation signals now auto-write to memory (L3)**: User rejections, decisions, and debt acceptances reported via `cairn_signal()` are now immediately written to memory instead of being silently dropped into the L1 signals pool. This was the root cause of Cairn's core lifecycle being non-functional — constraints reported in one session were invisible in the next.
- **Trust policy extensibility**: `matchesL3Policy()` now evaluates conversation-sourced signal rules, not just git-revert and git-dependency patterns
- **`inferMemoryType` completeness**: Added missing mappings for `user-constraint`, `historical-reference`, and `stage-signal` signal types
- **`staged-store.accept()` data loss**: Fixed hardcoded confidence level ("medium"), source kind ("conversation"), and subject name (truncated summary) — now preserves original values from the draft memory

### Changed

- **Default L3 trust policy**: Added 3 new auto-write rules for conversation signals (rejection, decision, debt) to all config templates and fallbacks
- **Lifecycle test rewritten**: Now verifies the complete cross-session flow: signal capture → L3 memory → persistence → staged review → context retrieval

## [0.2.7] - 2026-05-15

### Added

- **Tech stack detection**: Bootstrap scans project files (package.json, Cargo.toml, go.mod, pyproject.toml, tsconfig.json, Dockerfile, CI configs) and creates memory entries for detected frameworks, test runners, build tools, ORMs, and infrastructure
- **Populated output.md**: `views/output.md` now includes a `## stack` section listing all detected technology choices

### Fixed

- **Bootstrap writes to memory**: Git signals (reverts, dependency changes, large refactors) now write directly to memory during bootstrap instead of being routed to staged review queue
- **Non-empty initialization**: `.cairn/` is populated with real project analysis from day one — no more empty templates

### Changed

- **TrustRouter.signalToMemory** is now a public method for use by bootstrap and other callers that need to bypass trust routing

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
