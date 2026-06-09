import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createTmpDir, cleanTmpDir, initTestRepo } from "../test-helpers.js";

const CLI = resolve(import.meta.dirname, "../../dist/cli/index.js");

let tmpDir: string;

function runCli(args: string[], cwd: string): { stdout: string; stderr: string; code: number } {
    const r = spawnSync(process.execPath, [CLI, ...args], {
        cwd,
        encoding: "utf-8",
        env: { ...process.env, CAIRN_ROOT: cwd },
    });
    return { stdout: r.stdout, stderr: r.stderr, code: r.status ?? -1 };
}

describe.skipIf(!existsSync(CLI))("CLI E2E smoke", () => {
    beforeEach(async () => {
        tmpDir = await createTmpDir();
        initTestRepo(tmpDir);
    });

    afterEach(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("--version exits 0", () => {
        const r = runCli(["--version"], tmpDir);
        expect(r.code).toBe(0);
        expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it("unknown command exits 1 with help on stdout", () => {
        const r = runCli(["nonexistent"], tmpDir);
        expect(r.code).toBe(1);
        expect(r.stderr).toContain("Unknown command");
    });

    it("init --empty exits 0 and creates .cairn/", () => {
        const r = runCli(["init", "--empty"], tmpDir);
        expect(r.code).toBe(0);
        expect(existsSync(resolve(tmpDir, ".cairn"))).toBe(true);
        expect(existsSync(resolve(tmpDir, ".cairn/config.yaml"))).toBe(true);
    });

    it("status before init prints not_initialized but does not crash", () => {
        const r = runCli(["status"], tmpDir);
        expect(r.code).toBe(0);
    });

    it("status after init exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["status"], tmpDir);
        expect(r.code).toBe(0);
    });

    it("doctor on empty .cairn/ exits 0 with no violations", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["doctor"], tmpDir);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("Consistency Checks");
    });

    it("doctor --metrics prints health snapshot", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["doctor", "--metrics"], tmpDir);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain(".cairn health");
        expect(r.stdout).toContain("blood events");
    });

    it("doctor --runtime-audit --json reports lifecycle coverage", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["doctor", "--runtime-audit", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.sessions.total).toBe(0);
        expect(data.compliance.context_rate).toBe(0);
        expect(data.evidence.missing_generated_event_evidence).toEqual([]);
        expect(data.evidence.missing_processed_archive).toEqual([]);
        expect(data.signals.processed_archive_total).toBe(0);
    });

    it("doctor --recover with no checkpoint exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["doctor", "--recover"], tmpDir);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("No incomplete session");
    });

    it("doctor --fix on clean .cairn/ exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["doctor", "--fix"], tmpDir);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain("Scanning for corruption");
    });

    it("migrate stamps cairn_version on first run", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["migrate"], tmpDir);
        expect(r.code).toBe(0);
        const status = runCli(["status"], tmpDir);
        expect(status.code).toBe(0);
    });

    it("review on empty .cairn/ exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["review"], tmpDir);
        expect(r.code).toBe(0);
    });

    it("audit on empty .cairn/ exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["audit"], tmpDir);
        expect(r.code).toBe(0);
    });

    it("dna show on empty .cairn/ exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["dna", "show"], tmpDir);
        expect(r.code).toBe(0);
    });

    it("skeleton show on empty .cairn/ exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["skeleton", "show"], tmpDir);
        expect(r.code).toBe(0);
    });

    it("stage list on empty .cairn/ exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["stage", "list"], tmpDir);
        expect(r.code).toBe(0);
    });

    it("a CLI crash never deletes .cairn/", () => {
        runCli(["init", "--empty"], tmpDir);
        runCli(["nonexistent-subcommand"], tmpDir);
        expect(existsSync(resolve(tmpDir, ".cairn"))).toBe(true);
        expect(existsSync(resolve(tmpDir, ".cairn/config.yaml"))).toBe(true);
    });

    it("context --json exits 0 and returns valid JSON with session", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["context", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.session).toBeDefined();
        expect(data.session.status).toBe("active");
    });

    it("context --task --json includes task context", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["context", "--task", "test task", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.session.status).toBe("active");
    });

    it("plan --json without context exits 1", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["plan", "--task", "test", "--json"], tmpDir);
        expect(r.code).toBe(1);
    });

    it("plan --json after context exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        runCli(["context", "--task", "setup", "--json"], tmpDir);
        const r = runCli(["plan", "--task", "test plan", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.task).toBe("test plan");
    });

    it("signal --json exits 0 with routing info", () => {
        runCli(["init", "--empty"], tmpDir);
        runCli(["context", "--json"], tmpDir);
        const r = runCli(["signal", "--type", "decision", "--what", "chose REST over GraphQL", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.accepted).toBe(true);
        expect(data.routing).toBeDefined();
    });

    it("observe --json exits 0", () => {
        runCli(["init", "--empty"], tmpDir);
        runCli(["context", "--json"], tmpDir);
        const r = runCli(["observe", "--summary", "test observe", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.observed).toBe(true);
    });

    it("session-end --json exits 0 and returns highlights", () => {
        runCli(["init", "--empty"], tmpDir);
        runCli(["context", "--json"], tmpDir);
        const r = runCli(["session-end", "--summary", "test session end", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.highlights).toBeDefined();
        expect(data.session).toBeDefined();
    });

    it("session-recover --json exits 0 when no stale session", () => {
        runCli(["init", "--empty"], tmpDir);
        const r = runCli(["session-recover", "--json"], tmpDir);
        expect(r.code).toBe(0);
        const data = JSON.parse(r.stdout);
        expect(data.recovered).toBe(false);
    });

    it("full runtime lifecycle via CLI: context → signal → observe → session-end", () => {
        runCli(["init", "--empty"], tmpDir);
        const ctx = runCli(["context", "--task", "lifecycle test", "--json"], tmpDir);
        expect(ctx.code).toBe(0);

        const sig = runCli(["signal", "--type", "decision", "--what", "test decision", "--json"], tmpDir);
        expect(sig.code).toBe(0);

        const obs = runCli(["observe", "--summary", "pre-commit check", "--json"], tmpDir);
        expect(obs.code).toBe(0);

        const end = runCli(["session-end", "--summary", "completed lifecycle", "--json"], tmpDir);
        expect(end.code).toBe(0);
        const endData = JSON.parse(end.stdout);
        expect(endData.session.context_was_loaded).toBe(true);
    });
});
