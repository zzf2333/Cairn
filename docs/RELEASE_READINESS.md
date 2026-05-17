# Release Readiness — 1.0 Acceptance Checklist

> This is not a "documents we should write" list — it is the **hard acceptance criteria for cutting 1.0**.
>
> 1.0 means SemVer takes effect: once we tag `1.0.0`, breaking changes to `.cairn/` schema, MCP tool signatures, or CLI subcommands require a major bump. Everything that "works now" does not by itself qualify.

---

## Current Snapshot

| Axis | Score | Notes |
|------|-------|-------|
| Unit tests | ✅ | 268/268 passing, 80% line coverage threshold |
| Architecture landed | ✅ | 13 schema / 11 store / 14 engine / 14 tool, no dormant code |
| MCP protocol | ✅ | stdio boot verified end-to-end |
| Claude Code adaptation | ✅ | 25/25 reverse-regression scenarios passing |
| Codex adaptation | 🟡 | 21/25 (86%); 4 stable platform diffs (A7/B3/C3/D3) now have workarounds — real pass rate pending dogfood |
| Doc parity with code | ✅ | README / mcp/README / architecture doc / design philosophy / 7 adapters / SKILL all aligned |
| Dogfood | 🟡 | Started 2026-05-17 — Cairn now tracks Cairn (see `.cairn/` in repo root) |
| Long-horizon data | ❌ | DNA / decay / resurrection thresholds are still design values, not measurements |
| Stability contract | ✅ | `docs/STABILITY.md` draws Stable / Experimental / Internal boundary |
| Recovery paths | ✅ | `docs/RECOVERY.md` + `cairn doctor --fix / --recover / --metrics` |
| Performance benchmark | ✅ | `npm run bench` enforces SLO (p99 ≤ 500ms @ 1k blood) |
| Migration path | ✅ | `docs/MIGRATION.md` + `cairn migrate` CLI |
| External alpha users | ❌ | None yet |

Overall: **0.4.0 released to npm** as `cairn-mcp-server@0.4.0` (2026-05-17). Remaining to 1.0: long-horizon dogfood data + external alpha validation.

---

## 0.4.0 — Released

✅ Published 2026-05-17 — https://github.com/zzf2333/Cairn/releases/tag/v0.4.0
✅ `npm install -g cairn-mcp-server@0.4.0`

### Shipped scope

| Group | Items |
|-------|-------|
| **Stability** | `docs/STABILITY.md`, `docs/MIGRATION.md`, `state.cairn_version` field, `cairn migrate` CLI |
| **Recovery** | atomic write-rename for all stores, `doctor --fix` (corruption quarantine), `doctor --recover` (session checkpoint), `docs/RECOVERY.md` |
| **Codex workarounds** | maintenance = reflective_challenge strength (A7), `interaction_hint` for empty workspace (C3/D3), `codex exec resume` fixed by dropping `--ephemeral` (B3) |
| **Performance** | BloodStore in-memory cache + batch activation record → 1k p99 from 1715ms to 14.8ms (115× speedup), `docs/PERFORMANCE.md` with SLO gates |
| **Observability** | structured tool-call logs at `.cairn/logs/tools-YYYY-MM-DD.jsonl`, `cairn doctor --metrics` health snapshot |
| **User docs** | README defense-mechanisms section, `docs/TROUBLESHOOTING.md`, `docs/EXAMPLES.md` |
| **CLI E2E** | `tests/e2e/cli-smoke.test.ts` — 16 scenarios + exit-code convention |
| **Dogfood** | `.cairn/` initialized in repo root; `tests/scenarios/_findings.md` template |

---

## 1.0 Acceptance Criteria (all must be ✅)

### A. Stability commitment — ✅ done

- [x] `docs/STABILITY.md` defines Stable / Experimental / Internal
- [x] `docs/MIGRATION.md` describes 0.x → 1.0 upgrade path
- [x] `cairn_init_status` exposes `cairn_version` + warns on mismatch

### B. Dogfood — 🟡 started

- [x] `.cairn/` enabled in this repository (started 2026-05-17)
- [ ] ≥ 30 days continuous use
- [ ] ≥ 20 real blood events (not synthetic test fixtures)
- [ ] ≥ 1 DNA trait candidate runs end-to-end through human ratification (emerged or rejected)
- [ ] Surprises logged in `mcp/tests/scenarios/_findings.md` with corresponding regression tests

### C. Recovery paths — ✅ done

- [x] `cairn doctor --fix` quarantines corrupted yaml + reports orphan skeleton refs
- [x] Atomic write-rename in all 11 stores; no half-written state on concurrent writes
- [x] `cairn_session_end` writes step-level checkpoints; `cairn doctor --recover` clears them
- [x] `docs/RECOVERY.md` documents 5 scenarios end-to-end

### D. Codex 4 stable fails — ✅ workarounds landed (real-world validation pending)

| Scenario | Status |
|----------|--------|
| A7 maintenance vs hard_constraint | `skills/codex.md` + 6 adapters: maintenance phase explicitly = reflective_challenge strength |
| B3 multi-turn user_rejection | `codex exec resume` fixed — dropped `--ephemeral` flag which was disabling session persistence |
| C3 staged review on empty cwd | `cairn_context` emits `interaction_hint: review_staged_first`; skills documented response template |
| D3 empty init flow | `cairn_context` emits `interaction_hint: needs_init`; skills documented response template |

Real pass-rate uplift is pending the next reverse-regression run on real CLIs.

### E. Performance SLO — ✅ done

- [x] `cairn_context` activate p99 ≤ 500ms @ 1k blood (measured: ~15ms — 33× headroom)
- [x] `cairn_session_end` full pipeline ≤ 5s @ 1k blood (measured: ~115ms — 43× headroom)
- [x] `docs/PERFORMANCE.md` documents method and current data
- [x] `npm run bench` fails the build if SLO regresses

10k scale is intentionally not yet in the SLO gate — setup time on 10k yaml files exceeds vitest default timeout. Will be addressed once dogfood produces a real ≥ 1,000-event dataset.

### F. External alpha — ❌ not started

- [ ] ≥ 3 external users complete a full cycle (init → 30 days of use → ≥ 1 `cairn_session_end`)
- [ ] ≥ 5 external feedback items recorded in `mcp/tests/scenarios/_findings.md`
- [ ] All blocking issues closed

### G. Observability — ✅ done

- [x] Structured logs at `.cairn/logs/tools-YYYY-MM-DD.jsonl`, default on, configurable via `config.yaml.logging`
- [x] `cairn doctor --metrics` prints blood/DNA/staged/last-session snapshot

### H. User docs — ✅ done

- [x] README "Defense Mechanisms" section explaining trauma + reevaluation_mode
- [x] `docs/TROUBLESHOOTING.md` — 10 common symptoms with diagnosis steps
- [x] `docs/EXAMPLES.md` — small / mid / maintenance project samples

### I. CLI completeness — ✅ done

- [x] `tests/e2e/cli-smoke.test.ts` covers every subcommand end-to-end
- [x] Exit-code convention: 0 success, 1 user/input error, 2 `.cairn/` state error, 3 external dependency error
- [x] No subcommand crash destroys `.cairn/` state

---

## Phased path to 1.0

| Phase | Goal | Gate | ETA |
|-------|------|------|-----|
| **0.4.0** | Stability + recovery + perf + observability + docs | A + C + D + E + G + H + I | ✅ released 2026-05-17 |
| **0.5.x** | Dogfood findings → bug fixes + threshold tuning | B (incremental) | rolling |
| **0.9.0-alpha** | Open external alpha enrollment | F kickoff | when ≥ 14 dogfood days + zero P0 bugs |
| **1.0.0** | Hard cut, SemVer takes effect | B + F complete | 1-2 months |

---

## Out of scope for 1.0

The following are deliberately deferred to post-1.0:

- Localized docs beyond English
- Web UI / dashboard
- Stronger multi-AI write-conflict resolution beyond file locking
- More DNA trait kinds (currently `simplicity_bias` + `infra_aggressiveness`)
- Cross-project DNA / blood sharing
- Real-time bidirectional sync

---

## Self-check before pulling the 1.0 trigger

Must answer **yes** to all five:

1. Can a brand-new Codex user, following only the README, produce ≥ 1 blood event in 30 minutes without errors?
2. After a month of using Cairn to build Cairn, would I look at `.cairn/` and say "yes, that is my actual decision history"?
3. If a single `.cairn/blood/*.yaml` file is hand-corrupted, does Cairn still boot and recover?
4. Can a 0.4.0 user upgrade to 1.0.0 without losing `.cairn/` data?
5. Am I prepared to commit to ≥ 6 months of no breaking changes to MCP tool signatures after 1.0?

Any "no" → not 1.0.
