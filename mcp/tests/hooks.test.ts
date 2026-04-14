import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildHooksIndex, matchKeywords } from "../src/hooks.js";
import { resolvePaths } from "../src/paths.js";

const FIXTURES_DOMAINS_DIR = join(
    import.meta.dirname,
    "fixtures/.cairn/domains",
);

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

describe("buildHooksIndex", () => {
    it("builds an index from the fixture domain files", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);

        expect(index.domainHooks.size).toBeGreaterThanOrEqual(3);
        expect(index.keywordToDomains.size).toBeGreaterThan(0);
    });

    it("maps api keyword to api-layer domain", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        const domains = index.keywordToDomains.get("api");
        expect(domains).toContain("api-layer");
    });

    it("maps trpc keyword to api-layer (case-insensitive key)", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        // Hooks contain "tRPC", stored as lowercase "trpc"
        const domains = index.keywordToDomains.get("trpc");
        expect(domains).toContain("api-layer");
    });

    it("maps auth keyword to auth domain", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        const domains = index.keywordToDomains.get("auth");
        expect(domains).toContain("auth");
    });

    it("maps zustand keyword to state-management domain", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        const domains = index.keywordToDomains.get("zustand");
        expect(domains).toContain("state-management");
    });

    it("returns empty index for a directory with no domain files", () => {
        const index = buildHooksIndex("/nonexistent/path");
        expect(index.keywordToDomains.size).toBe(0);
        expect(index.domainHooks.size).toBe(0);
    });
});

describe("matchKeywords", () => {
    it("matches a single keyword to its domain", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        const matches = matchKeywords(index, ["api"]);
        expect(matches.has("api-layer")).toBe(true);
        expect(matches.get("api-layer")).toContain("api");
    });

    it("matches multiple keywords across domains", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        const matches = matchKeywords(index, ["api", "JWT"]);

        expect(matches.has("api-layer")).toBe(true);
        expect(matches.has("auth")).toBe(true);
    });

    it("performs case-insensitive matching for keywords", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        // "API" (uppercase) should match the "api" hook
        const matches = matchKeywords(index, ["API"]);
        expect(matches.has("api-layer")).toBe(true);
    });

    it("returns empty map for keywords with no matches", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        const matches = matchKeywords(index, ["nonexistent-keyword"]);
        expect(matches.size).toBe(0);
    });

    it("collects all matched keywords per domain", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        const matches = matchKeywords(index, ["api", "endpoint", "REST"]);

        const apiLayerMatches = matches.get("api-layer") ?? [];
        expect(apiLayerMatches).toContain("api");
        expect(apiLayerMatches).toContain("endpoint");
        expect(apiLayerMatches).toContain("REST");
    });

    it("does not duplicate keywords in matched list", () => {
        const index = buildHooksIndex(FIXTURES_DOMAINS_DIR);
        // Passing same keyword twice should not duplicate it in results
        const matches = matchKeywords(index, ["api", "api"]);
        const apiLayerMatches = matches.get("api-layer") ?? [];
        const apiCount = apiLayerMatches.filter((k) => k === "api").length;
        expect(apiCount).toBe(1);
    });
});

describe("buildHooksIndex — domainRelated", () => {
    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
    });

    it("populates domainRelated from api-layer fixture", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        expect(index.domainRelated.get("api-layer")).toEqual(["auth"]);
    });

    it("returns empty array for domain without related field", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        // auth.md in fixtures has no related field
        expect(index.domainRelated.get("auth")).toEqual([]);
    });
});
