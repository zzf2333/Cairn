import { describe, expect, it } from "vitest";
import { getGlobalInstructionBlock } from "../../src/global-instructions.js";

describe("global Cairn instructions", () => {
    it("bootstrap the Cairn skill instead of replacing it with raw CLI commands", () => {
        const block = getGlobalInstructionBlock();

        expect(block).toContain("Cairn Skill Bootstrap");
        expect(block).toContain("Cairn Skill = protocol owner");
        expect(block).toContain("Cairn CLI = runtime actuator");
        expect(block).toContain("This block = bootstrap guard");
        expect(block).toContain("Do not treat the commands below as a replacement for the skill");
        expect(block).not.toContain("Cairn Cognitive Runtime (Mandatory Protocol)");
    });
});
