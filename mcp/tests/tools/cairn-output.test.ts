import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleCairnOutput } from "../../src/tools/cairn-output.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

describe("handleCairnOutput", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = join(tmpdir(), `cairn-output-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(join(tmpDir, ".cairn"), { recursive: true });
        delete process.env["CAIRN_ROOT"];
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
        delete process.env["CAIRN_ROOT"];
    });

    it("returns the contents of output.md", () => {
        process.env["CAIRN_ROOT"] = tmpDir;
        writeFileSync(
            join(tmpDir, ".cairn", "output.md"),
            "## stage\n\nphase: test\n\n## no-go\n\n- Redux",
        );

        const result = handleCairnOutput();
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("## stage");
        expect(result.content[0]!.text).toContain("phase: test");
        expect(result.content[0]!.text).toContain("Redux");
    });

    it("returns isError when .cairn/ does not exist", () => {
        process.env["CAIRN_ROOT"] = join(tmpDir, "no-cairn-here");
        mkdirSync(join(tmpDir, "no-cairn-here"), { recursive: true });

        const result = handleCairnOutput();
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("No .cairn/ directory");
    });

    it("returns isError when output.md is missing", () => {
        process.env["CAIRN_ROOT"] = tmpDir;
        // .cairn/ exists but output.md doesn't

        const result = handleCairnOutput();
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("output.md");
    });

    it("warns when output.md is empty", () => {
        process.env["CAIRN_ROOT"] = tmpDir;
        writeFileSync(join(tmpDir, ".cairn", "output.md"), "");

        const result = handleCairnOutput();
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("empty");
    });

    it("returns real fixture output.md correctly", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnOutput();
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("## stage");
        expect(result.content[0]!.text).toContain("## no-go");
        expect(result.content[0]!.text).toContain("## hooks");
        expect(result.content[0]!.text).toContain("tRPC");
    });
});
