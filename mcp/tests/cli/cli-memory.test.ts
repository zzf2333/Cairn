import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { CairnContext } from "../../src/server.js";
import { makeMemory } from "../test-helpers.js";

const mockCtx = {
    memoryStore: {
        loadById: vi.fn(),
        loadAll: vi.fn(),
    },
    memoryEngine: {
        archive: vi.fn(),
    },
} as unknown as CairnContext;

vi.mock("../../src/server.js", () => ({
    createCairnContext: () => mockCtx,
}));

import { runMemory } from "../../src/cli/memory.js";

describe("runMemory", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
            throw new Error("process.exit");
        });
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
            throw new Error("process.exit");
        });
    });

    afterEach(() => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        exitSpy.mockRestore();
    });

    it("show outputs YAML for existing entry", async () => {
        const mem = makeMemory("mem_show");
        (mockCtx.memoryStore.loadById as ReturnType<typeof vi.fn>).mockReturnValue(mem);

        await runMemory(["show", "mem_show"]);

        expect(mockCtx.memoryStore.loadById).toHaveBeenCalledWith("mem_show");
        expect(logSpy).toHaveBeenCalled();
        const output = logSpy.mock.calls[0][0] as string;
        expect(output).toContain("mem_show");
    });

    it("show exits with error for missing entry", async () => {
        (mockCtx.memoryStore.loadById as ReturnType<typeof vi.fn>).mockReturnValue(null);

        await expect(runMemory(["show", "nonexistent"])).rejects.toThrow("process.exit");

        expect(errorSpy).toHaveBeenCalledWith("Memory entry not found: nonexistent");
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("archive prints success", async () => {
        (mockCtx.memoryEngine.archive as ReturnType<typeof vi.fn>).mockReturnValue(true);

        await runMemory(["archive", "mem_arch"]);

        expect(mockCtx.memoryEngine.archive).toHaveBeenCalledWith("mem_arch");
        expect(logSpy).toHaveBeenCalledWith("✅ Archived: mem_arch");
    });

    it("list shows all entries with status indicators", async () => {
        const memories = [
            makeMemory("mem_1", { status: "active", type: "decision", domain: "api-layer", summary: "Chose REST API" }),
            makeMemory("mem_2", { status: "archived", type: "rejection", domain: "auth", summary: "Rejected OAuth1" }),
        ];
        (mockCtx.memoryStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue(memories);

        await runMemory(["list"]);

        expect(logSpy).toHaveBeenCalledWith("2 memory entries:\n");
        const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(allOutput).toContain("●");
        expect(allOutput).toContain("○");
        expect(allOutput).toContain("mem_1");
        expect(allOutput).toContain("mem_2");
    });

    it("list prints message when empty", async () => {
        (mockCtx.memoryStore.loadAll as ReturnType<typeof vi.fn>).mockReturnValue([]);

        await runMemory(["list"]);

        expect(logSpy).toHaveBeenCalledWith("No memory entries.");
    });
});
