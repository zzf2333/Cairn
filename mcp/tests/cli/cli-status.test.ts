import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { CairnContext } from "../../src/server.js";
import { makeMemory, makeStagedEntry, makeSignal } from "../test-helpers.js";

const mockCtx = {
    memoryStore: {
        loadAll: vi.fn(),
        findConflicts: vi.fn(),
    },
    stagedStore: {
        loadPending: vi.fn(),
    },
    signalStore: {
        loadAll: vi.fn(),
    },
    stateStore: {
        load: vi.fn(),
    },
} as unknown as CairnContext;

vi.mock("../../src/server.js", () => ({
    createCairnContext: () => mockCtx,
}));

import { runStatus } from "../../src/cli/status.js";

describe("runStatus", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("displays counts and stage info", async () => {
        (mockCtx.memoryStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue([
            makeMemory("m1"), makeMemory("m2"),
        ]);
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.signalStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue([
            makeSignal("s1"),
        ]);
        (mockCtx.memoryStore.findConflicts as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.stateStore.load as ReturnType<typeof vi.fn>).mockReturnValue({
            last_session_commit: "abc1234",
            stage: { phase: "growth", confidence: 0.6, status: "advisory" },
        });

        await runStatus();

        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("Memory entries:  2");
        expect(allOutput).toContain("Staged (pending): 0");
        expect(allOutput).toContain("Signals (L1):    1");
        expect(allOutput).toContain("Stage: growth");
        expect(allOutput).toContain("abc1234");
    });

    it("warns about pending staged entries", async () => {
        (mockCtx.memoryStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([
            makeStagedEntry("stg1"), makeStagedEntry("stg2"),
        ]);
        (mockCtx.signalStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.memoryStore.findConflicts as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.stateStore.load as ReturnType<typeof vi.fn>).mockReturnValue({
            last_session_commit: null,
            stage: { phase: "growth", confidence: 0.4, status: "advisory" },
        });

        await runStatus();

        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("2 entries pending review");
        expect(allOutput).toContain("cairn review");
    });

    it("warns about conflicts", async () => {
        (mockCtx.memoryStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.signalStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue([]);
        (mockCtx.memoryStore.findConflicts as ReturnType<typeof vi.fn>).mockReturnValue([
            makeMemory("mem_conflict", {
                health: { state: "conflicted", reason: "Contradicts mem_other" },
            }),
        ]);
        (mockCtx.stateStore.load as ReturnType<typeof vi.fn>).mockReturnValue({
            last_session_commit: null,
            stage: { phase: "growth", confidence: 0.4, status: "advisory" },
        });

        await runStatus();

        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("1 conflicted entries found");
        expect(allOutput).toContain("Contradicts mem_other");
    });
});
