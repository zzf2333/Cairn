import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleCairnPropose } from "../../src/tools/cairn-propose.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

describe("handleCairnPropose", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = join(tmpdir(), `cairn-propose-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(join(tmpDir, ".cairn", "history"), { recursive: true });
        delete process.env["CAIRN_ROOT"];
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
        delete process.env["CAIRN_ROOT"];
    });

    const baseEntry = {
        type: "rejection",
        domain: "api-layer",
        decision_date: "2024-03",
        summary: "Rejected GraphQL for current team size",
        rejected: "GraphQL — not formally evaluated",
        reason: "Current data complexity and team size don't justify it",
        revisit_when: "When frontend needs cross-resource aggregation queries",
    };

    it("stages a valid entry and returns success message", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        const result = await handleCairnPropose(baseEntry);
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain(".cairn/staged/");
        expect(result.content[0]!.text).toContain("2024-03");
        expect(result.content[0]!.text).toContain("mv");
    });

    it("includes approval instructions in the response", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        const result = await handleCairnPropose(baseEntry);
        const text = result.content[0]!.text;
        expect(text).toContain("To approve");
        expect(text).toContain("To discard");
        expect(text).toContain(".cairn/history/");
    });

    it("includes the entry content in the response", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        const result = await handleCairnPropose(baseEntry);
        const text = result.content[0]!.text;
        expect(text).toContain("type: rejection");
        expect(text).toContain("domain: api-layer");
        expect(text).toContain("summary: Rejected GraphQL for current team size");
    });

    it("warns when domain is not in locked list", async () => {
        // Use real fixture which has a locked domain list from output.md
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        // Create a separate tmp for staging (fixtures dir should not be modified)
        // Actually we need a tmp dir with .cairn/ that has output.md but different staged dir
        // Let's use a dir that has output.md but with unknown domain
        const customDir = join(tmpDir, "custom");
        mkdirSync(join(customDir, ".cairn", "history"), { recursive: true });
        const { readFileSync, writeFileSync } = await import("node:fs");
        const fixtureOutput = readFileSync(join(FIXTURES_DIR, ".cairn", "output.md"), "utf-8");
        writeFileSync(join(customDir, ".cairn", "output.md"), fixtureOutput);

        process.env["CAIRN_ROOT"] = customDir;

        const entryWithUnknownDomain = {
            ...baseEntry,
            domain: "unknown-domain",
        };

        const result = await handleCairnPropose(entryWithUnknownDomain);
        // Should succeed but with a warning
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("Warning");
        expect(result.content[0]!.text).toContain("locked domain list");
    });

    it("returns isError when staging conflict exists", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        // Stage once successfully
        await handleCairnPropose(baseEntry);

        // Try to stage the same entry again
        const result = await handleCairnPropose(baseEntry);
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("already exists");
    });

    it("returns isError when .cairn/ does not exist", async () => {
        process.env["CAIRN_ROOT"] = join(tmpDir, "no-cairn");
        mkdirSync(join(tmpDir, "no-cairn"));

        const result = await handleCairnPropose(baseEntry);
        expect(result.isError).toBe(true);
    });
});
