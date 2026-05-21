import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeSkeletonNode,
} from "../test-helpers.js";
import { createContext } from "../../src/context.js";
import { ensureCairnDirs } from "../../src/context.js";

const SCALES = [100, 1000] as const;

interface Bench {
    scale: number;
    activate_p50_ms: number;
    activate_p99_ms: number;
    session_end_ms: number;
}

function percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return sorted[idx];
}

async function setupScale(scale: number): Promise<{ root: string; ctx: Awaited<ReturnType<typeof createContext>> }> {
    const root = await createTmpDir();
    const ctx = await createContext(root);
    await ensureCairnDirs(ctx.paths);

    await ctx.configStore.save({
        project_name: "bench",
        domains: ["api-layer", "auth", "data", "infra", "ui"],
        cognitive_mode: "standard",
    });

    for (const d of ["api-layer", "auth", "data", "infra", "ui"]) {
        await ctx.skeletonStore.save(makeSkeletonNode(d, { causal_keywords: [d] }));
    }

    const domains = ["api-layer", "auth", "data", "infra", "ui"];
    const writes: Promise<void>[] = [];
    for (let i = 0; i < scale; i++) {
        const domain = domains[i % domains.length];
        writes.push(ctx.bloodStore.save(makeEvolutionEvent(`evt_bench_${i}`, {
            domain,
            subject: { name: `subject-${i}` },
        })));
        if (writes.length >= 200) {
            await Promise.all(writes);
            writes.length = 0;
        }
    }
    await Promise.all(writes);

    return { root, ctx };
}

const results: Bench[] = [];

describe.sequential("Benchmark (SLO: activate p99 ≤ 500ms with cache, session_end ≤ 5s)", () => {
    for (const scale of SCALES) {
        it(`scale=${scale}`, { timeout: 120_000 }, async () => {
            const { root, ctx } = await setupScale(scale);
            try {
                await ctx.activationEngine.activate({ task: "fix api endpoint" });

                const activations: number[] = [];
                for (let i = 0; i < 20; i++) {
                    const start = performance.now();
                    await ctx.activationEngine.activate({ task: "fix api endpoint" });
                    activations.push(performance.now() - start);
                }
                const p50 = percentile(activations, 0.5);
                const p99 = percentile(activations, 0.99);

                const start = performance.now();
                const result = await import("../../src/tools/cairn-session-end.js");
                await result.handleSessionEnd(ctx, { summary: "bench" });
                const sessionEndMs = performance.now() - start;

                results.push({ scale, activate_p50_ms: p50, activate_p99_ms: p99, session_end_ms: sessionEndMs });

                expect(p99, `activate p99 at scale=${scale} should be ≤ 500ms (BloodStore cache amortizes loadAll)`).toBeLessThan(500);
                expect(sessionEndMs, `session_end at scale=${scale} should be ≤ 5000ms`).toBeLessThan(5000);
            } finally {
                await cleanTmpDir(root);
            }
        });
    }

    it("emits benchmark table", () => {
        console.log("\n=== Cairn benchmark ===");
        console.log("scale | activate p50 | activate p99 | session_end");
        console.log("------|--------------|--------------|------------");
        for (const r of results) {
            console.log(
                `${String(r.scale).padStart(5)} | ${r.activate_p50_ms.toFixed(1).padStart(12)}ms | ${r.activate_p99_ms.toFixed(1).padStart(12)}ms | ${r.session_end_ms.toFixed(1).padStart(10)}ms`
            );
        }
        console.log("");
        // No assertion — this is a reporter step.
        expect(results.length).toBe(SCALES.length);
    });
});
