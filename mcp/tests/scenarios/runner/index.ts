#!/usr/bin/env node
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { discoverScenarios } from "./discover.js";
import { buildFixture, loadFixtureSpec } from "./fixture-builder.js";
import { startMcp } from "./mcp-bridge.js";
import { loadExpected, evaluate, allPassed, getPlatformOverride } from "./assertions.js";
import { printResult, printSummary } from "./reporter.js";
import { runClaudeCode } from "./platform-claude-code.js";
import { runCodex } from "./platform-codex.js";
import { runClaudeCodeCli } from "./platform-claude-code-cli.js";
import { runCodexCli } from "./platform-codex-cli.js";
import type { Platform, RunRecord, ScenarioResult, ScenarioSpec } from "./types.js";

type Driver = "cli" | "sdk";

interface CliOptions {
    filter?: string;
    platforms: Platform[];
    saveLogs: boolean;
    bail: boolean;
    driver: Driver;
}

function parseCli(argv: string[]): CliOptions {
    const opts: CliOptions = {
        platforms: ["claude-code", "codex"],
        saveLogs: true,
        bail: false,
        driver: (process.env.CAIRN_SCENARIO_DRIVER as Driver) ?? "cli",
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--platform" || a === "-p") {
            const v = argv[++i];
            opts.platforms = v.split(",").map((s) => s.trim()) as Platform[];
        } else if (a === "--driver") {
            opts.driver = argv[++i] as Driver;
        } else if (a === "--no-logs") {
            opts.saveLogs = false;
        } else if (a === "--bail") {
            opts.bail = true;
        } else if (!a.startsWith("-")) {
            opts.filter = a;
        }
    }
    if (opts.driver !== "cli" && opts.driver !== "sdk") {
        throw new Error(`unknown --driver '${opts.driver}', expected cli or sdk`);
    }
    return opts;
}

async function runOnePlatform(
    scenario: ScenarioSpec,
    platform: Platform,
    driver: Driver,
    saveLogs: boolean,
): Promise<ScenarioResult> {
    const tmp = await mkdtemp(join(tmpdir(), `cairn-scenario-${scenario.id}-${platform}-`));
    const mcpServerPath = resolve(import.meta.dirname, "../../../dist/index.js");
    try {
        if (existsSync(scenario.fixturePath)) {
            const spec = await loadFixtureSpec(scenario.fixturePath);
            await buildFixture(tmp, spec);
        }

        const promptRaw = await readFile(scenario.promptPath, "utf8");
        const userTurns = parsePromptTurns(promptRaw);
        const expected = await loadExpected(scenario.expectedPath);
        const override = getPlatformOverride(expected, platform);

        if (override?.skip) {
            return {
                scenarioId: scenario.id,
                platform,
                passed: true,
                skipped: true,
                skip_reason: override.skip_reason,
                assertions: [],
                run: {
                    scenarioId: scenario.id, platform, model: "(skipped)",
                    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
                    duration_ms: 0, tool_calls: [], assistant_text: "", user_turns: [], raw_messages: [],
                },
            };
        }

        let run: RunRecord;
        try {
            if (driver === "cli") {
                // CLI driver — each CLI spawns its own MCP server via inline config.
                if (platform === "claude-code") {
                    run = await runClaudeCodeCli({
                        scenarioId: scenario.id,
                        userTurns,
                        projectRoot: tmp,
                        mcpServerPath,
                    });
                } else {
                    run = await runCodexCli({
                        scenarioId: scenario.id,
                        userTurns,
                        projectRoot: tmp,
                        mcpServerPath,
                    });
                }
            } else {
                // SDK driver — we run the MCP server ourselves and bridge tool calls into the SDK.
                const bridge = await startMcp(tmp);
                try {
                    if (platform === "claude-code") {
                        run = await runClaudeCode({ bridge, scenarioId: scenario.id, userTurns });
                    } else {
                        run = await runCodex({ bridge, scenarioId: scenario.id, userTurns });
                    }
                } finally {
                    await bridge.close();
                }
            }
        } catch (e) {
            run = {
                scenarioId: scenario.id,
                platform,
                model: "(failed before model invocation)",
                started_at: new Date().toISOString(),
                finished_at: new Date().toISOString(),
                duration_ms: 0,
                tool_calls: [],
                assistant_text: "",
                user_turns: userTurns,
                raw_messages: [],
                error: (e as Error).message,
            };
        }

        const assertions = run.error ? [{ name: "driver", passed: false, detail: run.error }] : evaluate(run, expected);
        const assertionOverrides = override?.assertion_overrides ?? {};
        for (const a of assertions) {
            const ov = (a.id && assertionOverrides[a.id]) || assertionOverrides[a.name];
            if (!a.passed && ov?.allow_fail) {
                a.allowed_fail = true;
                a.allowed_fail_reason = ov.allow_fail_reason;
            }
        }
        const rawPassed = !run.error && allPassed(assertions);
        const allowedFail = !rawPassed && override?.allow_fail === true;
        const passed = rawPassed || allowedFail;

        if (saveLogs) {
            const logDir = resolve(import.meta.dirname, "../_runs", scenario.id);
            await mkdir(logDir, { recursive: true });
            await writeFile(
                join(logDir, `${platform}-${driver}.json`),
                JSON.stringify({ run, assertions, passed, driver, allowed_fail: allowedFail || undefined }, null, 2),
            );
        }
        return {
            scenarioId: scenario.id, platform, passed, assertions, run,
            ...(allowedFail ? { allowed_fail: true, allowed_fail_reason: override?.allow_fail_reason } : {}),
        };
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

function parsePromptTurns(raw: string): string[] {
    const lines = raw.split("\n");
    const turns: string[] = [];
    let current: string[] = [];
    let inUser = false;
    for (const ln of lines) {
        if (/^##\s*USER\b/i.test(ln)) {
            if (inUser && current.length > 0) turns.push(current.join("\n").trim());
            current = [];
            inUser = true;
            continue;
        }
        if (/^##\s+/.test(ln) && !/^##\s*USER\b/i.test(ln)) {
            if (inUser && current.length > 0) {
                turns.push(current.join("\n").trim());
                current = [];
            }
            inUser = false;
            continue;
        }
        if (inUser || turns.length === 0) current.push(ln);
    }
    if (current.length > 0 && (inUser || turns.length === 0)) {
        turns.push(current.join("\n").trim());
    }
    return turns.filter((t) => t.length > 0);
}

async function main(): Promise<void> {
    const opts = parseCli(process.argv.slice(2));
    const scenarios = await discoverScenarios(opts.filter);
    if (scenarios.length === 0) {
        console.error(`No scenarios matched filter '${opts.filter ?? "*"}'`);
        process.exit(1);
    }
    console.log(
        `Found ${scenarios.length} scenario(s); driver=${opts.driver}; platforms = [${opts.platforms.join(", ")}]`,
    );
    console.log("");

    const results: ScenarioResult[] = [];
    outer: for (const s of scenarios) {
        for (const p of opts.platforms) {
            const r = await runOnePlatform(s, p, opts.driver, opts.saveLogs);
            results.push(r);
            printResult(r);
            if (opts.bail && !r.passed) break outer;
        }
    }

    printSummary(results);
    const anyHardFail = results.some((r) => !r.passed && !r.skipped);
    process.exit(anyHardFail ? 1 : 0);
}

main().catch((e) => {
    console.error("Runner crashed:", e);
    process.exit(2);
});
