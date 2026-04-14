# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
