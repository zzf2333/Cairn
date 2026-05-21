# Reverse-Regression Scenarios

A 39-scenario harness that turns Cairn's core promise — "AI does not walk into the same wall twice" — into CI-assertable evidence.

## Test Hierarchy

Cairn's tests are organized in four levels:

### L0: Unit + Integration (vitest, no LLM)

Run via `npm test`. Exercises stores, schemas, engines, tools, and integration flows against real temp directories. No mocks for stores. Suites:

- `tests/stores/` — atomic writes, store CRUD
- `tests/schemas/` — Zod schema validation
- `tests/engines/` — read/write engine logic, git signal mapper
- `tests/tools/` — tool handler unit tests
- `tests/integration/` — timeline, session-guard, lifecycle, governance, pipeline
- `tests/acceptance/` — end-to-end flows via direct tool calls
- `tests/e2e/` — CLI invocation
- `tests/performance/` — response time benchmarks
- `tests/security/` — path traversal, injection checks

### L1: Protocol Scenarios (A–D, 26 scenarios, real LLM)

Tests that the AI calls the right tools in the right order with correct arguments.

### L2: Cognitive Behavior Scenarios (E–H, 9 scenarios, real LLM)

Tests that Cairn's returned cognition actually changes AI decision-making — not just tool call correctness, but behavioral outcomes.

### L3: Skill Compliance Scenarios (T11–T14, real LLM)

Tests that the Skill Runtime drives a complete Cairn lifecycle for realistic task types: architecture planning, stale session recovery, explicit rejection capture, and minimal intervention for trivial tasks.

Each scenario boots a fresh `.cairn/` fixture, starts the Cairn runtime, drives a real LLM through a controlled prompt, and asserts the resulting tool-call trace and assistant text against `expected.yaml`.

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
│   ├── mcp-bridge.ts         — spawn Cairn server + stdio client (legacy, to be migrated)
│   ├── platform-claude-code.ts — Anthropic SDK driver
│   ├── platform-codex.ts     — OpenAI SDK driver
│   ├── assertions.ts         — expected.yaml evaluator
│   ├── reporter.ts           — terminal output
│   ├── smoke.ts              — framework smoke test for ONE scenario (no LLM)
│   ├── smoke-all.ts          — framework smoke test for ALL scenarios (no LLM)
│   └── smoke-lifecycle.ts    — deterministic session guard lifecycle test (no LLM)
├── _shared/                  — reusable fixture fragments (currently empty)
├── a1-no-go-direct-hit/
│   ├── fixture.yaml          — declarative .cairn/ spec (builder expands it)
│   ├── prompt.md             — user input (one section per turn, `## USER` separators)
│   ├── expected.yaml         — tool / text assertions
│   └── README.md             — what this scenario tests
├── ...
└── _runs/                    — saved JSON logs from real LLM runs (gitignored)
```

Naming convention: `<category-letter><index>-<kebab-case-title>/`. Category letters: A core / B capture / C protocol / D robustness / E cognition-avoidance / F cognition-debt-trauma / G cognition-dna / H cognition-capture-challenge.

## Coverage

39 scenarios across 9 categories, 78 runs per full pass (×2 platforms):

### L1: Protocol Tests (A–D)

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
| D2  | robustness  | degraded mode falls back to views/ |
| D3  | robustness  | empty project triggers AI-native init flow |
| D4  | robustness  | scale: 1000 blood events still responsive |

### L2: Cognitive Behavior Tests (E–H)

These test whether Cairn's returned cognition **actually changes AI decision-making**, not just whether tools are called correctly.

| ID  | Category             | Tests |
|-----|----------------------|-------|
| E1  | cognition-avoidance  | tRPC rejected (G3) → AI recommends REST, not tRPC |
| E2  | cognition-avoidance  | Redis no-go → AI recommends in-process cache, not Redis |
| F1  | cognition-debt       | accepted N+1 debt → AI defers refactoring, surfaces conditions |
| F2  | cognition-trauma     | Kafka trauma (G3) → AI refuses casual adoption, requires sign-off |
| G1  | cognition-dna        | simplicity_bias high → AI leans toward REST over GraphQL/gRPC |
| G2  | cognition-dna        | reevaluation_mode pauses DNA → AI gives balanced analysis (control for G1) |
| G3  | cognition-dna        | archived rejection with high reactivation → reflective challenge, not hard block |
| H1  | cognition-challenge  | JWT localStorage rejected → AI raises reflective challenge, not hard block |
| H2  | cognition-capture    | user declares "no ORMs" → captured via cairn_signal + respected |
| H3  | cognition-capture    | noise (CSS rename) → NOT signaled (inverse test) |

### L3: Skill Compliance Tests (T)

These test whether the Skill Runtime drives a complete Cairn lifecycle for realistic task types.

| ID   | Category          | Tests |
|------|-------------------|-------|
| T11  | skill-compliance  | architecture task triggers context + plan, respects Redis rejection |
| T12  | skill-compliance  | blocked stale session → recover → fresh context |
| T13  | skill-compliance  | explicit user rejection → captured via cairn_signal |
| T14  | skill-compliance  | typo-only task → minimal intervention (context only, no plan/signal) |

## Run

```bash
# install once
cd cli
npm install

# requires API keys
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...

# run everything (both platforms × 35 scenarios)
npm run scenarios

# filter by id substring
npm run scenarios -- a1

# one platform only
npm run scenarios:cc
npm run scenarios:codex

# crash fast on first fail
npm run scenarios -- --bail

# framework smoke test — NO LLM, just verifies fixtures + tool wiring
npm run smoke

# session guard lifecycle — NO LLM, verifies context→signal→session_end→recover state machine
npm run smoke:lifecycle
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
- `_runs/<scenario_id>/<platform>-<driver>.json`: full record (raw messages, tool calls, assertion results) for offline inspection

## Known platform differences (Codex)

The CLI driver runs both real `claude -p` and real `codex exec`. Some scenarios consistently expose Codex platform behavior that diverges from Claude Code:

| Scenario | Pattern |
|----------|---------|
| **A7 stage maintenance** | Codex tends to draft the migration plan despite a `maintenance` stage. Stage advisory is weaker than `hard_constraint` in modulating Codex behavior. |
| **B3 multi-turn user_rejection** | Multi-turn scenarios use `codex exec resume <thread_id>` to carry session state. In practice the resume sometimes loses earlier context, so signals raised in turn 2 (e.g. user rejecting the AI's turn-1 suggestion) don't get captured. Investigating. |
| **C3 staged prompt review** | When the fixture cwd is empty of source code, Codex falls through to "no source files here, can't proceed" and ignores the pending `staged` queue that `cairn_context` surfaced. |
| **D3 empty init flow** | Same root cause as C3 — Codex reads the empty cwd as "wrong project" rather than "uninitialized Cairn project I should help initialize". |

These are not assertion bugs — they're real platform differences worth documenting. Claude Code passes all four scenarios with the same fixtures and prompts.

These four scenarios now have `platform_overrides.codex.allow_fail` in their `expected.yaml`, so they show as `XFAIL` (expected failure) rather than hard-failing CI. When Codex behavior improves, remove the override to promote to a real assertion.

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
  - id: ctx_call                    # optional — stable key for assertion_overrides (see below)
    tool: cairn_context
    must_be_called: true
    order: 1                        # optional — earliest matching call must be at this 1-indexed order
    args_match:                     # optional — dot-path regex match against arguments
      task: "(?i)oauth|auth"
      "details.what": "(?i)redis"

# none of these may match
forbidden_tool_calls:
  - id: no_re_signal
    tool: cairn_signal
    args_match:
      signal_type: "user_rejection"
    description: must not re-signal an existing rejection

# regex case-insensitive against the cumulative assistant text
required_text_patterns:
  - id: mention_rejection
    pattern: "(?i)previously rejected"
    near_pattern: "(?i)team size"    # optional — must appear within ±400 chars

forbidden_text_patterns:
  - id: no_rust_code
    pattern: "```\\s*rust"           # ban a fenced rust code block

min_total_tool_calls: 1
max_total_tool_calls: 20

# L2 assertions — verify cognition changes AI decisions

# verify tool result text contains expected patterns (proves AI saw the cognition)
required_tool_result_patterns:
  - id: ctx_surfaces_trpc
    tool: cairn_context
    result_pattern: "(?i)trpc|rejected"
    args_match:                       # optional — narrow to specific call
      task: "(?i)api"
    description: cairn_context must surface the tRPC rejection

# verify the AI's final recommendation direction
required_final_decision:
  id: e1_decision                     # derived ids: e1_decision/prefer, e1_decision/avoid/0
  prefer:                             # at least one must match assistant text (OR semantics)
    - "(?i)REST|OpenAPI"
  avoid:                              # each must be absent from assistant text (AND semantics)
    - "(?i)(recommend|suggest|use)\\s+tRPC"

# verify tool calls appear in this relative order (more flexible than fixed order: N)
required_sequence:
  - id: ctx_before_signal
    steps:
      - tool: cairn_context
      - tool: cairn_signal
        args_match:
          signal_type: "constraint_declaration"
    description: context before signal

# per-platform behavior (optional)
platform_overrides:
  codex:
    allow_fail: true                  # XFAIL — assertions run but failures don't break CI
    allow_fail_reason: "known resume/context issue"
    # skip: true                      # skip entirely — don't even run the scenario for this platform
    # skip_reason: "not applicable"
    assertion_overrides:              # per-assertion granularity (see "Assertion IDs" below)
      ctx_surfaces_trpc:              # ← match by stable id (preferred)
        allow_fail: true
        allow_fail_reason: "Codex resume loses turn context"
      "required tool_call: cairn_signal":   # ← fallback: match by auto-generated name
        allow_fail: true
        allow_fail_reason: "legacy name-based override"
```

## Assertion IDs

Every assertion type accepts an optional `id` field — a short, stable, kebab-case key that decouples `assertion_overrides` from auto-generated names.

**Why?** Without `id`, overrides must key on auto-generated names like `"required tool_call: cairn_context (consult context)"`. These names are derived from tool names, patterns, and descriptions — any edit to those fields silently breaks the override. An `id` is an explicit contract.

**How matching works:** the runner tries `id` first, then falls back to `name`:

```typescript
const ov = (a.id && overrides[a.id]) || overrides[a.name];
```

**`required_final_decision` derived IDs:** since one `required_final_decision` generates multiple sub-results (one per prefer/avoid entry), the `id` is used as a prefix:

| Parent `id` | Sub-result `id` |
|-------------|-----------------|
| `e1_decision` | `e1_decision/prefer` (one result for the entire prefer list) |
| `e1_decision` | `e1_decision/avoid/0`, `e1_decision/avoid/1`, ... (one per avoid entry) |
| _(omitted)_ | _(no id on sub-results — name-based matching only)_ |

**When to add `id`:** add one when a scenario uses `assertion_overrides` that target individual assertions. If all assertions share the same platform-level `allow_fail`, `id` is optional.

## Why this approach

- **Real LLMs, not mocks.** The promise being tested is "the actual model respects Cairn protocol." Mocking the LLM erases the only meaningful signal.
- **Real Cairn runtime, not a stub.** We exercise the actual tool handlers — same path real users hit. Schema bugs surface here first.
- **Per-platform protocol injection.** Each platform's `skills/*.md` is loaded as the system prompt. Tests fail when those docs diverge from runtime expectations — they are the contract.
- **Assertion-style, not snapshot.** We do not pin the assistant's exact wording (it varies run-to-run). We pin behavioral invariants: did it call the tool, did it surface the historical reason, did it refuse implementation code.

LLMs are non-deterministic; flaky assertions usually mean the assertion is over-specified. Loosen the regex, broaden the `near_pattern` window, or split into multiple smaller patterns.
