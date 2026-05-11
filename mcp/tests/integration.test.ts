import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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
import { handleCairnSessionEnd } from "../src/tools/cairn-session-end.js";
import { handleCairnStatus } from "../src/tools/cairn-status.js";
import { handleCairnPlan } from "../src/tools/cairn-plan.js";
import { handleCairnDoctor } from "../src/tools/cairn-doctor.js";
import type { CairnContext } from "../src/server.js";
import type { CairnPaths } from "../src/paths.js";
import type { Config } from "../src/schemas/index.js";

function setupEnv() {
    const root = join(tmpdir(), "cairn-integration-" + Date.now());
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
        paths.signalsDir, paths.stagedDir, paths.memoryDir,
        paths.viewsDir, paths.viewsDomainsDir, paths.sessionsDir,
    ]) {
        mkdirSync(dir, { recursive: true });
    }

    const config: Config = {
        version: "2.0",
        project: { name: "test-integration", created: "2024-01" },
        domains: { locked: ["api-layer", "auth", "database"] },
        trust_policy: {
            L3_auto_write: [
                "source.kind == 'git-revert' AND scope == 'local'",
                "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'",
            ],
            L2_staged: [
                "scope == 'global'",
                "type == 'transition' AND affects_output == true",
            ],
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

    const ctx: CairnContext = {
        paths, memoryStore, signalStore, stagedStore, stateStore,
        viewsEngine, trustRouter, gitEar, stageEngine, memoryEngine,
    };

    return { ctx, root };
}

describe("Integration: Full pipeline signal → route → memory → views → context", () => {
    let ctx: CairnContext;
    let root: string;

    beforeEach(() => {
        const env = setupEnv();
        ctx = env.ctx;
        root = env.root;
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("conversation signal flows through to context", () => {
        // Step 1: Initial context is empty
        const context1 = JSON.parse(
            handleCairnContext(ctx, {}).content[0].text,
        );
        expect(context1.no_go).toHaveLength(0);

        // Step 2: Send a user-rejection signal (local scope → L1)
        const signalResult = JSON.parse(
            handleCairnSignal(ctx, {
                type: "user-rejection",
                domain: "api-layer",
                details: {
                    what: "GraphQL migration",
                    reason: "Too complex for small team",
                    rejected_alternatives: ["GraphQL", "gRPC"],
                },
                evidence: { user_said: "We tried GraphQL, way too complex" },
            }).content[0].text,
        );
        expect(signalResult.accepted).toBe(true);

        // Step 3: Send another signal for same subject to build up L1
        handleCairnSignal(ctx, {
            type: "user-rejection",
            domain: "api-layer",
            details: { what: "GraphQL APIs" },
            evidence: {},
        });

        // Step 4: Status should show signals
        const status = JSON.parse(
            handleCairnStatus(ctx).content[0].text,
        );
        expect(status.memory_count + status.signals_count + status.staged_count).toBeGreaterThan(0);
    });

    it("staged entry review cycle", () => {
        // Send global constraint → L2 staged
        handleCairnSignal(ctx, {
            type: "user-constraint",
            domain: "architecture",
            details: { what: "No microservices" },
            evidence: { user_said: "We stay monolithic" },
        });

        // Verify it's in staged
        const pending = ctx.stagedStore.loadPending();
        expect(pending.length).toBeGreaterThan(0);

        // Accept the staged entry
        const staged = pending[0];
        const memory = ctx.stagedStore.accept(staged.id);
        expect(memory).not.toBeNull();

        // Write to memory
        ctx.memoryEngine.write(memory!);

        // Verify views updated
        const outputContent = readFileSync(
            join(ctx.paths.viewsDir, "output.md"),
            "utf-8",
        );
        expect(outputContent).toContain("no-go");

        // Verify context now has constraint
        const context = JSON.parse(
            handleCairnContext(ctx, {}).content[0].text,
        );
        expect(context.no_go.length).toBeGreaterThan(0);
    });

    it("session_end processes and records", () => {
        // Send some signals
        handleCairnSignal(ctx, {
            type: "decision",
            domain: "database",
            details: { what: "Chose PostgreSQL" },
            evidence: {},
        });

        // End session
        const endResult = JSON.parse(
            handleCairnSessionEnd(ctx, {
                summary: "Set up database layer",
                changed_domains: ["database"],
                decisions_made: ["Chose PostgreSQL"],
            }).content[0].text,
        );
        expect(endResult.views_regenerated).toBe(true);

        // Verify session record exists
        const sessionFiles = require("fs")
            .readdirSync(ctx.paths.sessionsDir)
            .filter((f: string) => f.endsWith(".yaml"));
        expect(sessionFiles.length).toBe(1);
    });

    it("cairn_plan is read-only", () => {
        // Add some memory
        ctx.memoryStore.save({
            id: "mem_rest",
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
            subject: { name: "REST" },
            summary: "Chose REST for API",
            behavior_effect: { type: "prefer_approach", instruction: "Use REST" },
            revisit: { when: [], status: "not_met" },
            relations: { related: [], conflicts: [] },
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        });

        const memCount = ctx.memoryStore.loadAll().length;
        const sigCount = ctx.signalStore.loadAll().length;
        const stagedCount = ctx.stagedStore.loadAll().length;

        // Call plan
        const planResult = JSON.parse(
            handleCairnPlan(ctx, { task: "Add API endpoint" }).content[0].text,
        );
        expect(planResult.task).toBe("Add API endpoint");

        // Verify NO side effects
        expect(ctx.memoryStore.loadAll().length).toBe(memCount);
        expect(ctx.signalStore.loadAll().length).toBe(sigCount);
        expect(ctx.stagedStore.loadAll().length).toBe(stagedCount);
    });

    it("doctor detects issues after operations", () => {
        ctx.viewsEngine.regenerate();

        // Add a memory with TODO
        ctx.memoryStore.save({
            id: "mem_todo",
            type: "rejection",
            domain: "api-layer",
            scope: "local",
            status: "active",
            health: { state: "ok", reason: null },
            confidence: { level: "medium" },
            source: {
                kind: "conversation",
                refs: [],
                captured_at: "2026-01-01T00:00:00Z",
            },
            subject: { name: "gRPC" },
            summary: "[TODO] fill in rejection details",
            behavior_effect: { type: "avoid_suggestion", instruction: "Don't use gRPC" },
            revisit: { when: [], status: "not_met" },
            relations: { related: [], conflicts: [] },
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        });

        const doctor = JSON.parse(
            handleCairnDoctor(ctx).content[0].text,
        );
        expect(doctor.todos_in_memory).toBe(1);
        expect(doctor.orphan_no_go).toContain("mem_todo");
    });

    it("empty project has correct defaults", () => {
        ctx.viewsEngine.regenerate();

        const context = JSON.parse(
            handleCairnContext(ctx, {}).content[0].text,
        );
        expect(context.stage.phase).toBe("growth");
        expect(context.stage.status).toBe("advisory");
        expect(context.no_go).toEqual([]);

        const status = JSON.parse(
            handleCairnStatus(ctx).content[0].text,
        );
        expect(status.memory_count).toBe(0);
        expect(status.staged_count).toBe(0);

        const doctor = JSON.parse(
            handleCairnDoctor(ctx).content[0].text,
        );
        expect(doctor.output_tokens.status).toBe("ok");
    });
});
