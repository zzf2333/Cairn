#!/usr/bin/env node
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { discoverScenarios } from "./discover.js";
import { buildFixture, loadFixtureSpec } from "./fixture-builder.js";
import { startMcp } from "./mcp-bridge.js";
import { loadExpected, evaluate, allPassed } from "./assertions.js";
import { printResult, printSummary } from "./reporter.js";
import { runClaudeCode } from "./platform-claude-code.js";
import { runCodex } from "./platform-codex.js";
import type { Platform, RunRecord, ScenarioResult, ScenarioSpec } from "./types.js";

interface CliOptions {
    filter?: string;
    platforms: Platform[];
    saveLogs: boolean;
    bail: boolean;
}

function parseCli(argv: string[]): CliOptions {
    const opts: CliOptions = { platforms: ["claude-code", "codex"], saveLogs: true, bail: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--platform" || a === "-p") {
            const v = argv[++i];
            opts.platforms = v.split(",").map((s) => s.trim()) as Platform[];
        } else if (a === "--no-logs") {
            opts.saveLogs = false;
        } else if (a === "--bail") {
            opts.bail = true;
        } else if (!a.startsWith("-")) {
            opts.filter = a;
        }
    }
    return opts;
}

async function runOnePlatform(
    scenario: ScenarioSpec,
    platform: Platform,
    saveLogs: boolean,
): Promise<ScenarioResult> {
    const tmp = await mkdtemp(join(tmpdir(), `cairn-scenario-${scenario.id}-${platform}-`));
    try {
        if (existsSync(scenario.fixturePath)) {
            const spec = await loadFixtureSpec(scenario.fixturePath);
            await buildFixture(tmp, spec);
        }
        // run with the MCP server pinned to tmp
        const bridge = await startMcp(tmp);
        try {
            const promptRaw = await readFile(scenario.promptPath, "utf8");
            const userTurns = parsePromptTurns(promptRaw);
            const expected = await loadExpected(scenario.expectedPath);

            let run: RunRecord;
            try {
                if (platform === "claude-code") {
                    run = await runClaudeCode({ bridge, scenarioId: scenario.id, userTurns });
                } else {
                    run = await runCodex({ bridge, scenarioId: scenario.id, userTurns });
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
            const passed = !run.error && allPassed(assertions);

            if (saveLogs) {
                const logDir = resolve(import.meta.dirname, "../_runs", scenario.id);
                await mkdir(logDir, { recursive: true });
                await writeFile(join(logDir, `${platform}.json`), JSON.stringify({ run, assertions, passed }, null, 2));
            }
            return { scenarioId: scenario.id, platform, passed, assertions, run };
        } finally {
            await bridge.close();
        }
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

function parsePromptTurns(raw: string): string[] {
    // Split prompt.md by lines starting with "## USER" to support multi-turn scenarios.
    // Single-turn prompts (no ## USER marker) are returned as one turn.
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
            // section like "## NOTES" — skip
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
    console.log(`Found ${scenarios.length} scenario(s); platforms = [${opts.platforms.join(", ")}]`);
    console.log("");

    const results: ScenarioResult[] = [];
    outer: for (const s of scenarios) {
        for (const p of opts.platforms) {
            const r = await runOnePlatform(s, p, opts.saveLogs);
            results.push(r);
            printResult(r);
            if (opts.bail && !r.passed) break outer;
        }
    }

    printSummary(results);
    const anyFail = results.some((r) => !r.passed);
    process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
    console.error("Runner crashed:", e);
    process.exit(2);
});
