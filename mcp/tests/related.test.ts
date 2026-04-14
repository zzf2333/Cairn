import { afterEach, describe, expect, it } from "vitest";
import { resolveRelated } from "../src/related.js";
import { buildHooksIndex } from "../src/hooks.js";
import { resolvePaths } from "../src/paths.js";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

describe("resolveRelated", () => {
    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
    });

    it("returns empty for domain with no related field", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        const result = resolveRelated("auth", index);
        expect(result.related).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    it("returns related domains that exist in the index", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        const result = resolveRelated("api-layer", index);
        expect(result.related).toContain("auth");
        expect(result.warnings).toEqual([]);
    });

    it("warns and skips related domains that do not exist", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        const result = resolveRelated("orphan-ref", index);
        expect(result.related).toEqual([]);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain("does-not-exist");
    });

    it("prevents self-reference (cycle defense)", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;
        const paths = resolvePaths();
        // Build a synthetic index with a self-reference
        const index = buildHooksIndex(paths.domainsDir);
        // Manually inject a cycle: api-layer related to itself
        index.domainRelated.set("auth", ["auth", "api-layer"]);
        const result = resolveRelated("auth", index);
        // "auth" (self) should be skipped; "api-layer" exists and is valid
        expect(result.related).not.toContain("auth");
        expect(result.related).toContain("api-layer");
    });

    it("truncates to maxRelated=2", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        // Inject 3 related domains for api-layer
        index.domainRelated.set("api-layer", ["auth", "state-management", "orphan-ref"]);
        const result = resolveRelated("api-layer", index, 2);
        expect(result.related).toHaveLength(2);
        expect(result.related[0]).toBe("auth");
        expect(result.related[1]).toBe("state-management");
    });
});
