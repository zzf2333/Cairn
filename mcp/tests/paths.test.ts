import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findCairnRoot, resolvePaths, buildPaths } from "../src/paths.js";

describe("findCairnRoot", () => {
    const dirs: string[] = [];

    function makeTempDir(suffix: string) {
        const dir = join(tmpdir(), `cairn-test-paths-${suffix}-${Date.now()}`);
        dirs.push(dir);
        return dir;
    }

    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
        for (const dir of dirs) {
            rmSync(dir, { recursive: true, force: true });
        }
        dirs.length = 0;
    });

    it("finds .cairn in startDir", () => {
        const dir = makeTempDir("direct");
        mkdirSync(join(dir, ".cairn"), { recursive: true });
        expect(findCairnRoot(dir)).toBe(dir);
    });

    it("walks parent directories", () => {
        const dir = makeTempDir("parent");
        mkdirSync(join(dir, ".cairn"), { recursive: true });
        const deep = join(dir, "src", "deep");
        mkdirSync(deep, { recursive: true });
        expect(findCairnRoot(deep)).toBe(dir);
    });

    it("returns null when no .cairn found", () => {
        const dir = makeTempDir("none");
        mkdirSync(dir, { recursive: true });
        expect(findCairnRoot(dir)).toBeNull();
    });

    it("uses CAIRN_ROOT env var when set", () => {
        const dir = makeTempDir("env");
        mkdirSync(join(dir, ".cairn"), { recursive: true });
        process.env["CAIRN_ROOT"] = dir;
        expect(findCairnRoot("/some/other/path")).toBe(dir);
    });
});

describe("resolvePaths", () => {
    it("throws when no .cairn directory found", () => {
        const dir = join(tmpdir(), `cairn-test-resolve-${Date.now()}`);
        mkdirSync(dir, { recursive: true });
        try {
            expect(() => resolvePaths(dir)).toThrow("auto-initialize");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("buildPaths", () => {
    it("constructs correct paths from root", () => {
        const root = "/tmp/fake-project";
        const paths = buildPaths(root);
        expect(paths.root).toBe(root);
        expect(paths.cairnDir).toBe(join(root, ".cairn"));
        expect(paths.configYaml).toBe(join(root, ".cairn", "config.yaml"));
        expect(paths.stateYaml).toBe(join(root, ".cairn", "state.yaml"));
        expect(paths.signalsDir).toBe(join(root, ".cairn", "signals"));
        expect(paths.stagedDir).toBe(join(root, ".cairn", "staged"));
        expect(paths.memoryDir).toBe(join(root, ".cairn", "memory"));
        expect(paths.viewsDir).toBe(join(root, ".cairn", "views"));
        expect(paths.viewsDomainsDir).toBe(join(root, ".cairn", "views", "domains"));
        expect(paths.sessionsDir).toBe(join(root, ".cairn", "sessions"));
    });

    it("does not check directory existence", () => {
        const paths = buildPaths("/nonexistent/path/that/does/not/exist");
        expect(paths.root).toBe("/nonexistent/path/that/does/not/exist");
    });
});
