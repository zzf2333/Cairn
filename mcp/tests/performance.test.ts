import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync } from "node:fs";
import { createTestEnv, makeMemory, makeSignal, defaultConfig } from "./test-helpers.js";
import type { CairnContext } from "../src/server.js";

describe("Performance: MemoryStore", () => {
    let ctx: CairnContext;
    let root: string;

    beforeEach(() => {
        const env = createTestEnv();
        ctx = env.ctx;
        root = env.root;
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("loadAll handles 200 entries within 2s", () => {
        for (let i = 0; i < 200; i++) {
            ctx.memoryStore.save(makeMemory(`mem_perf_${i}`, {
                domain: `domain-${i % 10}`,
                subject: { name: `subject-${i}` },
            }));
        }

        const start = performance.now();
        const entries = ctx.memoryStore.loadAll();
        const elapsed = performance.now() - start;

        expect(entries).toHaveLength(200);
        expect(elapsed).toBeLessThan(2000);
    });

    it("findDuplicate searches 200 entries within 3s", () => {
        for (let i = 0; i < 200; i++) {
            ctx.memoryStore.save(makeMemory(`mem_dup_${i}`, {
                domain: `domain-${i % 10}`,
                subject: { name: `subject-${i}` },
            }));
        }

        const start = performance.now();
        for (let i = 0; i < 20; i++) {
            ctx.memoryStore.findDuplicate(`domain-${i % 10}`, `subject-${i}`, "decision");
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(3000);
    });

    it("findConflicts scales with 200 entries within 2s", () => {
        for (let i = 0; i < 200; i++) {
            ctx.memoryStore.save(makeMemory(`mem_conf_${i}`, {
                domain: `domain-${i % 5}`,
                subject: { name: `subject-${i % 20}` },
                health: { state: i % 10 === 0 ? "conflicted" : "ok", reason: null },
            }));
        }

        const start = performance.now();
        const conflicts = ctx.memoryStore.findConflicts();
        const elapsed = performance.now() - start;

        expect(conflicts.length).toBe(20);
        expect(elapsed).toBeLessThan(2000);
    });
});

describe("Performance: ViewsEngine", () => {
    let ctx: CairnContext;
    let root: string;

    beforeEach(() => {
        const env = createTestEnv();
        ctx = env.ctx;
        root = env.root;
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("regenerate handles 200 entries within 2s", () => {
        for (let i = 0; i < 200; i++) {
            ctx.memoryStore.save(makeMemory(`mem_view_${i}`, {
                domain: `domain-${i % 10}`,
                subject: { name: `subject-${i}` },
                type: i % 5 === 0 ? "rejection" : "decision",
                behavior_effect: {
                    type: i % 5 === 0 ? "avoid_suggestion" : "prefer_approach",
                    instruction: `instruction-${i}`,
                },
            }));
        }

        const start = performance.now();
        ctx.viewsEngine.regenerate();
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(2000);
    });

    it("5 consecutive regenerates within 3s", () => {
        for (let i = 0; i < 100; i++) {
            ctx.memoryStore.save(makeMemory(`mem_regen_${i}`, {
                domain: `domain-${i % 5}`,
                subject: { name: `subject-${i}` },
            }));
        }

        const start = performance.now();
        for (let i = 0; i < 5; i++) {
            ctx.viewsEngine.regenerate();
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(3000);
    });
});

describe("Performance: TrustRouter", () => {
    let ctx: CairnContext;
    let root: string;

    beforeEach(() => {
        const env = createTestEnv();
        ctx = env.ctx;
        root = env.root;
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("route with 200 existing memories within 2s", () => {
        for (let i = 0; i < 200; i++) {
            ctx.memoryStore.save(makeMemory(`mem_route_${i}`, {
                domain: `domain-${i % 10}`,
                subject: { name: `subject-${i}` },
            }));
        }

        const signal = makeSignal("sig_perf", {
            source_ear: "conversation",
            signal_type: "decision",
            raw_data: { what: "new decision", subject: "unique-subject-999" },
            inferred: { probable_type: "decision", probable_domain: "domain-0", confidence: "medium" },
        });

        const start = performance.now();
        const result = ctx.trustRouter.route(signal, defaultConfig);
        const elapsed = performance.now() - start;

        expect(result.level).toBeDefined();
        expect(elapsed).toBeLessThan(2000);
    });

    it("10 sequential signals complete within 5s", () => {
        const start = performance.now();
        for (let i = 0; i < 10; i++) {
            const signal = makeSignal(`sig_seq_${i}`, {
                source_ear: "conversation",
                signal_type: "decision",
                raw_data: { what: `decision-${i}`, subject: `unique-${i}` },
                inferred: { probable_type: "decision", probable_domain: `domain-${i % 3}`, confidence: "medium" },
            });
            ctx.trustRouter.route(signal, defaultConfig);
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(5000);
    });
});

describe("Performance: Full pipeline", () => {
    let ctx: CairnContext;
    let root: string;

    beforeEach(() => {
        const env = createTestEnv();
        ctx = env.ctx;
        root = env.root;
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("signal → memory → regenerate x20 within 10s", () => {
        const start = performance.now();
        for (let i = 0; i < 20; i++) {
            const signal = makeSignal(`sig_pipe_${i}`, {
                source_ear: "conversation",
                signal_type: "decision",
                raw_data: { what: `pipeline-decision-${i}`, subject: `pipe-subject-${i}` },
                inferred: { probable_type: "decision", probable_domain: `domain-${i % 5}`, confidence: "medium" },
            });
            ctx.trustRouter.route(signal, defaultConfig);
        }
        const elapsed = performance.now() - start;

        expect(ctx.memoryStore.loadAll().length).toBe(20);
        expect(elapsed).toBeLessThan(10000);
    });
});
