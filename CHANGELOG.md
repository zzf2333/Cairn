# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
