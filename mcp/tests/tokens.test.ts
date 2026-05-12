import { describe, it, expect } from "vitest";
import { approxTokens, extractSection } from "../src/tokens.js";

describe("approxTokens", () => {
    it("returns 0 for empty string", () => {
        expect(approxTokens("")).toBe(0);
    });

    it("returns ceil(length/4) for ASCII text", () => {
        expect(approxTokens("abcdefgh")).toBe(2);
        expect(approxTokens("abc")).toBe(1);
        expect(approxTokens("a")).toBe(1);
        expect(approxTokens("abcde")).toBe(2);
    });

    it("handles unicode/CJK characters", () => {
        const cjk = "你好世界";
        expect(approxTokens(cjk)).toBe(Math.ceil(cjk.length / 4));
    });
});

describe("extractSection", () => {
    const body = `## stage

phase: growth
confidence: 0.4

## no-go

- tRPC: avoid

## debt

- legacy auth module`;

    it("extracts matching H2 section up to next H2", () => {
        const section = extractSection(body, "stage");
        expect(section).toContain("phase: growth");
        expect(section).not.toContain("no-go");
    });

    it("returns empty string when heading not found", () => {
        expect(extractSection(body, "missing")).toBe("");
    });

    it("extracts last section to EOF when no next heading", () => {
        const section = extractSection(body, "debt");
        expect(section).toContain("legacy auth module");
    });
});
