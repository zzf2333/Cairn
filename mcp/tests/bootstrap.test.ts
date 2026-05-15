import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse as yamlParse } from "yaml";
import { simpleGit } from "simple-git";
import { bootstrapCairnDir } from "../src/bootstrap.js";

function makeTempDir(suffix: string): string {
    const dir = join(tmpdir(), `cairn-test-bootstrap-${suffix}-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}

describe("bootstrapCairnDir", () => {
    const dirs: string[] = [];

    afterEach(() => {
        delete process.env["CAIRN_ROOT"];
        for (const dir of dirs) {
            rmSync(dir, { recursive: true, force: true });
        }
        dirs.length = 0;
    });

    it("creates .cairn/ directory structure", async () => {
        const dir = makeTempDir("dirs");
        dirs.push(dir);

        const result = await bootstrapCairnDir(dir);

        expect(result.created).toBe(true);
        expect(existsSync(join(dir, ".cairn"))).toBe(true);
        expect(existsSync(join(dir, ".cairn", "signals"))).toBe(true);
        expect(existsSync(join(dir, ".cairn", "staged"))).toBe(true);
        expect(existsSync(join(dir, ".cairn", "memory"))).toBe(true);
        expect(existsSync(join(dir, ".cairn", "views"))).toBe(true);
        expect(existsSync(join(dir, ".cairn", "views", "domains"))).toBe(true);
        expect(existsSync(join(dir, ".cairn", "sessions"))).toBe(true);
    });

    it("writes valid config.yaml", async () => {
        const dir = makeTempDir("config");
        dirs.push(dir);

        await bootstrapCairnDir(dir);

        const raw = readFileSync(join(dir, ".cairn", "config.yaml"), "utf-8");
        const config = yamlParse(raw);
        expect(config.version).toBe("2.0");
        expect(config.project.name).toBeTruthy();
        expect(config.project.created).toMatch(/^\d{4}-\d{2}$/);
        expect(config.domains.locked).toEqual([]);
        expect(config.trust_policy.L3_auto_write).toHaveLength(2);
    });

    it("writes valid state.yaml", async () => {
        const dir = makeTempDir("state");
        dirs.push(dir);

        await bootstrapCairnDir(dir);

        const raw = readFileSync(join(dir, ".cairn", "state.yaml"), "utf-8");
        const state = yamlParse(raw);
        expect(state.last_session_commit).toBeNull();
        expect(state.stage.phase).toBe("growth");
        expect(state.stage.confidence).toBe(0.4);
        expect(state.stage.status).toBe("advisory");
    });

    it("is idempotent — does not overwrite existing .cairn/", async () => {
        const dir = makeTempDir("idempotent");
        dirs.push(dir);

        mkdirSync(join(dir, ".cairn"), { recursive: true });
        const marker = "custom-content";
        writeFileSync(join(dir, ".cairn", "marker.txt"), marker);

        const result = await bootstrapCairnDir(dir);

        expect(result.created).toBe(false);
        expect(readFileSync(join(dir, ".cairn", "marker.txt"), "utf-8")).toBe(marker);
    });

    it("detects project name from package.json", async () => {
        const dir = makeTempDir("pkg");
        dirs.push(dir);
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "my-cool-app" }));

        const result = await bootstrapCairnDir(dir);

        expect(result.projectMeta.name).toBe("my-cool-app");
        expect(result.projectMeta.detected_from).toBe("package.json");
    });

    it("detects project name from Cargo.toml", async () => {
        const dir = makeTempDir("cargo");
        dirs.push(dir);
        writeFileSync(join(dir, "Cargo.toml"), '[package]\nname = "rust-app"\nversion = "0.1.0"');

        const result = await bootstrapCairnDir(dir);

        expect(result.projectMeta.name).toBe("rust-app");
        expect(result.projectMeta.detected_from).toBe("Cargo.toml");
    });

    it("falls back to directory name", async () => {
        const dir = makeTempDir("fallback");
        dirs.push(dir);

        const result = await bootstrapCairnDir(dir);

        expect(result.projectMeta.detected_from).toBe("directory");
    });

    it("handles non-git directory gracefully", async () => {
        const dir = makeTempDir("nogit");
        dirs.push(dir);

        const result = await bootstrapCairnDir(dir);

        expect(result.created).toBe(true);
        expect(result.gitSummary).toBeNull();
    });

    it("returns correct paths", async () => {
        const dir = makeTempDir("paths");
        dirs.push(dir);

        const result = await bootstrapCairnDir(dir);

        expect(result.paths.root).toBe(dir);
        expect(result.paths.cairnDir).toBe(join(dir, ".cairn"));
        expect(result.paths.configYaml).toBe(join(dir, ".cairn", "config.yaml"));
    });

    it("uses CAIRN_ROOT env var when set", async () => {
        const dir = makeTempDir("envroot");
        dirs.push(dir);
        process.env["CAIRN_ROOT"] = dir;

        const result = await bootstrapCairnDir("/some/other/path");

        expect(result.paths.root).toBe(dir);
    });

    it("writes git signals directly to memory during bootstrap", async () => {
        const dir = makeTempDir("memory-pop");
        dirs.push(dir);

        const git = simpleGit(dir);
        await git.init();
        await git.addConfig("user.email", "test@test.com");
        await git.addConfig("user.name", "Test");

        writeFileSync(join(dir, "package.json"), JSON.stringify({
            name: "test-proj", version: "1.0.0",
            dependencies: { lodash: "^4.0.0" },
        }));
        await git.add(".");
        await git.commit("init");

        writeFileSync(join(dir, "package.json"), JSON.stringify({
            name: "test-proj", version: "1.0.0", dependencies: {},
        }));
        await git.add(".");
        await git.commit("remove lodash");

        writeFileSync(join(dir, "feature.txt"), "x");
        await git.add(".");
        await git.commit("add feature");
        await git.revert("HEAD", { "--no-edit": null });

        const result = await bootstrapCairnDir(dir);

        expect(result.created).toBe(true);
        expect(result.gitSummary?.auto_signals_routed).toBeGreaterThan(0);

        const memFiles = readdirSync(join(dir, ".cairn", "memory"))
            .filter(f => f.endsWith(".yaml"));
        expect(memFiles.length).toBeGreaterThan(0);

        const stagedFiles = readdirSync(join(dir, ".cairn", "staged"))
            .filter(f => f.endsWith(".yaml"));
        expect(stagedFiles.length).toBe(0);

        const output = readFileSync(join(dir, ".cairn", "views", "output.md"), "utf-8");
        expect(output).toContain("no-go");
    }, 30000);
});
