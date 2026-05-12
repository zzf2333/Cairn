import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { parse as yamlParse } from "yaml";

let mockAnswers: string[] = [];

vi.mock("node:readline", () => ({
    createInterface: () => {
        let idx = 0;
        return {
            question: (_q: string, cb: (answer: string) => void) => {
                cb(mockAnswers[idx++] || "");
            },
            close: () => {},
        };
    },
}));

vi.mock("simple-git", () => ({
    simpleGit: () => ({
        log: async () => ({ all: [] }),
    }),
}));

import { runInit } from "../../src/cli/init.js";

describe("runInit", () => {
    let tmpDir: string;
    let originalCwd: string;
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        tmpDir = join(tmpdir(), `cairn-init-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
        mkdirSync(tmpDir, { recursive: true });
        originalCwd = process.cwd();
        process.chdir(tmpDir);
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        mockAnswers = ["test-project", "2024-06", "1,3"];
    });

    afterEach(() => {
        process.chdir(originalCwd);
        rmSync(tmpDir, { recursive: true, force: true });
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("creates .cairn directory structure", async () => {
        await runInit([]);

        const expectedDirs = [
            ".cairn",
            ".cairn/signals",
            ".cairn/staged",
            ".cairn/memory",
            ".cairn/views",
            ".cairn/views/domains",
            ".cairn/sessions",
        ];
        for (const dir of expectedDirs) {
            expect(existsSync(join(tmpDir, dir))).toBe(true);
        }
    });

    it("generates valid config.yaml", async () => {
        await runInit([]);

        const configPath = join(tmpDir, ".cairn", "config.yaml");
        expect(existsSync(configPath)).toBe(true);
        const config = yamlParse(readFileSync(configPath, "utf-8"));
        expect(config.version).toBe("2.0");
        expect(config.project.name).toBe("test-project");
        expect(config.project.created).toBe("2024-06");
        expect(config.domains.locked).toContain("api-layer");
        expect(config.domains.locked).toContain("database");
    });

    it("generates valid state.yaml", async () => {
        await runInit([]);

        const statePath = join(tmpDir, ".cairn", "state.yaml");
        expect(existsSync(statePath)).toBe(true);
        const state = yamlParse(readFileSync(statePath, "utf-8"));
        expect(state.stage.phase).toBe("growth");
        expect(state.stage.confidence).toBe(0.4);
        expect(state.stage.status).toBe("advisory");
    });

    it("generates initial output.md", async () => {
        await runInit([]);

        const outputPath = join(tmpDir, ".cairn", "views", "output.md");
        expect(existsSync(outputPath)).toBe(true);
        const content = readFileSync(outputPath, "utf-8");
        expect(content).toContain("## stage");
        expect(content).toContain("phase: growth");
    });

    it("skips when .cairn exists and no --force", async () => {
        mkdirSync(join(tmpDir, ".cairn"), { recursive: true });

        await runInit([]);

        expect(logSpy).toHaveBeenCalledWith(
            ".cairn/ already exists. Use --force to reinitialize.",
        );
        expect(existsSync(join(tmpDir, ".cairn", "config.yaml"))).toBe(false);
    });

    it("reinitializes with --force", async () => {
        mkdirSync(join(tmpDir, ".cairn"), { recursive: true });

        await runInit(["--force"]);

        expect(existsSync(join(tmpDir, ".cairn", "config.yaml"))).toBe(true);
        const config = yamlParse(
            readFileSync(join(tmpDir, ".cairn", "config.yaml"), "utf-8"),
        );
        expect(config.project.name).toBe("test-project");
    });

    it("parses numeric domain selections", async () => {
        mockAnswers = ["proj", "2024-01", "1,3,5"];
        await runInit([]);

        const config = yamlParse(
            readFileSync(join(tmpDir, ".cairn", "config.yaml"), "utf-8"),
        );
        expect(config.domains.locked).toContain("api-layer");
        expect(config.domains.locked).toContain("database");
        expect(config.domains.locked).toContain("frontend-framework");
        expect(config.domains.locked).toHaveLength(3);
    });

    it("accepts custom domain names", async () => {
        mockAnswers = ["proj", "2024-01", "my-domain"];
        await runInit([]);

        const config = yamlParse(
            readFileSync(join(tmpDir, ".cairn", "config.yaml"), "utf-8"),
        );
        expect(config.domains.locked).toContain("my-domain");
    });
});
