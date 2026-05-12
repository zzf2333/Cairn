import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    mkdirSync, rmSync, writeFileSync, readdirSync,
} from "node:fs";
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
import { handleCairnSessionEnd } from "../src/tools/cairn-session-end.js";
import { runStartupGitScan } from "../src/server.js";
import type { CairnContext } from "../src/server.js";
import type { CairnPaths } from "../src/paths.js";
import type { Config } from "../src/schemas/index.js";
import type { Signal } from "../src/schemas/signal.js";

function createMockGitEar(signals: Signal[] = [], head: string | null = "abc123") {
    return {
        scanSinceLastSession: async () => signals,
        getHeadCommit: async () => head,
    } as unknown as GitEar;
}

function setupEnv(mockGitEar?: GitEar) {
    const root = join(tmpdir(), "cairn-scan-" + Date.now());
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
        project: { name: "test-scan", created: "2024-01" },
        domains: { locked: ["api-layer"] },
        trust_policy: {
            L3_auto_write: [
                "source.kind == 'git-revert' AND scope == 'local'",
            ],
            L2_staged: [],
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
    const gitEar = mockGitEar ?? createMockGitEar();
    const stageEngine = new StageEngine();

    const ctx: CairnContext = {
        paths, memoryStore, signalStore, stagedStore, stateStore,
        viewsEngine, trustRouter, gitEar, stageEngine, memoryEngine,
    };

    return { ctx, root };
}

function makeRevertSignal(): Signal {
    return {
        id: "sig_git_revert_test1",
        source_ear: "git",
        signal_type: "revert",
        raw_data: {
            commit: "abc123",
            message: "Revert tRPC migration",
            subject: "tRPC",
            scope: "local",
        },
        inferred: {
            probable_type: "rejection",
            probable_domain: "api-layer",
            confidence: "high",
        },
        captured_at: new Date().toISOString(),
    };
}

describe("Startup Git Scan", () => {
    let root: string;

    afterEach(() => {
        if (root) rmSync(root, { recursive: true, force: true });
    });

    it("routes git signals and updates checkpoint", async () => {
        const mock = createMockGitEar([makeRevertSignal()], "def456");
        const { ctx, root: r } = setupEnv(mock);
        root = r;

        await runStartupGitScan(ctx);

        const state = ctx.stateStore.load();
        expect(state.last_session_commit).toBe("def456");

        const memories = ctx.memoryStore.loadAll();
        expect(memories.length).toBeGreaterThanOrEqual(1);
    });

    it("updates checkpoint even with no signals", async () => {
        const mock = createMockGitEar([], "head789");
        const { ctx, root: r } = setupEnv(mock);
        root = r;

        await runStartupGitScan(ctx);

        const state = ctx.stateStore.load();
        expect(state.last_session_commit).toBe("head789");
    });

    it("does not crash when git fails", async () => {
        const mock = {
            scanSinceLastSession: async () => { throw new Error("git not found"); },
            getHeadCommit: async () => null,
        } as unknown as GitEar;

        const { ctx, root: r } = setupEnv(mock);
        root = r;

        await expect(runStartupGitScan(ctx)).resolves.toBeUndefined();
    });

    it("uses default config when config file missing", async () => {
        const mock = createMockGitEar([makeRevertSignal()], "cfg123");
        const { ctx, root: r } = setupEnv(mock);
        root = r;

        rmSync(ctx.paths.configYaml);

        await expect(runStartupGitScan(ctx)).resolves.toBeUndefined();

        const state = ctx.stateStore.load();
        expect(state.last_session_commit).toBe("cfg123");
    });
});

describe("Session end updates commit checkpoint", () => {
    let root: string;

    afterEach(() => {
        if (root) rmSync(root, { recursive: true, force: true });
    });

    it("sets last_session_commit to HEAD after session end", async () => {
        const mock = createMockGitEar([], "sess_head_abc");
        const { ctx, root: r } = setupEnv(mock);
        root = r;

        await handleCairnSessionEnd(ctx, {
            summary: "test session",
        });

        const state = ctx.stateStore.load();
        expect(state.last_session_commit).toBe("sess_head_abc");
        expect(state.last_session_at).toBeTruthy();
    });
});
