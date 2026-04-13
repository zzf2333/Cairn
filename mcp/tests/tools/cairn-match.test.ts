import { afterEach, describe, expect, it } from "vitest";
import { handleCairnMatch } from "../../src/tools/cairn-match.js";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

describe("handleCairnMatch", () => {
    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
    });

    it("matches api keyword to api-layer domain", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnMatch({ keywords: ["api"] });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("api-layer");
        expect(result.content[0]!.text).toContain("api");
    });

    it("matches JWT keyword to auth domain", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnMatch({ keywords: ["JWT"] });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("auth");
    });

    it("matches multiple keywords across domains", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnMatch({ keywords: ["api", "auth"] });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("api-layer");
        expect(result.content[0]!.text).toContain("auth");
    });

    it("is case-insensitive", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnMatch({ keywords: ["API"] });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("api-layer");
    });

    it("includes recommendation to call cairn_domain", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnMatch({ keywords: ["api"] });
        expect(result.content[0]!.text).toContain('cairn_domain("api-layer")');
    });

    it("returns informational message for unmatched keywords", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnMatch({ keywords: ["kubernetes"] });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("No domains matched");
    });

    it("returns isError for empty keywords array", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnMatch({ keywords: [] });
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("At least one keyword");
    });
});
