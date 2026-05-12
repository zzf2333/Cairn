import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { CairnContext } from "../../src/server.js";
import type { MemoryEntry, StagedEntry } from "../../src/schemas/index.js";
import { makeMemory, makeStagedEntry } from "../test-helpers.js";

let mockAnswers: string[] = [];

vi.mock("node:readline", () => ({
    createInterface: () => {
        let idx = 0;
        return {
            question: (_q: string, cb: (answer: string) => void) => {
                cb(mockAnswers[idx++] || "s");
            },
            close: () => {},
        };
    },
}));

const mockCtx = {
    stagedStore: {
        loadPending: vi.fn<() => StagedEntry[]>(),
        accept: vi.fn<(id: string) => MemoryEntry | null>(),
        reject: vi.fn<(id: string) => boolean>(),
    },
    memoryEngine: {
        write: vi.fn(),
    },
    viewsEngine: {
        regenerate: vi.fn(),
    },
} as unknown as CairnContext;

vi.mock("../../src/server.js", () => ({
    createCairnContext: () => mockCtx,
}));

import { runReview } from "../../src/cli/review.js";

describe("runReview", () => {
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

    it("prints message when no staged entries", async () => {
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([]);

        await runReview();

        expect(logSpy).toHaveBeenCalledWith("No staged entries pending review.");
    });

    it("accepts entry on 'a' input", async () => {
        const staged = makeStagedEntry("stg_001");
        const memory = makeMemory("mem_from_staged");
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([staged]);
        (mockCtx.stagedStore.accept as ReturnType<typeof vi.fn>).mockReturnValue(memory);
        mockAnswers = ["a"];

        await runReview();

        expect(mockCtx.stagedStore.accept).toHaveBeenCalledWith("stg_001");
        expect(mockCtx.memoryEngine.write).toHaveBeenCalledWith(memory);
        expect(mockCtx.viewsEngine.regenerate).toHaveBeenCalled();
    });

    it("rejects entry on 'd' input", async () => {
        const staged = makeStagedEntry("stg_002");
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([staged]);
        (mockCtx.stagedStore.reject as ReturnType<typeof vi.fn>).mockReturnValue(true);
        mockAnswers = ["d"];

        await runReview();

        expect(mockCtx.stagedStore.reject).toHaveBeenCalledWith("stg_002");
    });

    it("skips entry on other input", async () => {
        const staged = makeStagedEntry("stg_003");
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([staged]);
        mockAnswers = ["x"];

        await runReview();

        expect(mockCtx.stagedStore.accept).not.toHaveBeenCalled();
        expect(mockCtx.stagedStore.reject).not.toHaveBeenCalled();
    });

    it("regenerates views only when accepted > 0", async () => {
        const staged = makeStagedEntry("stg_004");
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue([staged]);
        mockAnswers = ["d"];

        await runReview();

        expect(mockCtx.viewsEngine.regenerate).not.toHaveBeenCalled();
    });

    it("reports correct counts", async () => {
        const entries = [
            makeStagedEntry("stg_a"),
            makeStagedEntry("stg_d"),
            makeStagedEntry("stg_s"),
        ];
        (mockCtx.stagedStore.loadPending as ReturnType<typeof vi.fn>).mockReturnValue(entries);
        (mockCtx.stagedStore.accept as ReturnType<typeof vi.fn>).mockReturnValue(makeMemory("mem_a"));
        (mockCtx.stagedStore.reject as ReturnType<typeof vi.fn>).mockReturnValue(true);
        mockAnswers = ["a", "d", "s"];

        await runReview();

        const reviewLine = logSpy.mock.calls.find(
            (c) => typeof c[0] === "string" && c[0].includes("Review complete"),
        );
        expect(reviewLine).toBeDefined();
        expect(reviewLine![0]).toContain("1 accepted");
        expect(reviewLine![0]).toContain("1 deleted");
        expect(reviewLine![0]).toContain("1 skipped");
    });
});
