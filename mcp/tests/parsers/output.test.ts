import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    extractLockedDomains,
    parseOutput,
} from "../../src/parsers/output.js";

const FIXTURE_OUTPUT = join(
    import.meta.dirname,
    "../fixtures/.cairn/output.md",
);

const SAMPLE_OUTPUT = [
    "## stage",
    "",
    "phase: early-growth (2024-09+)",
    "mode: stability > speed > elegance",
    "team: 2, no-ops",
    "reject-if: migration > 1 week",
    "",
    "## no-go",
    "",
    "- tRPC (REST client migration cost too high)",
    "- Redux (boilerplate overhead)",
    "",
    "## hooks",
    "",
    "planning / designing / suggesting for:",
    "",
    "- api / endpoint / tRPC → read domains/api-layer.md first",
    "- auth / login / JWT → read domains/auth.md first",
    "",
    "## stack",
    "",
    "state: Zustand",
    "api: REST + OpenAPI",
    "",
    "## debt",
    "",
    "AUTH-COUPLING: accepted | fix when team>4 or MAU>100k | no refactor now",
].join("\n");

describe("parseOutput", () => {
    it("extracts all five sections", () => {
        const sections = parseOutput(SAMPLE_OUTPUT);
        expect(sections.stage).toContain("phase: early-growth");
        expect(sections.nogo).toContain("tRPC");
        expect(sections.hooks).toContain("api-layer");
        expect(sections.stack).toContain("Zustand");
        expect(sections.debt).toContain("AUTH-COUPLING");
    });

    it("preserves raw content", () => {
        const sections = parseOutput(SAMPLE_OUTPUT);
        expect(sections.raw).toBe(SAMPLE_OUTPUT);
    });

    it("returns empty string for missing sections", () => {
        const sections = parseOutput("## stage\n\nphase: test");
        expect(sections.nogo).toBe("");
        expect(sections.hooks).toBe("");
        expect(sections.stack).toBe("");
        expect(sections.debt).toBe("");
    });

    it("parses the real fixture output.md", () => {
        const content = readFileSync(FIXTURE_OUTPUT, "utf-8");
        const sections = parseOutput(content);

        expect(sections.stage).toContain("phase: early-growth");
        expect(sections.stage).toContain("mode: stability");
        expect(sections.nogo).toContain("tRPC");
        expect(sections.nogo).toContain("kubernetes");
        expect(sections.hooks).toContain("api-layer");
        expect(sections.hooks).toContain("auth");
        expect(sections.stack).toContain("Zustand");
        expect(sections.stack).toContain("PostgreSQL");
        expect(sections.debt).toContain("AUTH-COUPLING");
        expect(sections.debt).toContain("WS-CONCURRENCY");
    });
});

describe("extractLockedDomains", () => {
    it("extracts domain names from hooks section", () => {
        const domains = extractLockedDomains(SAMPLE_OUTPUT);
        expect(domains).toContain("api-layer");
        expect(domains).toContain("auth");
        expect(domains).toHaveLength(2);
    });

    it("returns empty array if no hooks present", () => {
        const domains = extractLockedDomains("## hooks\n\nno domains here");
        expect(domains).toEqual([]);
    });

    it("extracts all 4 domains from the real fixture", () => {
        const content = readFileSync(FIXTURE_OUTPUT, "utf-8");
        const domains = extractLockedDomains(content);

        expect(domains).toContain("api-layer");
        expect(domains).toContain("auth");
        expect(domains).toContain("state-management");
        // The fixture also has a database hook
        expect(domains.length).toBeGreaterThanOrEqual(3);
    });
});
