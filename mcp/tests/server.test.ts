import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as yamlStringify } from "yaml";
import {
    createCairnContext,
    createCairnServer,
    runStartupGitScan,
} from "../src/server.js";
import { createTestEnv, createMockGitEar, makeSignal } from "./test-helpers.js";
import type { Config } from "../src/schemas/index.js";

describe("createCairnServer", () => {
    let root: string;

    beforeEach(() => {
        root = join(tmpdir(), "cairn-server-" + Date.now());
        const cairnDir = join(root, ".cairn");
        mkdirSync(cairnDir, { recursive: true });
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("returns server and runStartupScan function", () => {
        const result = createCairnServer(root);
        expect(result).toHaveProperty("server");
        expect(result).toHaveProperty("runStartupScan");
        expect(typeof result.runStartupScan).toBe("function");
    });

    it("server has expected type", () => {
        const { server } = createCairnServer(root);
        expect(server).toHaveProperty("connect");
        expect(typeof server.connect).toBe("function");
    });
});

describe("createCairnContext", () => {
    let root: string;

    beforeEach(() => {
        root = join(tmpdir(), "cairn-ctx-" + Date.now());
    });
    afterEach(() => {
        if (root) rmSync(root, { recursive: true, force: true });
    });

    it("creates context with all stores and engines", () => {
        const cairnDir = join(root, ".cairn");
        mkdirSync(cairnDir, { recursive: true });

        const config: Config = {
            version: "2.0",
            project: { name: "test", created: "2024-01" },
            domains: { locked: [] },
            trust_policy: {
                L3_auto_write: [],
                L2_staged: [],
                never_auto: [],
            },
            stage: { override: null, auto_constraint: false },
        };
        writeFileSync(join(cairnDir, "config.yaml"), yamlStringify(config), "utf-8");
        writeFileSync(join(cairnDir, "state.yaml"), yamlStringify({}), "utf-8");

        const ctx = createCairnContext(root);

        expect(ctx).toHaveProperty("memoryStore");
        expect(ctx).toHaveProperty("signalStore");
        expect(ctx).toHaveProperty("stagedStore");
        expect(ctx).toHaveProperty("stateStore");
        expect(ctx).toHaveProperty("viewsEngine");
        expect(ctx).toHaveProperty("trustRouter");
        expect(ctx).toHaveProperty("gitEar");
        expect(ctx).toHaveProperty("stageEngine");
        expect(ctx).toHaveProperty("memoryEngine");
    });

    it("throws when no .cairn directory", () => {
        const plainDir = join(tmpdir(), "cairn-no-cairn-" + Date.now());
        mkdirSync(plainDir, { recursive: true });

        expect(() => createCairnContext(plainDir)).toThrow();

        rmSync(plainDir, { recursive: true, force: true });
    });
});

describe("runStartupGitScan", () => {
    let root: string;

    afterEach(() => {
        if (root) rmSync(root, { recursive: true, force: true });
    });

    it("processes stage-signal and updates stage", async () => {
        const stageSignal = makeSignal("sig_stage_1", {
            signal_type: "decision",
            raw_data: {
                what: "stage transition",
                subject: "project-stage",
                scope: "global",
            },
            inferred: {
                probable_type: "decision",
                probable_domain: "architecture",
                confidence: "medium",
            },
        });

        const mockGitEar = createMockGitEar([stageSignal], "stage_head_1");
        const env = createTestEnv({ mockGitEar });
        root = env.root;

        await expect(runStartupGitScan(env.ctx)).resolves.toBeUndefined();

        const state = env.ctx.stateStore.load();
        expect(state.last_session_commit).toBe("stage_head_1");
    });
});
