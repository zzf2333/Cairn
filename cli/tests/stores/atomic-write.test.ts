import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteFile } from "../../src/utils/atomic-write.js";
import { createTmpDir, cleanTmpDir } from "../test-helpers.js";

describe("atomicWriteFile", () => {
    let dir: string;
    beforeEach(async () => {
        dir = await createTmpDir();
    });
    afterEach(async () => {
        await cleanTmpDir(dir);
    });

    it("writes content fully", async () => {
        const path = join(dir, "a.txt");
        await atomicWriteFile(path, "hello");
        expect(await readFile(path, "utf-8")).toBe("hello");
    });

    it("does not leave partial content under concurrent writes", async () => {
        const path = join(dir, "concurrent.txt");
        const candidates = ["aaa", "bbbbbb", "ccccccccc", "dddd"];
        await Promise.all(candidates.map(c => atomicWriteFile(path, c)));
        const final = await readFile(path, "utf-8");
        expect(candidates).toContain(final);
    });

    it("does not leak temp files on success", async () => {
        const path = join(dir, "clean.txt");
        await atomicWriteFile(path, "x");
        const { readdir } = await import("node:fs/promises");
        const entries = await readdir(dir);
        expect(entries.filter(e => e.includes(".tmp."))).toHaveLength(0);
    });

    it("creates parent dirs only if caller did (does not auto-mkdir)", async () => {
        const nested = join(dir, "sub", "file.txt");
        await expect(atomicWriteFile(nested, "x")).rejects.toThrow();
        await mkdir(join(dir, "sub"));
        await atomicWriteFile(nested, "x");
        expect(await readFile(nested, "utf-8")).toBe("x");
    });
});
