import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { handleCairnSyncDomain } from "../../src/tools/cairn-sync-domain.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

describe("handleCairnSyncDomain", () => {
    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
    });

    it("generates sync context for an existing domain with history", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnSyncDomain({ name: "api-layer" });
        expect(result.isError).toBeUndefined();

        const text = result.content[0]!.text;
        expect(text).toContain("api-layer");
        expect(text).toContain("## History entries");
        expect(text).toContain("tRPC");
    });

    it("includes the current domain file content", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnSyncDomain({ name: "api-layer" });
        const text = result.content[0]!.text;

        // Should show the existing domain file content
        expect(text).toContain("Current domain file");
        expect(text).toContain("REST + OpenAPI");
    });

    it("includes the format template", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnSyncDomain({ name: "api-layer" });
        const text = result.content[0]!.text;

        expect(text).toContain("## current design");
        expect(text).toContain("## trajectory");
        expect(text).toContain("## rejected paths");
        expect(text).toContain("## known pitfalls");
        expect(text).toContain("Re-evaluate when:");
    });

    it("includes the writing rules", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnSyncDomain({ name: "api-layer" });
        const text = result.content[0]!.text;

        expect(text).toContain("OVERWRITE the entire file");
        expect(text).toContain("200–400 tokens");
        expect(text).toContain("`rejected` fields");
    });

    it("uses the latest decision_date as the suggested updated: value", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnSyncDomain({ name: "api-layer" });
        const text = result.content[0]!.text;

        // The api-layer history entry has decision_date: 2023-09
        expect(text).toContain("2023-09");
    });

    it("shows 'create from scratch' when domain file doesn't exist", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        // architecture domain has history (growth-stage-transition) but no domain file
        const result = handleCairnSyncDomain({ name: "architecture" });
        expect(result.isError).toBeUndefined();
        const text = result.content[0]!.text;
        expect(text).toContain("Create it from scratch");
    });

    it("returns isError when no history entries exist for domain", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnSyncDomain({ name: "nonexistent-domain" });
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("No history entries found");
    });

    it("returns isError when .cairn/ does not exist", () => {
        const noProject = join(tmpdir(), "no-cairn-" + Date.now());
        mkdirSync(noProject);
        process.env["CAIRN_ROOT"] = noProject;

        const result = handleCairnSyncDomain({ name: "api-layer" });
        expect(result.isError).toBe(true);
        rmSync(noProject, { recursive: true });
    });
});
