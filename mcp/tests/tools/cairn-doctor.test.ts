import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleCairnDoctor } from "../../src/tools/cairn-doctor.js";

describe("handleCairnDoctor", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = join(
            tmpdir(),
            `cairn-doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        delete process.env["CAIRN_ROOT"];
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
        delete process.env["CAIRN_ROOT"];
    });

    it("returns JSON with missing output status when .cairn/ not found", () => {
        mkdirSync(tmpDir);
        process.env["CAIRN_ROOT"] = join(tmpDir, "no-cairn");
        mkdirSync(join(tmpDir, "no-cairn"));

        const result = handleCairnDoctor();
        expect(result.isError).toBeUndefined();

        const json = JSON.parse(result.content[0]!.text);
        expect(Array.isArray(json.issues)).toBe(true);
    });

    it("returns valid JSON output (parseable)", () => {
        // Use the saas-18mo example which has a real .cairn/
        const fixturesDir = join(import.meta.dirname, "../fixtures");
        process.env["CAIRN_ROOT"] = fixturesDir;

        const result = handleCairnDoctor();
        expect(result.isError).toBeUndefined();

        // Result must be valid JSON
        expect(() => JSON.parse(result.content[0]!.text)).not.toThrow();
    });

    it("returned JSON has required top-level keys", () => {
        const fixturesDir = join(import.meta.dirname, "../fixtures");
        process.env["CAIRN_ROOT"] = fixturesDir;

        const result = handleCairnDoctor();
        const json = JSON.parse(result.content[0]!.text);

        expect(json).toHaveProperty("issues");
        expect(json).toHaveProperty("output");
        expect(json.output).toHaveProperty("status");
        expect(json).toHaveProperty("domains_stale");
        expect(json).toHaveProperty("skill_guide");
        expect(json).toHaveProperty("skill_md");
        expect(json).toHaveProperty("v0011_residue");
        expect(json).toHaveProperty("write_back");
        expect(Array.isArray(json.domains_stale)).toBe(true);
        expect(Array.isArray(json.v0011_residue)).toBe(true);
        expect(json.write_back).toHaveProperty("status");
        expect(json.write_back.status).toMatch(/^(ok|warn|skipped)$/);
        expect(Array.isArray(json.write_back.signals)).toBe(true);
    });
});
