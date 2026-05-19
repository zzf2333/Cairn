import { describe, it, expect } from "vitest";
import {
    assembleProtocol,
    parseInstalledVersion,
    hasProtocolBlock,
    replaceProtocolBlock,
    appendProtocolBlock,
} from "../../src/skill-assembler.js";

describe("skill-assembler", () => {
    describe("assembleProtocol", () => {
        it("produces output with start/end markers for claude-code", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "balanced" });
            expect(result).toContain("<!-- cairn:start -->");
            expect(result).toContain("<!-- cairn:end -->");
            expect(result).toContain("<!-- cairn:protocol v");
            expect(result).toContain("mode=balanced");
        });

        it("includes protocol content in correct order", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "balanced" });
            const lifecycleIdx = result.indexOf("Lifecycle Protocol");
            const contractsIdx = result.indexOf("Tool Contracts");
            const escalationIdx = result.indexOf("Escalation Model");
            const runtimeIdx = result.indexOf("Runtime Behavior");
            expect(lifecycleIdx).toBeLessThan(contractsIdx);
            expect(contractsIdx).toBeLessThan(escalationIdx);
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
            expect(result).toContain("mode=strict");
        });

        it("includes mode addendum for lightweight mode", async () => {
            const result = await assembleProtocol({ platform: "claude-code", mode: "lightweight" });
            expect(result).toContain("Lightweight Mode");
            expect(result).toContain("mode=lightweight");
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

    describe("parseInstalledVersion", () => {
        it("extracts version from protocol marker", () => {
            const content = "some text\n<!-- cairn:protocol v0.4.4 mode=balanced -->\nmore text";
            expect(parseInstalledVersion(content)).toBe("0.4.4");
        });

        it("returns null when no marker", () => {
            expect(parseInstalledVersion("just plain text")).toBeNull();
        });

        it("handles multi-digit versions", () => {
            const content = "<!-- cairn:protocol v1.23.456 mode=strict -->";
            expect(parseInstalledVersion(content)).toBe("1.23.456");
        });
    });

    describe("hasProtocolBlock", () => {
        it("detects cairn markers", () => {
            const content = "before\n<!-- cairn:start -->\nmiddle\n<!-- cairn:end -->\nafter";
            expect(hasProtocolBlock(content)).toBe(true);
        });

        it("returns false without markers", () => {
            expect(hasProtocolBlock("no markers here")).toBe(false);
        });

        it("returns false with only start marker", () => {
            expect(hasProtocolBlock("<!-- cairn:start -->\nno end")).toBe(false);
        });
    });

    describe("replaceProtocolBlock", () => {
        it("replaces existing block preserving surrounding content", () => {
            const existing = "# Header\n\n<!-- cairn:start -->\nold\n<!-- cairn:end -->\n\n# Footer";
            const result = replaceProtocolBlock(existing, "NEW BLOCK");
            expect(result).toContain("# Header");
            expect(result).toContain("NEW BLOCK");
            expect(result).toContain("# Footer");
            expect(result).not.toContain("old");
        });

        it("returns original if no markers found", () => {
            const existing = "no markers";
            expect(replaceProtocolBlock(existing, "new")).toBe("no markers");
        });
    });

    describe("appendProtocolBlock", () => {
        it("appends to existing content with spacing", () => {
            const result = appendProtocolBlock("# Existing", "NEW BLOCK");
            expect(result).toBe("# Existing\n\nNEW BLOCK\n");
        });

        it("handles empty existing content", () => {
            const result = appendProtocolBlock("", "NEW BLOCK");
            expect(result).toBe("NEW BLOCK\n");
        });

        it("trims trailing whitespace from existing", () => {
            const result = appendProtocolBlock("content  \n\n  ", "BLOCK");
            expect(result).toBe("content\n\nBLOCK\n");
        });
    });
});
