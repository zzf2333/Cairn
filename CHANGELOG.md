# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7] - 2026-04-20

### Fixed

- CLI symlink invocation: `cli/cairn` now follows symlinks when resolving `lang/*.sh` and `cmd/*.sh`; uses a portable `readlink` loop (BSD + GNU compatible) replacing the broken `dirname "${BASH_SOURCE[0]}"` pattern that pointed at the symlink's directory instead of the real script location
- Same fix applied to `scripts/cairn-init.sh` for consistency

### Changed

- README Option B: installation now uses `git clone ~/.cairn` + `PATH` append instead of `ln -s /usr/local/bin/cairn` (avoids macOS SIP permission failure for non-root users)
- README Update/Uninstall sections: updated to match PATH-based install
- MCP Server config examples in `README.md`, `README.zh.md`, and `mcp/README.md`: changed from `node /path/to/dist/index.js` to `cairn-mcp-server` to match npm install; `mcp/README.md` adds "From npm" as recommended install section; Claude Code config path corrected to `mcp.json` (not `settings.json`)

### Added

- `tests/test_cli_symlink.sh`: regression test suite for symlink invocation — single-level symlink, nested (double) symlink, and subcommand dispatch via symlink; guards against future regressions of the path-resolution fix

## [0.0.6] - 2026-04-20

### Added

- `cairn analyze` three-layer cold-start architecture — Layer 1 (Current Reality): scans tech stack, directory structure, and infra → writes `.cairn/output.md.draft`; Layer 2 (Explicit Intent): reads README, architecture docs, and ADR files, extracts conservative no-go signals → staged candidates; Layer 3 (Historical Events): existing git history scan (reverts, dep removals, keywords, TODO density)
- Layer 1 new detectors: `_analyze_detect_dir_structure` (monorepo/frontend+backend/microservices detection), `_analyze_detect_infra` (Docker/CI/K8s/Terraform detection), `_analyze_infer_domains` (dir + dep signal inference), `_analyze_write_output_draft` (writes `.cairn/output.md.draft`)
- Layer 2 new functions: `_analyze_find_intent_docs` (finds README/ARCHITECTURE/ADR files), `_analyze_extract_intent_signals` (conservative grep: "decided against / avoid / we don't / never use / no-go", max 5 per file), `_analyze_emit_intent_candidates` (staged candidates with `# layer: 2`)
- `# layer: N` meta field — all analyze candidates now carry `# layer: 3` (git history) or `# layer: 2` (intent docs); `cairn stage review` strips it on accept
- `--only layer1|layer2|layer3` — new aggregated values for `--only` flag; `layer3` is backward-compatible alias for all Layer 3 sub-types (`revert,dep,keyword,todo`)
- i18n: ~30 new `msg_analyze_layer*` functions in both `cli/lang/en.sh` and `cli/lang/zh.sh`; updated `msg_analyze_help` to document three-layer architecture

### Changed

- `cairn analyze` title updated to "three-layer cold start"; help text documents layers and new `--only` values
- `cli/cmd/analyze.sh`: `_analyze_write_candidate` bumped to `v0.0.6`, added 12th `layer` parameter (defaults to `3`); `_analyze_print_summary` simplified (removed stack_lines param, added Layer 1/2 counts); `cmd_analyze` restructured into three layer sections
- `cli/cmd/stage.sh`: `_stage_strip_meta` extended to also strip `# layer:` meta lines
- `cli/cairn`, `mcp/package.json`, `mcp/src/server.ts`: version bumped to `0.0.6`
- `tests/test_cli_analyze.sh`: version assertions updated to `v0.0.6`; 10 new test suites for Layer 1/2/--only flags; Layer 1 tests cover draft generation, stack fill, domain inference, infra detection, output.md safety; Layer 2 tests cover signal extraction, conservative matching, stage accept
- `tests/test_cli_stage.sh`: fixture `# layer: 3` line added; meta-strip test asserts `# layer:` removal; version strings updated

## [0.0.5] - 2026-04-14

### Added

- `cairn analyze` — new command that scans git history and generates staged history entry candidates with confidence levels; three detection strategies: revert commits (high), dependency removals via diff evidence (high), keyword-matched commits (`migrate|replace|drop|refactor`, medium), and TODO/FIXME density (low); supports `--dry-run`, `--since YYYY-MM-DD`, `--limit N`, `--only TYPE,...` flags; zero hard dependencies (jq optional, grep/sed fallback)
- Candidate file meta-comment format — staged files from `cairn analyze` carry `# cairn-analyze: v0.0.5`, `# confidence: high|medium|low`, and `# source:` headers; stripped automatically on accept by `cairn stage review`
- `cairn init` step 0 — detects `.git/` presence and offers to run `cairn analyze` before domain selection; analysis runs after domains are initialized; summary hints user to run `cairn stage review`
- `cairn stage review` analyze-awareness — displays `[confidence: high | source: ...]` banner for analyze candidates; warns on low-confidence entries; strips meta-comments on accept instead of plain `mv`
- Dependency ecosystem support in `cairn analyze` — parses `package.json`, `go.mod`, `requirements.txt`, `pyproject.toml`, and `Cargo.toml` to detect removed packages via git diff history
- i18n: ~50 new `msg_analyze_*` and `msg_stage_analyze_*` functions in both `cli/lang/en.sh` and `cli/lang/zh.sh`
- New test file `tests/test_cli_analyze.sh` — 12 test suites covering: no-git/no-cairn error paths, dry-run, revert detection, dep removal, go.mod parsing, keyword commits, --limit, --only, meta-comment stripping via stage review, --help, unknown flag

### Changed

- `cli/cairn`: version bumped to `0.0.5`; `analyze)` dispatch case added; `show_help` updated
- `cli/cmd/stage.sh`: added `_stage_extract_meta` and `_stage_strip_meta` helpers; `_stage_review` updated to display and strip analyze meta-comments
- `mcp/package.json` and `mcp/src/server.ts`: version bumped to `0.0.5`
- `tests/test_cli_stage.sh`: 3 new suites for analyze meta-comment display and stripping
- `tests/test_cli_dispatch.sh`: updated to verify `analyze` appears in help output
- `tests/run_tests.sh`: sources `test_cli_analyze.sh`

### Fixed

- SIGPIPE on Linux CI: replaced `head -1` with `git log --max-count=1` in `_analyze_git_first_date`, and replaced remaining `head -N` truncations with `awk 'NR<=N'` to prevent upstream pipe writers from receiving SIGPIPE under `set -o pipefail`

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
