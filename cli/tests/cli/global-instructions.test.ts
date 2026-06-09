import { describe, expect, it } from "vitest";
import { getGlobalInstructionBlock } from "../../src/global-instructions.js";

describe("global Cairn instructions", () => {
    it("bootstrap the Cairn skill instead of replacing it with raw CLI commands", () => {
        const block = getGlobalInstructionBlock();

        expect(block).toContain("Cairn Skill Bootstrap");
        expect(block).toContain("The Skill owns lifecycle semantics");
        expect(block).toContain("CLI is only the runtime actuator invoked by the Skill");
        expect(block).toContain("Required behavior:");
        expect(block).toContain("Bypassing the Cairn Skill when it is available means the task is incomplete");
        expect(block).not.toContain("Cairn Cognitive Runtime (Mandatory Protocol)");
        expect(block).not.toContain("Minimal Lifecycle Guard");
        expect(block).not.toContain("Constraints returned by context remain in effect");
        expect(block).not.toContain("cairn plan --task");
        expect(block).not.toContain("cairn observe --summary");
        expect(block).not.toContain("cairn session-end --summary");
    });
});
