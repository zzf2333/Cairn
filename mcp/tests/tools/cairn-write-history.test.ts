import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleCairnWriteHistory } from "../../src/tools/cairn-write-history.js";

describe("handleCairnWriteHistory", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = join(
            tmpdir(),
            `cairn-write-history-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
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

    it("writes a valid entry directly to history/ and returns success", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        const result = await handleCairnWriteHistory(baseEntry);
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("cairn: recorded 1 event: history/");
        expect(result.content[0]!.text).toContain("2024-03");
    });

    it("creates the history file with correct frontmatter fields", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        await handleCairnWriteHistory(baseEntry);

        const historyDir = join(tmpDir, ".cairn", "history");
        const files = (await import("node:fs")).readdirSync(historyDir).filter(
            (f) => f.endsWith(".md") && f !== "_TEMPLATE.md",
        );
        expect(files.length).toBe(1);

        const content = (await import("node:fs")).readFileSync(
            join(historyDir, files[0]!),
            "utf-8",
        );
        expect(content).toContain("type: rejection");
        expect(content).toContain("domain: api-layer");
        expect(content).toContain("decision_date: 2024-03");
        expect(content).toContain("recorded_date:");
        expect(content).toContain("summary: Rejected GraphQL");
        expect(content).toContain("rejected: GraphQL");
        expect(content).toContain("reason: Current data complexity");
        expect(content).toContain("revisit_when: When frontend");
    });

    it("filename follows YYYY-MM_<slug>.md pattern", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        await handleCairnWriteHistory(baseEntry);

        const historyDir = join(tmpDir, ".cairn", "history");
        const files = (await import("node:fs")).readdirSync(historyDir).filter(
            (f) => f.endsWith(".md") && f !== "_TEMPLATE.md",
        );
        expect(files[0]).toMatch(/^2024-03_.+\.md$/);
        // Should NOT have the history-candidate_ prefix (that was the v0.0.11 staging prefix)
        expect(files[0]).not.toContain("history-candidate_");
    });

    it("returns isError when entry already exists at same path", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        await handleCairnWriteHistory(baseEntry);
        const result = await handleCairnWriteHistory(baseEntry);

        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("already exists");
    });

    it("returns isError when .cairn/ does not exist", async () => {
        process.env["CAIRN_ROOT"] = join(tmpDir, "no-cairn");
        mkdirSync(join(tmpDir, "no-cairn"));

        const result = await handleCairnWriteHistory(baseEntry);
        expect(result.isError).toBe(true);
    });

    it("does not write to staged/ (no staging in v0.0.12)", async () => {
        process.env["CAIRN_ROOT"] = tmpDir;

        await handleCairnWriteHistory(baseEntry);

        expect(existsSync(join(tmpDir, ".cairn", "staged"))).toBe(false);
    });
});
