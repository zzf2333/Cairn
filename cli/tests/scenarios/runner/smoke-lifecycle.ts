#!/usr/bin/env node
// Deterministic session guard lifecycle smoke test.
// Exercises the session state machine via direct CLI bridge calls.
// No LLM required — purely tests framework + state transitions.

import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { startCliBridge } from "./cli-bridge.js";
import { buildFixture, loadFixtureSpec } from "./fixture-builder.js";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

interface Check {
    name: string;
    fn: () => Promise<void>;
}

let pass = 0;
let fail = 0;

async function runCheck(check: Check): Promise<void> {
    try {
        await check.fn();
        console.log(`  ${GREEN}PASS${RESET}  ${check.name}`);
        pass++;
    } catch (e) {
        console.log(`  ${RED}FAIL${RESET}  ${check.name}`);
        console.log(`        ${DIM}${(e as Error).message}${RESET}`);
        fail++;
    }
}

function assert(condition: boolean, msg: string): void {
    if (!condition) throw new Error(msg);
}

async function readStateYaml(projectRoot: string): Promise<string> {
    return readFile(join(projectRoot, ".cairn", "state.yaml"), "utf8");
}

async function main(): Promise<void> {
    console.log("Session guard lifecycle smoke test\n");

    const fixturePath = join(import.meta.dirname, "../a1-no-go-direct-hit/fixture.yaml");
    const spec = await loadFixtureSpec(fixturePath);

    // ── Test 1: context creates active_session ──────────────────────────
    await runCheck({
        name: "cairn_context creates active_session",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-1-"));
            try {
                await buildFixture(tmp, spec);
                const bridge = await startCliBridge(tmp);
                try {
                    const r = await bridge.callTool("cairn_context", { task: "lifecycle smoke" });
                    assert(!r.isError, `cairn_context returned error: ${r.text.slice(0, 200)}`);
                    const state = await readStateYaml(tmp);
                    assert(state.includes("active_session"), "state.yaml should contain active_session after cairn_context");
                    assert(state.includes("context_loaded: true"), "active_session.context_loaded should be true");
                } finally {
                    await bridge.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    // ── Test 2: cairn_signal increments signals_count ───────────────────
    await runCheck({
        name: "cairn_signal increments active_session.signals_count",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-2-"));
            try {
                await buildFixture(tmp, spec);
                const bridge = await startCliBridge(tmp);
                try {
                    await bridge.callTool("cairn_context", { task: "signal count test" });

                    await bridge.callTool("cairn_signal", {
                        type: "decision",
                        what: "smoke test decision",
                        reason: "lifecycle test",
                    });

                    const state = await readStateYaml(tmp);
                    assert(state.includes("signals_count: 1"), `signals_count should be 1 after one signal, got: ${state.match(/signals_count: \d+/)?.[0] ?? "not found"}`);
                } finally {
                    await bridge.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    // ── Test 3: cairn_observe increments signals_count ──────────────────
    await runCheck({
        name: "cairn_observe increments active_session.signals_count",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-3-"));
            try {
                await buildFixture(tmp, spec);
                const bridge = await startCliBridge(tmp);
                try {
                    await bridge.callTool("cairn_context", { task: "observe count test" });

                    await bridge.callTool("cairn_observe", {
                        summary: "smoke test observe",
                        candidates: [{
                            signal_type: "decision",
                            details: { what: "observe test decision", reason: "lifecycle" },
                            evidence: {},
                            recommendation: "capture",
                            recommendation_reason: "test",
                        }],
                    });

                    const state = await readStateYaml(tmp);
                    assert(state.includes("signals_count: 1"), `signals_count should be 1 after one observe, got: ${state.match(/signals_count: \d+/)?.[0] ?? "not found"}`);
                } finally {
                    await bridge.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    // ── Test 4: cairn_session_end clears active_session ─────────────────
    await runCheck({
        name: "cairn_session_end clears active_session",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-4-"));
            try {
                await buildFixture(tmp, spec);
                const bridge = await startCliBridge(tmp);
                try {
                    await bridge.callTool("cairn_context", { task: "session end test" });

                    const stateBefore = await readStateYaml(tmp);
                    assert(stateBefore.includes("active_session"), "should have active_session before session_end");

                    await bridge.callTool("cairn_session_end", {
                        summary: "smoke lifecycle test complete",
                    });

                    const stateAfter = await readStateYaml(tmp);
                    assert(!stateAfter.includes("active_session"), "active_session should be cleared after session_end");
                } finally {
                    await bridge.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    // ── Test 5: cairn_plan without cairn_context → hard rejection ───────
    await runCheck({
        name: "cairn_plan without cairn_context returns hard rejection",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-5-"));
            try {
                await buildFixture(tmp, spec);
                const bridge = await startCliBridge(tmp);
                try {
                    const r = await bridge.callTool("cairn_plan", { task: "should be rejected" });
                    assert(r.isError, "cairn_plan without prior cairn_context should return an error");
                    const lower = r.text.toLowerCase();
                    assert(
                        lower.includes("context") || lower.includes("session"),
                        `error should mention context/session, got: ${r.text.slice(0, 200)}`,
                    );
                } finally {
                    await bridge.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    // ── Test 6: stale session → cairn_context blocks and requires recovery ──
    await runCheck({
        name: "cairn_context detects stale session and returns blocked_by_unclosed_session",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-6-"));
            try {
                await buildFixture(tmp, spec);

                const bridge1 = await startCliBridge(tmp);
                try {
                    await bridge1.callTool("cairn_context", { task: "stale session setup" });
                    await bridge1.callTool("cairn_signal", {
                        type: "decision",
                        what: "stale decision",
                        reason: "will become stale",
                    });
                } finally {
                    await bridge1.close();
                }

                const statePath = join(tmp, ".cairn", "state.yaml");
                const stateRaw = await readFile(statePath, "utf8");
                const stateObj = yamlParse(stateRaw) as Record<string, unknown>;
                const session = stateObj.active_session as Record<string, unknown>;
                session.last_touched_at = "2024-01-01T00:00:00.000Z";
                await writeFile(statePath, yamlStringify(stateObj), "utf8");

                const bridge2 = await startCliBridge(tmp);
                try {
                    const r = await bridge2.callTool("cairn_context", { task: "new session after stale" });
                    assert(!r.isError, `cairn_context returned error: ${r.text.slice(0, 200)}`);
                    const lower = r.text.toLowerCase();
                    assert(
                        lower.includes("blocked") || lower.includes("unclosed") || lower.includes("recover"),
                        `should indicate blocked/unclosed session, got: ${r.text.slice(0, 300)}`,
                    );
                } finally {
                    await bridge2.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    // ── Test 7: cairn_session_recover closes stale session ──────────────
    await runCheck({
        name: "cairn_session_recover closes a stale session",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-7-"));
            try {
                await buildFixture(tmp, spec);

                const bridge1 = await startCliBridge(tmp);
                try {
                    await bridge1.callTool("cairn_context", { task: "will become stale" });
                    await bridge1.callTool("cairn_signal", {
                        type: "decision",
                        what: "stale decision 2",
                        reason: "test recover",
                    });
                } finally {
                    await bridge1.close();
                }

                const bridge2 = await startCliBridge(tmp);
                try {
                    const r = await bridge2.callTool("cairn_session_recover", {});
                    assert(!r.isError, `cairn_session_recover returned error: ${r.text.slice(0, 200)}`);

                    const state = await readStateYaml(tmp);
                    assert(!state.includes("active_session"), "active_session should be cleared after recover");
                } finally {
                    await bridge2.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    // ── Test 8: blocked → recover → context chain ───────────────────────
    await runCheck({
        name: "blocked → recover → context: full stale recovery chain",
        fn: async () => {
            const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-lc-8-"));
            try {
                await buildFixture(tmp, spec);

                const bridge1 = await startCliBridge(tmp);
                try {
                    await bridge1.callTool("cairn_context", { task: "will become stale" });
                    await bridge1.callTool("cairn_signal", {
                        type: "decision",
                        what: "chain test decision",
                        reason: "test",
                    });
                } finally {
                    await bridge1.close();
                }

                const statePath = join(tmp, ".cairn", "state.yaml");
                const stateRaw = await readFile(statePath, "utf8");
                const stateObj = yamlParse(stateRaw) as Record<string, unknown>;
                const session = stateObj.active_session as Record<string, unknown>;
                session.last_touched_at = "2024-01-01T00:00:00.000Z";
                await writeFile(statePath, yamlStringify(stateObj), "utf8");

                const bridge2 = await startCliBridge(tmp);
                try {
                    const r1 = await bridge2.callTool("cairn_context", { task: "after stale" });
                    const lower1 = r1.text.toLowerCase();
                    assert(lower1.includes("blocked") || lower1.includes("unclosed"), "should be blocked");

                    const r2 = await bridge2.callTool("cairn_session_recover", {});
                    assert(!r2.isError, `recover failed: ${r2.text.slice(0, 200)}`);

                    const r3 = await bridge2.callTool("cairn_context", { task: "fresh start" });
                    assert(!r3.isError, `context after recover failed: ${r3.text.slice(0, 200)}`);
                    assert(r3.text.includes('"status":"active"') || r3.text.includes('"status": "active"'),
                        "should have an active session after recovery");
                } finally {
                    await bridge2.close();
                }
            } finally {
                await rm(tmp, { recursive: true, force: true });
            }
        },
    });

    console.log("");
    console.log(`Total: ${pass + fail}, pass: ${pass}, fail: ${fail}`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error("smoke-lifecycle crashed:", e);
    process.exit(2);
});
