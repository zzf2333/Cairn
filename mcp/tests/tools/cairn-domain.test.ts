import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleCairnDomain } from "../../src/tools/cairn-domain.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

describe("handleCairnDomain", () => {
    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
    });

    it("returns contents of an existing domain file", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnDomain({ name: "api-layer" });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("domain: api-layer");
        expect(result.content[0]!.text).toContain("## current design");
        expect(result.content[0]!.text).toContain("## rejected paths");
    });

    it("returns the auth domain file", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnDomain({ name: "auth" });
        expect(result.isError).toBeUndefined();
        expect(result.content[0]!.text).toContain("domain: auth");
        expect(result.content[0]!.text).toContain("JWT");
    });

    it("returns isError for nonexistent domain with available domain list", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnDomain({ name: "nonexistent-domain" });
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("nonexistent-domain");
        // Should list available domains
        expect(result.content[0]!.text).toContain("api-layer");
    });

    it("returns isError for invalid domain name format", () => {
        process.env["CAIRN_ROOT"] = FIXTURES_DIR;

        const result = handleCairnDomain({ name: "InvalidDomain" });
        expect(result.isError).toBe(true);
        expect(result.content[0]!.text).toContain("Invalid domain name");
    });

    it("returns isError when .cairn/ does not exist", () => {
        const noProject = join(tmpdir(), "no-cairn-" + Date.now());
        mkdirSync(noProject);
        process.env["CAIRN_ROOT"] = noProject;

        const result = handleCairnDomain({ name: "api-layer" });
        expect(result.isError).toBe(true);
        rmSync(noProject, { recursive: true });
    });
});
