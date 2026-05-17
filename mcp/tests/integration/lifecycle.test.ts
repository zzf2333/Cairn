import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createTmpDir, cleanTmpDir, makeConfig, makeState, initTestRepo } from "../test-helpers.js";
import { buildPaths, ALL_DIRS } from "../../src/paths.js";
import { bootstrapEmpty } from "../../src/bootstrap.js";
import { createContext, ensureCairnDirs, type CairnContext } from "../../src/context.js";
import { handleInitStatus } from "../../src/tools/cairn-init-status.js";
import { handleInitCommit } from "../../src/tools/cairn-init-commit.js";
import { handleContext } from "../../src/tools/cairn-context.js";
import { handleSignal } from "../../src/tools/cairn-signal.js";
import { handleSessionEnd } from "../../src/tools/cairn-session-end.js";
import { handleStatus } from "../../src/tools/cairn-status.js";
import { handleDoctor } from "../../src/tools/cairn-doctor.js";

let tmpDir: string;
let ctx: CairnContext;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    initTestRepo(tmpDir);
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
    return JSON.parse(result.content[0].text);
}

describe("Full lifecycle integration", () => {
    it("bootstrapEmpty creates .cairn structure", async () => {
        await bootstrapEmpty(tmpDir);
        const paths = buildPaths(tmpDir);
        const cairnStat = await stat(paths.cairn);
        expect(cairnStat.isDirectory()).toBe(true);

        const configStat = await stat(paths.config);
        expect(configStat.isFile()).toBe(true);
    });

    it("cairn_init_status reports not_initialized before init", async () => {
        await bootstrapEmpty(tmpDir);
        ctx = await createContext(tmpDir);
        await ensureCairnDirs(ctx.paths);

        const result = parseResult(await handleInitStatus(ctx)) as {
            status: string;
            has_cairn_dir: boolean;
        };
        expect(result.status).toBe("not_initialized");
        expect(result.has_cairn_dir).toBe(true);
    });

    it("cairn_init_commit writes blood, skeleton, and config", async () => {
        await bootstrapEmpty(tmpDir);
        ctx = await createContext(tmpDir);
        await ensureCairnDirs(ctx.paths);

        const initResult = parseResult(await handleInitCommit(ctx, {
            config: {
                project_name: "lifecycle-test",
                domains: ["api-layer", "auth"],
                cognitive_mode: "standard",
            },
            skeleton: [
                {
                    domain: "api-layer",
                    role: "REST API layer",
                    owns: ["routes", "controllers"],
                    does_not_own: ["auth"],
                    causal_keywords: ["api", "REST", "endpoint"],
                },
                {
                    domain: "auth",
                    role: "Authentication module",
                    owns: ["login", "session"],
                    does_not_own: ["routes"],
                    causal_keywords: ["auth", "login", "session"],
                },
            ],
            blood_candidates: [
                {
                    type: "rejection",
                    domain: "api-layer",
                    gravity: { level: "G1" },
                    summary: "no tRPC",
                    behavior_effect: { type: "avoid_suggestion", instruction: "do not use tRPC" },
                    source: { type: "conversation", confidence: 0.9 },
                    lifecycle: { validity: "strategic" },
                },
            ],
            stage: {
                phase: "growth",
                confidence: 0.8,
                evidence: ["6 months old", "active development"],
            },
        })) as {
            created: boolean;
            written: { skeleton: number; blood_auto_confirmed: number; blood_staged: number };
            pending_review: number;
            initialization_status: string;
        };

        expect(initResult.created).toBe(true);
        expect(initResult.written.skeleton).toBe(2);
        expect(initResult.written.blood_auto_confirmed + initResult.written.blood_staged).toBe(1);

        const config = await ctx.configStore.load();
        expect(config).not.toBeNull();
        expect(config!.project.name).toBe("lifecycle-test");

        const skeletonNodes = await ctx.skeletonStore.loadAll();
        expect(skeletonNodes.length).toBe(2);

        const state = await ctx.stateStore.load();
        expect(state.initialization_status).toBe("complete");
    });

    it("cairn_context activates relevant domains", async () => {
        await bootstrapEmpty(tmpDir);
        ctx = await createContext(tmpDir);
        await ensureCairnDirs(ctx.paths);

        await handleInitCommit(ctx, {
            config: {
                project_name: "lifecycle-test",
                domains: ["api-layer", "auth"],
                cognitive_mode: "standard",
            },
            skeleton: [
                {
                    domain: "api-layer",
                    role: "REST API layer",
                    owns: ["routes"],
                    does_not_own: [],
                    causal_keywords: ["api", "REST", "endpoint"],
                },
                {
                    domain: "auth",
                    role: "Auth module",
                    owns: ["login"],
                    does_not_own: [],
                    causal_keywords: ["auth", "login"],
                },
            ],
            blood_candidates: [],
        });

        const contextResult = parseResult(await handleContext(ctx, {
            task: "fix the API endpoint",
        })) as {
            relevant_domains: Array<{ domain: string }>;
            meta: { skeleton_nodes_activated: string[] };
        };

        expect(contextResult.meta.skeleton_nodes_activated).toContain("api-layer");
        expect(contextResult.relevant_domains.length).toBeGreaterThanOrEqual(1);
    });

    it("cairn_signal routes a user_rejection event", async () => {
        await bootstrapEmpty(tmpDir);
        ctx = await createContext(tmpDir);
        await ensureCairnDirs(ctx.paths);

        await handleInitCommit(ctx, {
            config: {
                project_name: "lifecycle-test",
                domains: ["api-layer"],
                cognitive_mode: "standard",
            },
            skeleton: [
                {
                    domain: "api-layer",
                    role: "REST API layer",
                    owns: ["routes"],
                    does_not_own: [],
                    causal_keywords: ["api"],
                },
            ],
            blood_candidates: [],
        });

        const signalResult = parseResult(await handleSignal(ctx, {
            signal_type: "user_rejection",
            domain: "api-layer",
            details: {
                what: "GraphQL",
                reason: "too complex for our use case",
            },
            evidence: {
                user_said: "I don't want GraphQL",
            },
        })) as {
            accepted: boolean;
            routing: { destination: string };
        };

        expect(signalResult.accepted).toBe(true);
        const dest = signalResult.routing.destination;
        expect(["blood", "staged"]).toContain(dest);
    });

    it("cairn_session_end creates session record and updates state", async () => {
        await bootstrapEmpty(tmpDir);
        ctx = await createContext(tmpDir);
        await ensureCairnDirs(ctx.paths);

        await handleInitCommit(ctx, {
            config: {
                project_name: "lifecycle-test",
                domains: ["api-layer"],
                cognitive_mode: "standard",
            },
            skeleton: [
                {
                    domain: "api-layer",
                    role: "REST API layer",
                    owns: ["routes"],
                    does_not_own: [],
                    causal_keywords: ["api"],
                },
            ],
            blood_candidates: [],
        });

        const sessionResult = parseResult(await handleSessionEnd(ctx, {
            summary: "worked on API endpoints",
            changed_domains: ["api-layer"],
            decisions_made: ["chose REST over GraphQL"],
        })) as {
            views_regenerated: boolean;
            pending_review: number;
        };

        expect(sessionResult.views_regenerated).toBe(true);

        const state = await ctx.stateStore.load();
        expect(state.last_session.ended_at).not.toBeNull();
    });

    it("cairn_status reports correct counts", async () => {
        await bootstrapEmpty(tmpDir);
        ctx = await createContext(tmpDir);
        await ensureCairnDirs(ctx.paths);

        await handleInitCommit(ctx, {
            config: {
                project_name: "lifecycle-test",
                domains: ["api-layer"],
                cognitive_mode: "standard",
            },
            skeleton: [
                {
                    domain: "api-layer",
                    role: "REST API layer",
                    owns: ["routes"],
                    does_not_own: [],
                    causal_keywords: ["api"],
                },
            ],
            blood_candidates: [
                {
                    type: "rejection",
                    domain: "api-layer",
                    gravity: { level: "G1" },
                    summary: "no tRPC",
                    behavior_effect: { type: "avoid_suggestion", instruction: "do not use tRPC" },
                    source: { type: "conversation", confidence: 0.9 },
                    lifecycle: { validity: "strategic" },
                },
            ],
        });

        const statusResult = parseResult(await handleStatus(ctx)) as {
            initialization: string;
            blood: { total: number };
            skeleton: { nodes: number };
        };

        expect(statusResult.initialization).toBe("complete");
        expect(statusResult.skeleton.nodes).toBe(1);
        expect(statusResult.blood.total + (statusResult as any).staged.total).toBeGreaterThanOrEqual(1);
    });

    it("cairn_doctor runs consistency check", async () => {
        await bootstrapEmpty(tmpDir);
        ctx = await createContext(tmpDir);
        await ensureCairnDirs(ctx.paths);

        await handleInitCommit(ctx, {
            config: {
                project_name: "lifecycle-test",
                domains: ["api-layer"],
                cognitive_mode: "standard",
            },
            skeleton: [
                {
                    domain: "api-layer",
                    role: "REST API layer",
                    owns: ["routes"],
                    does_not_own: [],
                    causal_keywords: ["api"],
                },
            ],
            blood_candidates: [],
        });

        const doctorResult = parseResult(await handleDoctor(ctx)) as {
            consistency: { overall: string };
            cognitive_mode: string;
            issues_count: number;
        };

        expect(doctorResult.consistency.overall).toBe("consistent");
        expect(doctorResult.cognitive_mode).toBe("standard");
        expect(typeof doctorResult.issues_count).toBe("number");
    });
});
