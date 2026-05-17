# Reverse-Regression Scenarios

A 25-scenario harness that turns Cairn's core promise — "AI does not walk into the same wall twice" — into CI-assertable evidence.

Each scenario boots a fresh `.cairn/` fixture, spawns a real Cairn MCP server, drives a real LLM through a controlled prompt, and asserts the resulting tool-call trace and assistant text against `expected.yaml`.

Two platforms are exercised side-by-side:
- **Claude Code** — Anthropic Messages API + the `skills/claude-code/SKILL.md` protocol as system prompt
- **Codex** — OpenAI Chat Completions + the `skills/codex.md` protocol as system prompt

Each scenario = 2 runs (one per platform) = the same constraint, two protocols, double the signal.

## Layout

```
tests/scenarios/
├── README.md                 — this file
├── runner/
│   ├── index.ts              — CLI entry (npm run scenarios)
│   ├── types.ts              — shared types
│   ├── discover.ts           — find scenarios by directory naming convention
│   ├── fixture-builder.ts    — YAML spec → real .cairn/ directory
│   ├── mcp-bridge.ts         — spawn MCP server + stdio client
│   ├── platform-claude-code.ts — Anthropic SDK driver
│   ├── platform-codex.ts     — OpenAI SDK driver
│   ├── assertions.ts         — expected.yaml evaluator
│   ├── reporter.ts           — terminal output
│   ├── smoke.ts              — framework smoke test for ONE scenario (no LLM)
│   └── smoke-all.ts          — framework smoke test for ALL scenarios (no LLM)
├── _shared/                  — reusable fixture fragments (currently empty)
├── a1-no-go-direct-hit/
│   ├── fixture.yaml          — declarative .cairn/ spec (builder expands it)
│   ├── prompt.md             — user input (one section per turn, `## USER` separators)
│   ├── expected.yaml         — tool / text assertions
│   └── README.md             — what this scenario tests
├── ...
└── _runs/                    — saved JSON logs from real LLM runs (gitignored)
```

Naming convention: `<category-letter><index>-<kebab-case-title>/`. Category letters: A core / B capture / C protocol / D robustness.

## Coverage

25 scenarios across 4 categories, 50 runs per full pass (×2 platforms):

| ID  | Category    | Tests |
|-----|-------------|-------|
| A1  | core        | no_go direct hit (G3 rejection respected) |
| A2  | core        | constraint_declaration: no Redis |
| A3  | core        | accepted_debt: do not fix N+1 |
| A4  | core        | hard_constraint: trauma-flagged stop (Rust rewrite) |
| A5  | core        | trauma: MongoDB data-loss history |
| A6  | core        | domain rejected_path: JWT in localStorage |
| A7  | core        | stage_constraint: maintenance phase conservatism |
| A8  | core        | archived event with high reactivation: reflective challenge |
| A9  | core        | DNA simplicity_bias modulates recommendation |
| A10 | core        | DNA reevaluation_mode pauses trait influence |
| B1  | capture     | user volunteers historical_reference → captured |
| B2  | capture     | user makes a decision → captured with alternatives |
| B3  | capture     | user rejects suggestion → captured |
| B4  | capture     | user accepts debt → captured with revisit_when |
| B5  | capture     | inverse: noise / formatting NOT signaled |
| B6  | capture     | "not in this phase" → stage_constraint captured |
| C1  | protocol    | cairn_context must be first tool call |
| C2  | protocol    | cairn_session_end required at session close (with real summary) |
| C3  | protocol    | pending staged entries surface to user |
| C4  | protocol    | challenges three-level intervention respected |
| C5  | protocol    | doctor side effects (auto-resurrection) reported transparently |
| D1  | robustness  | duplicate signal de-dup is visible to AI |
| D2  | robustness  | degraded mode (no MCP) falls back to views/ |
| D3  | robustness  | empty project triggers AI-native init flow |
| D4  | robustness  | scale: 1000 blood events still responsive |

## Run

```bash
# install once
cd mcp
npm install

# requires API keys
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...

# run everything (both platforms × 25 scenarios)
npm run scenarios

# filter by id substring
npm run scenarios -- a1

# one platform only
npm run scenarios:cc
npm run scenarios:codex

# crash fast on first fail
npm run scenarios -- --bail

# framework smoke test — NO LLM, just verifies fixtures + MCP wiring
npx tsx tests/scenarios/runner/smoke-all.ts
```

### Env knobs

| Variable | Default | What it does |
|----------|---------|--------------|
| `ANTHROPIC_API_KEY` | (required for CC) | Anthropic key |
| `OPENAI_API_KEY` | (required for Codex) | OpenAI key |
| `CAIRN_SCENARIO_MODEL_CC` | `claude-sonnet-4-5` | CC model id |
| `CAIRN_SCENARIO_MODEL_CODEX` | `gpt-5` | Codex model id |
| `CAIRN_SCENARIO_MAX_TURNS` | `24` | hard cap on tool-use loop iterations per user turn |
| `CAIRN_SCENARIO_VERBOSE` | `0` | `1` prints assistant + tool-use per step |

### Outputs

- Terminal: PASS/FAIL per scenario × platform + a summary table
- `_runs/<scenario_id>/<platform>.json`: full record (raw messages, tool calls, assertion results) for offline inspection

## Adding a new scenario

1. Create directory `<letter><n>-<title>/` (e.g. `a11-new-rule/`)
2. Add `fixture.yaml` — declarative spec (see `fixture-builder.ts` for the type)
3. Add `prompt.md` — single user message, or multi-turn separated by `## USER` lines
4. Add `expected.yaml` — required / forbidden tool calls and text patterns
5. (Optional) Add `README.md` documenting the scenario
6. Run framework smoke: `npx tsx tests/scenarios/runner/smoke-all.ts <id>`
7. Run real: `npm run scenarios -- <id>`
8. Iterate `expected.yaml` until both platforms PASS

## Expected.yaml schema (quick reference)

```yaml
description: |
  Free-form explanation of what this scenario tests.

# at least one of `must_be_called` calls must match
required_tool_calls:
  - tool: cairn_context
    must_be_called: true
    order: 1                        # optional — earliest matching call must be at this 1-indexed order
    args_match:                     # optional — dot-path regex match against arguments
      task: "(?i)oauth|auth"
      "details.what": "(?i)redis"

# none of these may match
forbidden_tool_calls:
  - tool: cairn_signal
    args_match:
      signal_type: "user_rejection"
    description: must not re-signal an existing rejection

# regex case-insensitive against the cumulative assistant text
required_text_patterns:
  - pattern: "(?i)previously rejected"
    near_pattern: "(?i)team size"    # optional — must appear within ±400 chars

forbidden_text_patterns:
  - pattern: "```\\s*rust"           # ban a fenced rust code block

min_total_tool_calls: 1
max_total_tool_calls: 20
```

## Why this approach

- **Real LLMs, not mocks.** The promise being tested is "the actual model respects Cairn protocol." Mocking the LLM erases the only meaningful signal.
- **Real MCP server, not a stub.** We spawn `dist/index.js` and connect via stdio — same path real users hit. Schema bugs in tools surface here first.
- **Per-platform protocol injection.** Each platform's `skills/*.md` is loaded as the system prompt. Tests fail when those docs diverge from runtime expectations — they are the contract.
- **Assertion-style, not snapshot.** We do not pin the assistant's exact wording (it varies run-to-run). We pin behavioral invariants: did it call the tool, did it surface the historical reason, did it refuse implementation code.

LLMs are non-deterministic; flaky assertions usually mean the assertion is over-specified. Loosen the regex, broaden the `near_pattern` window, or split into multiple smaller patterns.
