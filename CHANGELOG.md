# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2026-04-14

### Added

- `cairn sync --hooks` — regenerate the `## hooks` section of `output.md` by scanning all domain frontmatter `hooks[]` arrays; prints to stdout (never auto-writes `output.md`); supports `--copy` flag; mutually exclusive with domain argument and `--stale`
- `related: [domain-name]` field in domain Frontmatter — declares related domains for combined injection advisory; MCP `cairn_match` uses this to surface relevant context; BFS 1-hop, max 2, author-declared order
- `cairn_match` `files` parameter (optional) — accepts currently-edited file paths for path-based confidence scoring alongside keyword matching; backward compatible (omitting `files` preserves v0.0.3 behavior)
- `cairn_match` confidence levels — `high` (keyword + file-path hit), `medium` (keyword only, or file-path only), `low` (keyword matched but file paths look unrelated → downgraded to optional injection)
- `cairn_match` related domain advisory — output includes "Optionally load only the `## trajectory` section" hint with remaining token budget estimate (≤ 1200 token cap: output + primary domain + 2 related trajectories)
- `mcp/src/related.ts` — `resolveRelated()` utility with cycle defense, missing-domain warnings, and configurable max
- `mcp/src/tokens.ts` — `approxTokens()` (chars/4 heuristic, consistent with CLI) and `extractSection()` (H2 markdown section extractor)
- `extractTrajectory()` in `parsers/domain.ts` — extract `## trajectory` section from domain body for related-domain advisory
- `msg_doctor_hooks_run_sync` hint — `cairn doctor` now appends "run: cairn sync --hooks" when hooks drift is detected
- Rules 9 & 10 in `cairn sync` prompt — require traceability to history entries; prohibit invented conclusions in `rejected paths`
- 4 new Bash test suites (15 assertions): `cairn sync --hooks` basic output, exit codes, mutual-exclusion errors, empty domains; `cairn doctor` hooks drift sync hint, bidirectional drift detection
- 4 new TS test files (25 assertions): `related.test.ts`, `tokens.test.ts`; extended `domain.test.ts`, `hooks.test.ts`, `cairn-match.test.ts`

### Changed

- `cli/cairn`: version bumped to `0.0.4`; `extract_domain_hooks` promoted to shared function (used by both `sync --hooks` and `doctor`)
- `cli/cmd/doctor.sh`: `_doctor_domain_hooks` refactored to call shared `extract_domain_hooks`; drift section appends fix hint
- `cli/cmd/sync.sh`: `--hooks` flag added; arg parser now rejects incompatible flag combinations
- `cli/lang/en.sh` and `cli/lang/zh.sh`: +5 functions each (`msg_sync_usage_hooks`, `msg_sync_hooks_paste_hint`, `msg_sync_hooks_empty`, `msg_doctor_hooks_run_sync`, `msg_err_flag_conflict`)
- `mcp/src/parsers/domain.ts`: `DomainFrontmatter` extended with `related: string[]`; `parseDomainFile` extracts and returns the field (defaults to `[]`)
- `mcp/src/hooks.ts`: `HooksIndex` extended with `domainRelated: Map<string, string[]>`; populated by `buildHooksIndex`
- `mcp/src/tools/cairn-match.ts`: fully rewritten to support `files`, confidence scoring, related advisory, and token budget estimation
- `mcp/src/server.ts`: version bumped to `0.0.4`; `cairn_match` inputSchema extended with optional `files` parameter
- `mcp/tests/fixtures/.cairn/domains/api-layer.md`: `related: ["auth"]` added to frontmatter

## [0.0.3] - 2026-04-14

### Added

- `cairn log --quick` — minimal 4-field capture mode (type, domain, summary, rejected); auto-fills `reason` and `revisit_when` with `[TODO]`; writes to `.cairn/staged/` instead of `history/`; checks for filename conflicts in both `staged/` and `history/`
- `cairn doctor` — rule-based health check (no LLM): token budget (target 500 / hard limit 800), no-go history support, hooks drift between `output.md` and domain frontmatter, stale domain detection, staged `[TODO]` count, staged entry age (> 14 days); exits 1 if any warning/error
- `cairn stage review` — interactive review loop for staged entries: `(a)ccept` moves to `history/`, `(e)dit` opens `$EDITOR`, `(s)kip` defers, `(q)uit` stops; safety guard for `[TODO]` fields (confirmation required); collision check before accepting
- Second example project (`examples/api-service-2yr/`) — 2-year API service at `scale` stage with 9 history entries, 6+ rejection-flavored entries, 2 accepted debt entries with `revisit_when` conditions, and intentionally stale `rate-limiting` domain to demonstrate `cairn doctor`
- Chinese mirror of second example (`examples/api-service-2yr-zh/`) — bilingual `hooks[]` arrays, English field keys, Simplified Chinese content
- `examples/README.md` — comparison table for both examples
- 3 new CLI test files: `test_cli_log_quick.sh`, `test_cli_doctor.sh`, `test_cli_stage.sh` (310 new assertions, total 887)
- Shared CLI functions: `compute_domain_stale`, `count_tokens_approx`, `find_staged_files` extracted into `cli/cairn` for reuse across `status`, `sync`, and `doctor`

### Changed

- `cli/cairn`: version bumped to `0.0.3`; dispatch extended with `doctor)` and `stage)` cases; `parse_domain_list` now requires `→` arrow before `domains/X.md` (aligns with MCP `extractLockedDomains` behavior, prevents false matches in no-go section)
- `cli/cmd/log.sh`: extracted `_log_write_entry()` private function; added `--quick` mode detection
- `cli/lang/en.sh` and `cli/lang/zh.sh`: +44 functions each (`msg_log_quick_*`, `msg_doctor_*`, `msg_stage_*`); parity maintained at 201 functions each

## [0.0.2] - 2026-04-14

### Added

- Chinese (`zh`) language support throughout the CLI and initialization script via `CAIRN_LANG` environment variable (auto-detected from `$LANG`)
- `cli/lang/en.sh` and `cli/lang/zh.sh` — function-based i18n layer for all user-visible CLI strings
- Language-continuity rule in all 8 AI tool skill adapters: AI now detects and matches the language of existing `.cairn/` files when drafting new entries
- Chinese parallel documentation: `README.zh.md`, `spec/FORMAT.zh.md`, `spec/DESIGN.zh.md`, `spec/adoption-guide.zh.md`, `spec/vs-adr.zh.md`, `mcp/README.zh.md`
- `spec/glossary.md` — bilingual terminology reference for consistent Chinese translation
- `TRANSLATIONS.md` — translation contribution guide and sync conventions
- Chinese example project (`examples/saas-18mo-zh/`) demonstrating all three layers with Chinese content values
- Language-continuity rule in MCP `cairn_sync_domain` prompt: generated domain content now matches the language of existing history entries

### Changed

- `cli/cmd/sync.sh` AI prompt extended with Rule 8: write content in the same language as existing history entries; section headers and field names stay English
- `scripts/cairn-init.sh` hooks line format simplified: `- keyword → domains/X.md` (removed `read ... first` English connector, language-agnostic)
- `mcp/src/parsers/output.ts` `extractLockedDomains()` and `cli/cairn` `parse_domain_list()` updated to match both old (`→ read domains/X.md first`) and new (`→ domains/X.md`) hooks formats for backward compatibility

## [0.0.1] - 2026-04-13

### Added

- Three-layer constraint format specification (`spec/FORMAT.md`) defining output.md, domains/, and history/ layers
- Design document (`spec/DESIGN.md`) explaining the rationale behind Cairn
- Cairn vs ADR comparison (`spec/vs-adr.md`)
- Adoption guide covering Init and Reactive workflows (`spec/adoption-guide.md`)
- 8 AI tool skill adapters: Claude Code, Cursor, Cline, Windsurf, GitHub Copilot, Codex CLI, Gemini CLI, OpenCode
- Interactive initialization script (`scripts/cairn-init.sh`) with domain selection and multi-tool skill install
- CLI with 4 commands: `cairn init`, `cairn status`, `cairn log`, `cairn sync` (Bash 3.2+)
- MCP Server with 6 tools (`cairn_output`, `cairn_domain`, `cairn_query`, `cairn_propose`, `cairn_sync_domain`, `cairn_match`) and 2 resources
- Shell test suite (577 assertions across 7 test files)
- Vitest test suite for MCP Server (100+ assertions across 12 test files)
- Complete SaaS-18mo example project demonstrating all three layers
