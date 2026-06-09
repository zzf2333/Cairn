# Repository Guidelines

## Project Structure & Module Organization

Cairn is a TypeScript CLI plus protocol documentation. The root package is private and mostly holds docs, examples, and the skill entrypoint. Active source code lives in `cli/src/`: command handlers under `cli/src/cli/`, runtime actions under `cli/src/actions/`, domain engines under `cli/src/engines/`, schemas under `cli/src/schemas/`, stores under `cli/src/stores/`, and shared utilities under `cli/src/utils/`. Tests mirror behavior in `cli/tests/`, including `unit`-style engine/store tests, integration and e2e suites, performance checks, security tests, and scenario fixtures. Long-form product and architecture documentation lives in `docs/`; generated diagrams are in `docs/diagrams/`; reusable skill metadata is in `skills/cairn/`.

## Build, Test, and Development Commands

Run commands from `cli/` unless noted otherwise.

- `npm ci`: install locked dependencies for CI-compatible work.
- `npm run dev -- <command>`: run the CLI from TypeScript via `tsx`.
- `npm run build`: compile `src/` to `dist/` with declarations and source maps.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run test:coverage`: run coverage; line coverage threshold is 80%.
- `npm run scenarios`: build, then run scenario fixtures.
- `npm run smoke`: build and run smoke coverage across scenario runners.

## Coding Style & Naming Conventions

Use TypeScript ES modules, Node 18+, strict typing, and 4-space indentation. Keep filenames kebab-case, such as `session-guard.ts`; keep exported types and classes PascalCase; keep functions and variables camelCase. Prefer existing engines, stores, schemas, and tool wrappers before adding new abstractions. Do not edit generated `cli/dist/` by hand; rebuild it.

## Testing Guidelines

Use Vitest. Name test files `*.test.ts` and place them near the relevant suite folder, for example `cli/tests/engines/recovery-engine.test.ts`. Add integration or scenario tests when behavior crosses CLI, store, and engine boundaries. Run `npm test` before small changes and `npm run test:coverage` or scenario commands for broader runtime changes.

## Commit & Pull Request Guidelines

History uses Conventional Commits, often with Chinese descriptions, for example `fix: align skill paths and dev script after skills/ restructure` or `refactor: 全局协议指令改为英文以提高跨工具兼容性`. Keep one logical change per commit. PRs should describe the behavior change, list verification commands, link issues when available, and include screenshots only for documentation or diagram updates.

## Agent-Specific Workflow

This repository uses Cairn. If `.cairn/` is present, start technical work with `cairn context --task "<task>" --json`, capture important decisions with `cairn signal`, run `cairn observe` before committing, and close with `cairn session-end`.
