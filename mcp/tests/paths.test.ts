import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findCairnRoot, resolvePaths } from "../src/paths.js";

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
            expect(() => resolvePaths(dir)).toThrow("cairn init");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
