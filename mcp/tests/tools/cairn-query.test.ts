import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { handleCairnQuery } from "../../src/tools/cairn-query.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

describe("handleCairnQuery", () => {
    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
    });

    it("returns all history entries when no filters applied", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnQuery({});
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("Found");
        // Fixture has 4 history entries
        expect(result.content[0]!.text).toMatch(/Found [1-9]\d* history entr/);
    });

    it("filters by domain", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnQuery({ domain: "api-layer" });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("api-layer");
        // Should include the tRPC rejection
        expect(result.content[0]!.text).toContain("tRPC");
    });

    it("filters by type", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnQuery({ type: "debt" });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("AUTH-COUPLING");
    });

    it("filters by both domain and type", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnQuery({ domain: "api-layer", type: "experiment" });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("tRPC");
    });

    it("returns informational message (not error) when no entries match", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnQuery({ domain: "nonexistent-domain" });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("No history entries found");
    });

    it("returns isError for invalid type", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnQuery({ type: "invalid-type" });
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("Invalid type");
    });

    it("returns entries sorted chronologically", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnQuery({});
        const text = result.content[0]!.text;

        // Find positions of dates in the output
        const pos2023 = text.indexOf("2023-03");
        const pos2024 = text.indexOf("2024-09");
        expect(pos2023).toBeGreaterThanOrEqual(0);
        expect(pos2024).toBeGreaterThanOrEqual(0);
        expect(pos2023).toBeLessThan(pos2024);
    });

    it("returns isError when .cairn/ does not exist", () => {
        const noProject = join(tmpdir(), "no-cairn-" + Date.now());
        mkdirSync(noProject);
        process.env["CAIRN_ROOT"] = noProject;

        const result = handleCairnQuery({});
        expect(result.isError).toBe(true);
        rmSync(noProject, { recursive: true });
    });
});
