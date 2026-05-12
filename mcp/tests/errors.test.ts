import { describe, it, expect } from "vitest";
import { CairnError, CairnErrorCode, formatToolError, toolResult } from "../src/errors.js";

describe("CairnError", () => {
    it("has correct name and code properties", () => {
        const err = new CairnError(CairnErrorCode.NO_CAIRN_DIR, "not found");
        expect(err.name).toBe("CairnError");
        expect(err.code).toBe("NO_CAIRN_DIR");
        expect(err.message).toBe("not found");
    });

    it("is instanceof Error", () => {
        const err = new CairnError(CairnErrorCode.SCHEMA_VALIDATION, "bad schema");
        expect(err).toBeInstanceOf(Error);
    });
});

describe("formatToolError", () => {
    it("formats Error instances", () => {
        const result = formatToolError(new Error("boom"));
        expect(result.isError).toBe(true);
        expect(result.content[0].type).toBe("text");
        expect(result.content[0].text).toBe("boom");
    });

    it("formats non-Error values", () => {
        expect(formatToolError("string error").content[0].text).toBe("string error");
        expect(formatToolError(42).content[0].text).toBe("42");
    });
});

describe("toolResult", () => {
    it("wraps text into content array", () => {
        const result = toolResult("hello");
        expect(result.content).toHaveLength(1);
        expect(result.content[0]).toEqual({ type: "text", text: "hello" });
    });
});
