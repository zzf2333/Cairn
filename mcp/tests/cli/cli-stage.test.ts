import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { CairnContext } from "../../src/server.js";

function makeState(overrides?: Record<string, unknown>) {
    return {
        last_session_commit: null,
        last_session_at: null,
        stage: {
            phase: "growth",
            confidence: 0.6,
            status: "advisory",
            evidence: [{ source: "git", signal: "Commit trend: 1.5" }],
            guidance: ["Balance speed and stability"],
            last_updated: "2026-01-01T00:00:00Z",
        },
        ...overrides,
    };
}

const mockCtx = {
    stateStore: {
        load: vi.fn(),
        save: vi.fn(),
    },
    viewsEngine: {
        regenerate: vi.fn(),
    },
} as unknown as CairnContext;

vi.mock("../../src/server.js", () => ({
    createCairnContext: () => mockCtx,
}));

import { runStage } from "../../src/cli/stage.js";

describe("runStage", () => {
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

    it("confirm updates status and regenerates views", async () => {
        const state = makeState();
        (mockCtx.stateStore.load as ReturnType<typeof vi.fn>).mockReturnValue(state);

        await runStage(["confirm"]);

        expect(state.stage.status).toBe("confirmed");
        expect(mockCtx.stateStore.save).toHaveBeenCalledWith(state);
        expect(mockCtx.viewsEngine.regenerate).toHaveBeenCalled();
        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("Stage confirmed");
    });

    it("confirm prints already confirmed", async () => {
        const state = makeState();
        state.stage.status = "confirmed";
        (mockCtx.stateStore.load as ReturnType<typeof vi.fn>).mockReturnValue(state);

        await runStage(["confirm"]);

        expect(logSpy).toHaveBeenCalledWith("Stage already confirmed: growth");
        expect(mockCtx.stateStore.save).not.toHaveBeenCalled();
    });

    it("default displays current stage info", async () => {
        const state = makeState();
        (mockCtx.stateStore.load as ReturnType<typeof vi.fn>).mockReturnValue(state);

        await runStage([]);

        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("Stage Advisory");
        expect(allOutput).toContain("growth");
        expect(allOutput).toContain("0.6");
        expect(allOutput).toContain("advisory");
        expect(allOutput).toContain("Commit trend: 1.5");
        expect(allOutput).toContain("Balance speed and stability");
    });

    it("default shows confirm hint when advisory", async () => {
        const state = makeState();
        (mockCtx.stateStore.load as ReturnType<typeof vi.fn>).mockReturnValue(state);

        await runStage([]);

        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("cairn stage confirm");
    });
});
