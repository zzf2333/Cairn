import { describe, expect, it } from "vitest";
import { approxTokens, extractSection } from "../src/tokens.js";

describe("approxTokens", () => {
    it("returns 0 for empty string", () => {
        expect(approxTokens("")).toBe(0);
    });

    it("estimates 1 token for 4 chars", () => {
        expect(approxTokens("test")).toBe(1);
    });

    it("rounds up", () => {
        expect(approxTokens("abc")).toBe(1); // ceil(3/4)
    });

    it("handles longer text", () => {
        const text = "a".repeat(100);
        expect(approxTokens(text)).toBe(25);
    });
});

describe("extractSection", () => {
    it("returns empty string when heading not found", () => {
        expect(extractSection("# Title\n\nsome content", "trajectory")).toBe("");
    });

    it("extracts section content up to next H2", () => {
        const body = `## trajectory\n\n2024-01 Initial design\n\n## rejected paths\n\n- None\n`;
        const result = extractSection(body, "trajectory");
        expect(result).toContain("## trajectory");
        expect(result).toContain("2024-01 Initial design");
        expect(result).not.toContain("## rejected paths");
    });

    it("extracts section to end of file when no following H2", () => {
        const body = `## trajectory\n\n2024-01 Initial design\n2024-03 Updated\n`;
        const result = extractSection(body, "trajectory");
        expect(result).toContain("2024-03 Updated");
    });

    it("is case-insensitive for heading name", () => {
        const body = `## Trajectory\n\n2024-01 Some event\n`;
        expect(extractSection(body, "trajectory")).toContain("Some event");
    });

    it("returns empty string for body with only other H2 sections", () => {
        const body = `## current design\n\nsome design\n\n## rejected paths\n\n- None\n`;
        expect(extractSection(body, "trajectory")).toBe("");
    });
});
