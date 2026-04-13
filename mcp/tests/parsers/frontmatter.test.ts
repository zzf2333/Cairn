import { describe, expect, it } from "vitest";
import { extractFrontmatter } from "../../src/parsers/frontmatter.js";

describe("extractFrontmatter", () => {
    it("extracts frontmatter from a valid domain file", () => {
        const content = [
            "---",
            "domain: api-layer",
            'hooks: ["api", "endpoint"]',
            "updated: 2024-03",
            "status: stable",
            "---",
            "",
            "# api-layer",
            "",
            "## current design",
            "",
            "REST + OpenAPI.",
        ].join("\n");

        const result = extractFrontmatter(content);
        expect(result).not.toBeNull();
        expect(result!.frontmatter).toEqual({
            domain: "api-layer",
            hooks: ["api", "endpoint"],
            updated: "2024-03",
            status: "stable",
        });
        expect(result!.body).toContain("# api-layer");
        expect(result!.body).toContain("## current design");
    });

    it("parses hooks as a JSON array within YAML", () => {
        const content = [
            "---",
            'hooks: ["api", "endpoint", "tRPC", "GraphQL", "REST", "OpenAPI"]',
            "---",
            "body",
        ].join("\n");

        const result = extractFrontmatter(content);
        expect(result!.frontmatter["hooks"]).toEqual([
            "api",
            "endpoint",
            "tRPC",
            "GraphQL",
            "REST",
            "OpenAPI",
        ]);
    });

    it("returns null for a history file without frontmatter", () => {
        const content = [
            "type: experiment",
            "domain: api-layer",
            "decision_date: 2023-09",
        ].join("\n");

        const result = extractFrontmatter(content);
        expect(result).toBeNull();
    });

    it("returns null for empty content", () => {
        expect(extractFrontmatter("")).toBeNull();
    });

    it("returns null for content without closing ---", () => {
        const content = "---\ndomain: api-layer\n";
        expect(extractFrontmatter(content)).toBeNull();
    });

    it("separates body correctly from frontmatter", () => {
        const content = "---\ndomain: auth\n---\nbody content here";
        const result = extractFrontmatter(content);
        expect(result!.body).toBe("body content here");
    });
});
