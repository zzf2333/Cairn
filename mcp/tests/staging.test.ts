import { describe, expect, it } from "vitest";
import {
    serializeHistoryEntry,
    slugify,
} from "../src/staging.js";

describe("slugify", () => {
    it("converts to kebab-case", () => {
        expect(slugify("Rejected tRPC after two weeks")).toBe(
            "rejected-trpc-after-two-weeks",
        );
    });

    it("strips leading and trailing hyphens", () => {
        expect(slugify("  hello world  ")).toBe("hello-world");
    });

    it("truncates to 40 characters", () => {
        const long = "this is a very long summary that exceeds forty characters limit";
        const result = slugify(long);
        expect(result.length).toBeLessThanOrEqual(40);
    });

    it("handles special characters", () => {
        expect(slugify("tRPC — type-safe RPC layer")).toBe(
            "trpc-type-safe-rpc-layer",
        );
    });

    it("handles already-kebab-case input", () => {
        expect(slugify("simple-slug")).toBe("simple-slug");
    });
});

describe("serializeHistoryEntry", () => {
    it("produces correct bare key:value format", () => {
        const entry = {
            type: "rejection",
            domain: "api-layer",
            decision_date: "2023-09",
            summary: "Rejected GraphQL",
            rejected: "GraphQL",
            reason: "team size doesn't need it",
            revisit_when: "when frontend needs cross-resource queries",
        };

        const output = serializeHistoryEntry(entry, "2025-01");

        expect(output).toContain("type: rejection");
        expect(output).toContain("domain: api-layer");
        expect(output).toContain("decision_date: 2023-09");
        expect(output).toContain("recorded_date: 2025-01");
        expect(output).toContain("summary: Rejected GraphQL");
        expect(output).toContain("rejected: GraphQL");
        expect(output).toContain("reason: team size doesn't need it");
        expect(output).toContain(
            "revisit_when: when frontend needs cross-resource queries",
        );
    });

    it("serializes multi-line values with 2-space continuation", () => {
        const entry = {
            type: "rejection",
            domain: "api-layer",
            decision_date: "2023-09",
            summary: "Rejected GraphQL",
            rejected: "GraphQL — not formally evaluated.\nCurrent team doesn't need it.",
            reason: "team size",
            revisit_when: "",
        };

        const output = serializeHistoryEntry(entry, "2025-01");
        const lines = output.split("\n");
        const rejectedLine = lines.findIndex((l) => l.startsWith("rejected: "));
        expect(lines[rejectedLine + 1]).toMatch(/^  /);
        expect(lines[rejectedLine + 1]).toContain(
            "Current team doesn't need it.",
        );
    });

    it("does not include --- frontmatter delimiters", () => {
        const entry = {
            type: "decision",
            domain: "auth",
            decision_date: "2022-12",
            summary: "Adopted JWT",
            rejected: "session",
            reason: "stateless",
            revisit_when: "",
        };
        const output = serializeHistoryEntry(entry, "2025-01");
        expect(output).not.toContain("---");
    });
});
