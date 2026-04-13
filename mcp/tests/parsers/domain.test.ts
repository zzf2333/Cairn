import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDomainFile } from "../../src/parsers/domain.js";

const FIXTURES_DIR = join(
    import.meta.dirname,
    "../fixtures/.cairn/domains",
);

describe("parseDomainFile", () => {
    it("parses frontmatter fields from a valid domain file", () => {
        const content = [
            "---",
            "domain: api-layer",
            'hooks: ["api", "endpoint", "tRPC", "GraphQL", "REST", "OpenAPI"]',
            "updated: 2024-03",
            "status: stable",
            "---",
            "",
            "# api-layer",
            "",
            "## current design",
        ].join("\n");

        const result = parseDomainFile(content);
        expect(result.frontmatter.domain).toBe("api-layer");
        expect(result.frontmatter.hooks).toEqual([
            "api",
            "endpoint",
            "tRPC",
            "GraphQL",
            "REST",
            "OpenAPI",
        ]);
        expect(result.frontmatter.updated).toBe("2024-03");
        expect(result.frontmatter.status).toBe("stable");
    });

    it("includes the full body after frontmatter", () => {
        const content = [
            "---",
            "domain: auth",
            'hooks: ["auth"]',
            "updated: 2024-06",
            "status: active",
            "---",
            "",
            "# auth",
            "",
            "## current design",
            "",
            "JWT + Refresh token rotation.",
        ].join("\n");

        const result = parseDomainFile(content);
        expect(result.body).toContain("# auth");
        expect(result.body).toContain("JWT + Refresh token rotation.");
    });

    it("preserves raw file content", () => {
        const content = "---\ndomain: auth\nhooks: []\nupdated: 2024-01\nstatus: stable\n---\nbody";
        const result = parseDomainFile(content);
        expect(result.raw).toBe(content);
    });

    it("throws if frontmatter is missing", () => {
        const content = "# api-layer\n\n## current design\n\nREST + OpenAPI.";
        expect(() => parseDomainFile(content)).toThrow("missing YAML frontmatter");
    });

    it("parses real api-layer fixture", () => {
        const content = readFileSync(
            join(FIXTURES_DIR, "api-layer.md"),
            "utf-8",
        );
        const result = parseDomainFile(content);

        expect(result.frontmatter.domain).toBe("api-layer");
        expect(result.frontmatter.hooks).toContain("api");
        expect(result.frontmatter.hooks).toContain("tRPC");
        expect(result.frontmatter.hooks).toContain("GraphQL");
        expect(result.frontmatter.updated).toBe("2024-03");
        expect(result.frontmatter.status).toBe("stable");
        expect(result.body).toContain("## current design");
        expect(result.body).toContain("## rejected paths");
    });

    it("parses real auth fixture", () => {
        const content = readFileSync(join(FIXTURES_DIR, "auth.md"), "utf-8");
        const result = parseDomainFile(content);

        expect(result.frontmatter.domain).toBe("auth");
        expect(result.frontmatter.hooks).toContain("auth");
        expect(result.frontmatter.hooks).toContain("JWT");
        expect(result.frontmatter.status).toBe("active");
    });

    it("parses real state-management fixture", () => {
        const content = readFileSync(
            join(FIXTURES_DIR, "state-management.md"),
            "utf-8",
        );
        const result = parseDomainFile(content);

        expect(result.frontmatter.domain).toBe("state-management");
        expect(result.frontmatter.hooks).toContain("Zustand");
        expect(result.frontmatter.hooks).toContain("Redux");
    });
});
