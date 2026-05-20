import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTmpDir, cleanTmpDir, initTestRepo, makeSkeletonNode } from "../test-helpers.js";
import { bootstrapEmpty } from "../../src/bootstrap.js";
import { createContext, ensureCairnDirs, type CairnContext } from "../../src/context.js";
import { handleInitCommit } from "../../src/tools/cairn-init-commit.js";
import { handleContext } from "../../src/tools/cairn-context.js";
import { handleSignal } from "../../src/tools/cairn-signal.js";
import { handleObserve } from "../../src/tools/cairn-observe.js";
import { handleSessionEnd } from "../../src/tools/cairn-session-end.js";
import { handleSessionRecover } from "../../src/tools/cairn-session-recover.js";
import { handlePlan } from "../../src/tools/cairn-plan.js";
import { handleStatus } from "../../src/tools/cairn-status.js";
import { readFile } from "node:fs/promises";

let tmpDir: string;
let ctx: CairnContext;

function parseResult(result: { content: Array<{ type: string; text: string }> }): any {
    return JSON.parse(result.content[0].text);
}

async function setupProject() {
    await bootstrapEmpty(tmpDir);
    ctx = await createContext(tmpDir);
    await ensureCairnDirs(ctx.paths);
    await handleInitCommit(ctx, {
        config: {
            project_name: "guard-test",
            domains: ["api-layer"],
            cognitive_mode: "standard",
        },
        skeleton: [makeSkeletonNode("api-layer")],
        blood_candidates: [],
    });
}

beforeEach(async () => {
    tmpDir = await createTmpDir();
    initTestRepo(tmpDir);
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("Session guard lifecycle", () => {
    it("normal lifecycle: context → signal → observe → session_end", async () => {
        await setupProject();

        const contextResult = parseResult(await handleContext(ctx, { task: "fix API" }));
        expect(contextResult.session.status).toBe("active");

        const session1 = await ctx.stateStore.getActiveSession();
        expect(session1).not.toBeNull();
        expect(session1!.context_loaded).toBe(true);
        expect(session1!.signals_count).toBe(0);

        await handleSignal(ctx, {
            signal_type: "decision",
            domain: "api-layer",
            details: { what: "Use REST over GraphQL" },
            evidence: { user_said: "REST is simpler" },
        });

        const session2 = await ctx.stateStore.getActiveSession();
        expect(session2!.signals_count).toBe(1);

        await handleObserve(ctx, {
            summary: "Decided on REST",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "REST middleware pattern" },
                evidence: {},
                recommendation: "capture",
                recommendation_reason: "architecture decision",
            }],
        });

        const session3 = await ctx.stateStore.getActiveSession();
        expect(session3!.signals_count).toBe(2);

        const endResult = parseResult(await handleSessionEnd(ctx, {
            summary: "Fixed API endpoint, chose REST",
            changed_domains: ["api-layer"],
            decisions_made: ["REST over GraphQL"],
        }));
        expect(endResult.views_regenerated).toBe(true);
        expect(endResult.session.signals_count).toBe(2);

        const sessionAfter = await ctx.stateStore.getActiveSession();
        expect(sessionAfter).toBeNull();

        const records = await ctx.sessionStore.loadAll();
        expect(records.length).toBeGreaterThanOrEqual(1);
    });

    it("guard rejection: plan without context → hard reject", async () => {
        await setupProject();

        const result = await handlePlan(ctx, { task: "redesign auth" });
        expect(result.isError).toBe(true);
        const data = parseResult(result);
        expect(data.error).toBe("context_not_loaded");
    });

    it("degraded signal: signal without context → warning + accepted", async () => {
        await setupProject();

        const result = parseResult(await handleSignal(ctx, {
            signal_type: "decision",
            domain: "api-layer",
            details: { what: "Use middleware pattern" },
            evidence: {},
        }));

        expect(result.accepted).toBe(true);
        expect(result.warning).toBeDefined();

        const session = await ctx.stateStore.getActiveSession();
        expect(session).toBeNull();
    });

    it("stale recovery: context → signal → stale → blocked → recover → context → session_end", { timeout: 15_000 }, async () => {
        await setupProject();

        const ctx1 = parseResult(await handleContext(ctx, { task: "old work" }));
        expect(ctx1.session.status).toBe("active");
        const originalId = ctx1.session.id;

        await handleSignal(ctx, {
            signal_type: "decision",
            domain: "api-layer",
            details: { what: "Use Express" },
            evidence: {},
        });

        const state = await ctx.stateStore.load();
        state.active_session!.last_touched_at = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
        await ctx.stateStore.save(state);

        const blocked = parseResult(await handleContext(ctx, { task: "new work" }));
        expect(blocked.session.status).toBe("blocked_by_unclosed_session");
        expect(blocked.session.recovery_required).toBe(true);
        expect(blocked.session.unclosed_session.signals_count).toBe(1);
        expect(blocked.constraints).toBeUndefined();

        const preserved = await ctx.stateStore.getActiveSession();
        expect(preserved!.id).toBe(originalId);

        const recovered = parseResult(await handleSessionRecover(ctx));
        expect(recovered.recovered).toBe(true);
        expect(recovered.original_session.id).toBe(originalId);

        const cleared = await ctx.stateStore.getActiveSession();
        expect(cleared).toBeNull();

        const ctx2 = parseResult(await handleContext(ctx, { task: "new work" }));
        expect(ctx2.session.status).toBe("active");
        expect(ctx2.session.id).not.toBe(originalId);

        await handleSessionEnd(ctx, { summary: "new work done" });
        const final = await ctx.stateStore.getActiveSession();
        expect(final).toBeNull();
    });

    it("observe lifecycle: context → observe(mixed) → session_end tracks signals", async () => {
        await setupProject();

        await handleContext(ctx, { task: "pre-commit review" });

        await handleObserve(ctx, {
            summary: "Architecture decision and formatting",
            candidates: [
                {
                    signal_type: "decision",
                    domain: "api-layer",
                    details: { what: "Use controller pattern" },
                    evidence: {},
                    recommendation: "capture",
                    recommendation_reason: "architecture",
                },
                {
                    signal_type: "decision",
                    details: { what: "Fixed lint errors" },
                    evidence: {},
                    recommendation: "skip",
                    recommendation_reason: "routine",
                },
            ],
        });

        const session = await ctx.stateStore.getActiveSession();
        expect(session!.signals_count).toBe(1);

        const endResult = parseResult(await handleSessionEnd(ctx, {
            summary: "Pre-commit review done",
        }));
        expect(endResult.session.signals_count).toBe(1);
    });

    it("same-workflow re-call: context → signal → context again → not blocked", async () => {
        await setupProject();

        const ctx1 = parseResult(await handleContext(ctx, { task: "step 1" }));
        const sessionId = ctx1.session.id;

        await handleSignal(ctx, {
            signal_type: "decision",
            domain: "api-layer",
            details: { what: "Use Express" },
            evidence: {},
        });

        const ctx2 = parseResult(await handleContext(ctx, { task: "step 2" }));
        expect(ctx2.session.status).toBe("active");
        expect(ctx2.session.id).toBe(sessionId);

        const session = await ctx.stateStore.getActiveSession();
        expect(session!.task).toBe("step 2");

        await handleSessionEnd(ctx, { summary: "both steps done" });
        expect(await ctx.stateStore.getActiveSession()).toBeNull();
    });

    it("degraded session_end: no context → still completes with warning", async () => {
        await setupProject();

        const result = parseResult(await handleSessionEnd(ctx, {
            summary: "degraded session",
        }));

        expect(result.warning).toBeDefined();
        expect(result.session.context_was_loaded).toBe(false);
        expect(result.views_regenerated).toBe(true);

        expect(await ctx.stateStore.getActiveSession()).toBeNull();
    });

    it("compliance tracking: context → plan → observe → session_end records all flags", async () => {
        await setupProject();

        await handleContext(ctx, { task: "architecture review" });

        const s1 = await ctx.stateStore.getActiveSession();
        expect(s1!.plan_called).toBe(false);
        expect(s1!.observe_called).toBe(false);

        await handlePlan(ctx, { task: "architecture review" });

        const s2 = await ctx.stateStore.getActiveSession();
        expect(s2!.plan_called).toBe(true);

        await handleObserve(ctx, {
            summary: "Reviewed architecture",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "Keep current architecture" },
                evidence: {},
                recommendation: "capture",
                recommendation_reason: "architecture decision",
            }],
        });

        const s3 = await ctx.stateStore.getActiveSession();
        expect(s3!.observe_called).toBe(true);

        await handleSessionEnd(ctx, {
            summary: "Architecture review complete",
            changed_domains: ["api-layer"],
        });

        const records = await ctx.sessionStore.loadAll();
        const record = records[records.length - 1];
        expect(record.compliance).toBeDefined();
        expect(record.compliance!.context_loaded).toBe(true);
        expect(record.compliance!.plan_called).toBe(true);
        expect(record.compliance!.observe_called).toBe(true);
        expect(record.compliance!.signals_count).toBeGreaterThanOrEqual(1);
    });

    it("compliance JSONL: session_end appends to compliance.jsonl", async () => {
        await setupProject();

        await handleContext(ctx, { task: "quick fix" });
        await handleSessionEnd(ctx, { summary: "Quick fix done" });

        const logContent = await readFile(ctx.paths.complianceLog, "utf-8");
        const lines = logContent.trim().split("\n");
        expect(lines.length).toBeGreaterThanOrEqual(1);

        const entry = JSON.parse(lines[lines.length - 1]);
        expect(entry.ts).toBeDefined();
        expect(entry.session).toBeDefined();
        expect(entry.context).toBe(true);
        expect(entry.plan).toBe(false);
        expect(entry.observe).toBe(false);
        expect(typeof entry.duration_min).toBe("number");
    });

    it("cairn_status includes compliance rates from session records", async () => {
        await setupProject();

        await handleContext(ctx, { task: "task 1" });
        await handlePlan(ctx, { task: "task 1" });
        await handleSessionEnd(ctx, { summary: "Task 1 done" });

        const statusResult = parseResult(await handleStatus(ctx));
        expect(statusResult.compliance).toBeDefined();
        expect(statusResult.compliance.sessions_analyzed).toBeGreaterThanOrEqual(1);
        expect(statusResult.compliance.context_rate).toBeDefined();
        expect(statusResult.compliance.plan_rate).toBeDefined();
        expect(statusResult.compliance.observe_rate).toBeDefined();
    });
});
