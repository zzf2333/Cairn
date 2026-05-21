import { describe, it, expect } from "vitest";
import { assembleProtocol } from "../../src/skill-assembler.js";

describe("skill-assembler", () => {
    describe("assembleProtocol", () => {
        it("produces clean output without injection markers", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "balanced" });
            expect(result).not.toContain("<!-- cairn:start -->");
            expect(result).not.toContain("<!-- cairn:end -->");
            expect(result).toContain("# Cairn Cognitive Runtime Protocol");
        });

        it("includes protocol content in correct order", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "balanced" });
            const lifecycleIdx = result.indexOf("Lifecycle Protocol");
            const escalationIdx = result.indexOf("Escalation Model");
            const runtimeIdx = result.indexOf("Runtime Behavior");
            expect(lifecycleIdx).toBeLessThan(escalationIdx);
            expect(escalationIdx).toBeLessThan(runtimeIdx);
        });

        it("includes adapter content after protocol", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "balanced" });
            const runtimeIdx = result.indexOf("Runtime Behavior");
            const adapterIdx = result.indexOf("Claude Code Adapter");
            expect(adapterIdx).toBeGreaterThan(runtimeIdx);
        });

        it("includes mode addendum for strict mode", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "strict" });
            expect(result).toContain("Strict Mode");
        });

        it("includes mode addendum for lightweight mode", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "lightweight" });
            expect(result).toContain("Lightweight Mode");
        });

        it("does not include mode addendum for balanced", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "balanced" });
            expect(result).not.toContain("Strict Mode");
            expect(result).not.toContain("Lightweight Mode");
        });

        it("assembles for codex platform", async () => {
            const result = await assembleProtocol({ platform: "codex", mode: "balanced" });
            expect(result).toContain("Codex Adapter");
            expect(result).toContain("AGENTS.md");
        });

        it("assembles for cursor platform", async () => {
            const result = await assembleProtocol({ platform: "cursor", mode: "balanced" });
            expect(result).toContain("Cursor Adapter");
        });

        it("throws for unknown platform", async () => {
            await expect(assembleProtocol({ platform: "vim", mode: "balanced" }))
                .rejects.toThrow("Unknown platform");
        });

        it("throws for unknown mode", async () => {
            await expect(assembleProtocol({ platform: "claude-code", mode: "extreme" }))
                .rejects.toThrow("Unknown mode");
        });
    });
});
