# Performance

> The hot path is `cairn_context`. It runs before every AI response. If it costs more than a perceptible blink, the AI tool starts skipping it. Latency is design.

---

## SLO

| Operation | Scale | Budget | Current |
|-----------|-------|--------|---------|
| `cairn_context` activate p99 | ≤ 1,000 blood events | ≤ 500 ms | ~15 ms (33× headroom) |
| `cairn_session_end` full pipeline | ≤ 1,000 blood events | ≤ 5,000 ms | ~115 ms (43× headroom) |

`npm run bench` (in `cli/`) fails the build if either SLO regresses.

---

## Benchmark methodology

```bash
cd cli
npm run bench
```

The benchmark suite (`tests/performance/benchmark.test.ts`):

1. Creates a fresh `.cairn/` in a tmpdir
2. Synthesizes N blood events across 5 domains
3. Runs `cairn_context.activate({ task })` 20 times — records p50 and p99
4. Runs one full `cairn_session_end` pipeline — records total time
5. Asserts the SLO

Test machine: Apple Silicon, Node 22. 1k-scale numbers reflect real IO + yaml parse cost.

---

## Reference numbers (0.4.0)

| Scale (blood events) | activate p50 | activate p99 | session_end |
|----------------------|--------------|--------------|-------------|
| 100 | ~4 ms | ~5 ms | ~125 ms |
| 1,000 | ~11 ms | ~15 ms | ~115 ms |

These are the numbers the SLO is tuned against. Your machine will vary; what matters is that p99 stays a meaningful multiple under the budget so production noise (filesystem load, other processes) can't push you over.

---

## Optimizations that landed in 0.4.0

| Change | File | Impact |
|--------|------|--------|
| `BloodStore` in-memory cache | `cli/src/stores/blood-store.ts` | 1k-scale p99 from 1715 ms → 14.8 ms (~**115× speedup**); cache invalidates on `save` / `remove` |
| `StateStore.recordActivationBatch` | `cli/src/stores/state-store.ts` + activation engine | Eliminates N writes to `state.yaml` per activation |
| `atomicWriteFile` (write + rename) | `cli/src/utils/atomic-write.ts` | Concurrent-safe; no measurable perf regression |

Cache lives in process, invalidates on Blood store mutations, shared across all tool calls in one MCP server lifetime. Multiple host restarts each spawn a fresh process, hence a cold cache; this is acceptable since the cache rebuilds in milliseconds.

---

## 10k scale — not yet SLO-gated

Bench setup at 10k requires writing 10k yaml files via `BloodStore.save`, which is fs IO-bound (≈ 6 minutes on Apple Silicon). vitest default timeout aborts the test before it can record numbers.

After the setup completes, **single-activation cost is projected to ~150 ms** (linear extrapolation from 1k → 11 ms, dominated by in-memory filter post-cache).

10k SLO will be added when:

- Dogfood produces a real ≥ 1,000 blood event dataset, or
- A one-shot fast-write setup script bypasses `BloodStore.save` to make benchmark setup feasible

Until then: 10k scale is unconstrained but believed safe based on the BloodStore cache architecture.

---

## Out of scope

- **Memory footprint.** BloodStore cache holds all events; ~5 MB at 1k, ~50 MB at 10k. Acceptable for a single-server long-running process.
- **Cold start.** `createContext` initializes 11 stores + 14 engines. Sub-second; not on the hot path.
- **Multi-process concurrency.** Cairn assumes one MCP server process per project. Multi-process coordination via file lock is a 0.5+ topic.

---

## What to do if performance regresses

1. Re-run `npm run bench` after a clean checkout — confirm regression is real
2. Check `cli/src/stores/blood-store.ts` — has cache invalidation become too aggressive?
3. Check `ActivationEngine.activate()` — has the call chain gained an extra `loadAll`?
4. Check `cli/src/observability/logger.ts` — is the wrapper synchronously blocking?

Then file the regression in `cli/tests/scenarios/_findings.md` with the bench output before and after.

---

## See also

- [`stability.md`](./stability.md) — performance numbers are not SemVer-protected, but the SLO targets are
- [`../v-intervene/tend.md`](../v-intervene/tend.md) — how to use perf data in maintenance
