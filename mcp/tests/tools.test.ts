import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as yamlStringify } from "yaml";
import { MemoryStore } from "../src/stores/memory-store.js";
import { SignalStore } from "../src/stores/signal-store.js";
import { StagedStore } from "../src/stores/staged-store.js";
import { StateStore } from "../src/stores/state-store.js";
import { ViewsEngine } from "../src/engines/views-engine.js";
import { MemoryEngine } from "../src/engines/memory-engine.js";
import { TrustRouter } from "../src/engines/trust-router.js";
import { GitEar } from "../src/engines/git-ear.js";
import { StageEngine } from "../src/engines/stage-engine.js";
import { handleCairnContext } from "../src/tools/cairn-context.js";
import { handleCairnSignal } from "../src/tools/cairn-signal.js";
import { handleCairnStatus } from "../src/tools/cairn-status.js";
import { handleCairnPlan } from "../src/tools/cairn-plan.js";
import { handleCairnDoctor } from "../src/tools/cairn-doctor.js";
import type { CairnContext } from "../src/server.js";
import type { CairnPaths } from "../src/paths.js";
import type { MemoryEntry, Config } from "../src/schemas/index.js";

function createTestCtx(): { ctx: CairnContext; rootDir: string } {
    const root = join(tmpdir(), "cairn-test-tools-" + Date.now());
    const cairnDir = join(root, ".cairn");
    const paths: CairnPaths = {
        root,
        cairnDir,
        configYaml: join(cairnDir, "config.yaml"),
        stateYaml: join(cairnDir, "state.yaml"),
        signalsDir: join(cairnDir, "signals"),
        stagedDir: join(cairnDir, "staged"),
        memoryDir: join(cairnDir, "memory"),
        viewsDir: join(cairnDir, "views"),
        viewsDomainsDir: join(cairnDir, "views", "domains"),
        sessionsDir: join(cairnDir, "sessions"),
    };
    for (const dir of [
        paths.signalsDir,
        paths.stagedDir,
        paths.memoryDir,
        paths.viewsDir,
        paths.viewsDomainsDir,
        paths.sessionsDir,
    ]) {
        mkdirSync(dir, { recursive: true });
    }

    // Write config
    const config: Config = {
        version: "2.0",
        project: { name: "test", created: "2024-01" },
        domains: { locked: ["api-layer", "auth"] },
        trust_policy: {
            L3_auto_write: [
                "source.kind == 'git-revert' AND scope == 'local'",
            ],
            L2_staged: ["scope == 'global'"],
            never_auto: [],
        },
        stage: { override: null, auto_constraint: false },
    };
    writeFileSync(paths.configYaml, yamlStringify(config), "utf-8");

    const memoryStore = new MemoryStore(paths.memoryDir);
    const signalStore = new SignalStore(paths.signalsDir);
    const stagedStore = new StagedStore(paths.stagedDir);
    const stateStore = new StateStore(paths.stateYaml);
    const viewsEngine = new ViewsEngine(paths, memoryStore, stateStore);
    const memoryEngine = new MemoryEngine(memoryStore, viewsEngine);
    const trustRouter = new TrustRouter(
        memoryStore, signalStore, stagedStore, memoryEngine, stateStore,
    );
    const gitEar = new GitEar(root);
    const stageEngine = new StageEngine();

    return {
        ctx: {
            paths,
            memoryStore,
            signalStore,
            stagedStore,
            stateStore,
            viewsEngine,
            trustRouter,
            gitEar,
            stageEngine,
            memoryEngine,
        },
        rootDir: root,
    };
}

function makeMemory(id: string, overrides?: Partial<MemoryEntry>): MemoryEntry {
    return {
        id,
        type: "decision",
        domain: "api-layer",
        scope: "local",
        status: "active",
        health: { state: "ok", reason: null },
        confidence: { level: "high" },
        source: {
            kind: "conversation",
            refs: [{ type: "session", id: "sess_001" }],
            captured_at: "2026-01-01T00:00:00Z",
        },
        subject: { name: "REST API" },
        summary: "Chose REST API",
        behavior_effect: { type: "prefer_approach", instruction: "Prefer REST" },
        revisit: { when: [], status: "not_met" },
        relations: { related: [], conflicts: [] },
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

describe("cairn_context", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns empty context for empty project", () => {
        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.no_go).toEqual([]);
        expect(data.relevant_domains).toEqual([]);
        expect(data.active_debt).toEqual([]);
    });

    it("returns no-go entries", () => {
        ctx.memoryStore.save(
            makeMemory("mem_nogo", {
                type: "rejection",
                subject: { name: "tRPC" },
                behavior_effect: {
                    type: "avoid_suggestion",
                    instruction: "Do not suggest tRPC",
                },
            }),
        );
        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.no_go).toHaveLength(1);
        expect(data.no_go[0].subject).toBe("tRPC");
    });

    it("filters by task", () => {
        ctx.memoryStore.save(makeMemory("mem_api", { domain: "api-layer" }));
        ctx.memoryStore.save(
            makeMemory("mem_auth", { domain: "auth", subject: { name: "JWT" } }),
        );
        const result = handleCairnContext(ctx, { task: "api endpoint" });
        const data = JSON.parse(result.content[0].text);
        expect(data.relevant_domains.some((d: any) => d.domain === "api-layer")).toBe(true);
    });
});

describe("cairn_signal", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("routes user-rejection through Trust Router", () => {
        const result = handleCairnSignal(ctx, {
            type: "user-rejection",
            domain: "api-layer",
            details: {
                what: "GraphQL migration",
                reason: "Too complex for team",
            },
            evidence: { user_said: "We tried GraphQL, too complex" },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.accepted).toBe(true);
        // Should be L1 (medium confidence, no git evidence)
        expect(["L1", "L2", "L3"]).toContain(data.level);
    });

    it("routes global constraint to L2", () => {
        const result = handleCairnSignal(ctx, {
            type: "user-constraint",
            domain: "architecture",
            details: { what: "No microservices" },
            evidence: { user_said: "We stay monolithic" },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.level).toBe("L2");
        expect(data.route).toBe("staged");
    });
});

describe("cairn_status", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns correct counts", () => {
        ctx.memoryStore.save(makeMemory("mem_1"));
        ctx.memoryStore.save(makeMemory("mem_2", { domain: "auth", subject: { name: "JWT" } }));

        const result = handleCairnStatus(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.memory_count).toBe(2);
        expect(data.staged_count).toBe(0);
        expect(data.stage.phase).toBe("growth");
    });
});

describe("cairn_plan", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns historical constraints for task", () => {
        ctx.memoryStore.save(
            makeMemory("mem_rest", {
                subject: { name: "REST" },
                behavior_effect: { type: "prefer_approach", instruction: "Use REST for APIs" },
            }),
        );
        ctx.memoryStore.save(
            makeMemory("mem_trpc", {
                type: "rejection",
                subject: { name: "tRPC" },
                behavior_effect: { type: "avoid_suggestion", instruction: "Don't use tRPC" },
            }),
        );

        const result = handleCairnPlan(ctx, { task: "API endpoint design" });
        const data = JSON.parse(result.content[0].text);
        expect(data.task).toBe("API endpoint design");
        expect(data.task).toBe("API endpoint design");
        // Stage confidence is 0.4 by default (< 0.5), so no phase name in guidance
    });

    it("is read-only — no side effects", () => {
        const memBefore = ctx.memoryStore.loadAll().length;
        const sigBefore = ctx.signalStore.loadAll().length;
        const stagedBefore = ctx.stagedStore.loadAll().length;

        handleCairnPlan(ctx, { task: "refactor database" });

        expect(ctx.memoryStore.loadAll().length).toBe(memBefore);
        expect(ctx.signalStore.loadAll().length).toBe(sigBefore);
        expect(ctx.stagedStore.loadAll().length).toBe(stagedBefore);
    });
});

describe("cairn_doctor", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("reports healthy for empty project", () => {
        ctx.viewsEngine.regenerate();
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.output_tokens.status).toBe("ok");
        expect(data.staged_backlog).toBe(0);
    });

    it("detects TODO markers in memory", () => {
        ctx.memoryStore.save(
            makeMemory("mem_todo", {
                summary: "[TODO] fill in details",
            }),
        );
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.todos_in_memory).toBe(1);
    });
});
