import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { stat, readdir } from "node:fs/promises";
import { createTmpDir, cleanTmpDir, initTestRepo } from "../test-helpers.js";
import { buildPaths, ALL_DIRS } from "../../src/paths.js";
import { bootstrapEmpty } from "../../src/bootstrap.js";
import { createContext, ensureCairnDirs } from "../../src/context.js";

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    initTestRepo(tmpDir);
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("E2E smoke", () => {
    it("bootstrap creates correct directory structure", async () => {
        await bootstrapEmpty(tmpDir);
        const paths = buildPaths(tmpDir);
        const expectedDirs = ALL_DIRS(paths);

        for (const dir of expectedDirs) {
            const dirStat = await stat(dir);
            expect(dirStat.isDirectory()).toBe(true);
        }

        const configStat = await stat(paths.config);
        expect(configStat.isFile()).toBe(true);
    });

    it("bootstrap is idempotent", async () => {
        await bootstrapEmpty(tmpDir);
        await bootstrapEmpty(tmpDir);

        const paths = buildPaths(tmpDir);
        const configStat = await stat(paths.config);
        expect(configStat.isFile()).toBe(true);

        const expectedDirs = ALL_DIRS(paths);
        for (const dir of expectedDirs) {
            const dirStat = await stat(dir);
            expect(dirStat.isDirectory()).toBe(true);
        }
    });

    it("full context can be created from bootstrapped directory", async () => {
        await bootstrapEmpty(tmpDir);
        const ctx = await createContext(tmpDir);

        expect(ctx.bloodStore).toBeDefined();
        expect(ctx.skeletonStore).toBeDefined();
        expect(ctx.dnaStore).toBeDefined();
        expect(ctx.domainStore).toBeDefined();
        expect(ctx.signalStore).toBeDefined();
        expect(ctx.stagedStore).toBeDefined();
        expect(ctx.stateStore).toBeDefined();
        expect(ctx.configStore).toBeDefined();
        expect(ctx.governanceStore).toBeDefined();
        expect(ctx.sessionStore).toBeDefined();
        expect(ctx.activationEngine).toBeDefined();
        expect(ctx.challengeEngine).toBeDefined();
        expect(ctx.stageEngine).toBeDefined();
        expect(ctx.decayEngine).toBeDefined();
        expect(ctx.compressionEngine).toBeDefined();
        expect(ctx.resurrectionEngine).toBeDefined();
        expect(ctx.consistencyEngine).toBeDefined();
        expect(ctx.bloodEngine).toBeDefined();
        expect(ctx.viewsEngine).toBeDefined();
        expect(ctx.governanceEngine).toBeDefined();
        expect(ctx.trustRouter).toBeDefined();
        expect(ctx.gitEar).toBeDefined();
        expect(ctx.calibrationEar).toBeDefined();
    });
});
