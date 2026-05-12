import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { CairnContext } from "../../src/server.js";

const mockDoctorResult = {
    issues_count: 0,
    issues: [] as string[],
    output_tokens: { count: 200, status: "ok" },
    orphan_no_go: [],
    stale_domains: [],
    conflicts: [],
    staged_backlog: 0,
    todos_in_memory: 0,
    config_status: "ok",
};

vi.mock("../../src/server.js", () => ({
    createCairnContext: () => ({} as CairnContext),
}));

vi.mock("../../src/tools/cairn-doctor.js", () => ({
    handleCairnDoctor: () => ({
        content: [{ text: JSON.stringify(mockDoctorResult) }],
    }),
}));

import { runDoctor } from "../../src/cli/doctor.js";

describe("runDoctor", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("outputs raw JSON with --json flag", async () => {
        mockDoctorResult.issues_count = 0;
        mockDoctorResult.issues = [];

        await runDoctor(["--json"]);

        expect(logSpy).toHaveBeenCalledTimes(1);
        const output = logSpy.mock.calls[0][0] as string;
        const parsed = JSON.parse(output);
        expect(parsed.issues_count).toBe(0);
        expect(parsed.config_status).toBe("ok");
    });

    it("displays formatted issues", async () => {
        mockDoctorResult.issues_count = 2;
        mockDoctorResult.issues = [
            "views/output.md exceeds 500 token target (600 tokens)",
            "Stale domain: auth (last updated 2025-01-01)",
        ];
        mockDoctorResult.output_tokens = { count: 600, status: "warning" };
        mockDoctorResult.staged_backlog = 3;
        mockDoctorResult.todos_in_memory = 1;

        await runDoctor([]);

        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("Found 2 issue(s)");
        expect(allOutput).toContain("views/output.md exceeds 500 token target");
        expect(allOutput).toContain("Stale domain: auth");
        expect(allOutput).toContain("Output tokens: 600 (warning)");
        expect(allOutput).toContain("Staged backlog: 3");
        expect(allOutput).toContain("TODOs in memory: 1");
    });

    it("shows all-clear when no issues", async () => {
        mockDoctorResult.issues_count = 0;
        mockDoctorResult.issues = [];
        mockDoctorResult.output_tokens = { count: 200, status: "ok" };
        mockDoctorResult.staged_backlog = 0;
        mockDoctorResult.todos_in_memory = 0;

        await runDoctor([]);

        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("All checks passed");
    });
});
