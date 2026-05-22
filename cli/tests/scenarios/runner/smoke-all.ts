#!/usr/bin/env node
// Smoke-test ALL scenarios: build fixture, call a few read-only cairn commands,
// verify no errors. Does NOT invoke any LLM — purely tests the framework + fixtures.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { discoverScenarios } from "./discover.js";
import { buildFixture, loadFixtureSpec } from "./fixture-builder.js";
import { startCliBridge } from "./cli-bridge.js";

const PROBE_TOOLS = [
    { name: "cairn_init_status", args: {} },
    { name: "cairn_context", args: { task: "smoke" } },
    { name: "cairn_status", args: {} },
];

async function smokeOne(scenarioId: string, fixturePath: string): Promise<{ ok: boolean; error?: string }> {
    const tmp = await mkdtemp(join(tmpdir(), `cairn-smoke-${scenarioId}-`));
    try {
        if (existsSync(fixturePath)) {
            const spec = await loadFixtureSpec(fixturePath);
            await buildFixture(tmp, spec);
        }
        const bridge = await startCliBridge(tmp);
        try {
            for (const probe of PROBE_TOOLS) {
                const r = await bridge.callTool(probe.name, probe.args);
                if (r.isError) {
                    return { ok: false, error: `${probe.name} returned error: ${r.text.slice(0, 200)}` };
                }
            }
            return { ok: true };
        } finally {
            await bridge.close();
        }
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

async function main(): Promise<void> {
    const scenarios = await discoverScenarios();
    console.log(`Smoke-testing ${scenarios.length} scenarios...\n`);
    let pass = 0;
    let fail = 0;
    for (const s of scenarios) {
        const t0 = Date.now();
        const res = await smokeOne(s.id, s.fixturePath);
        const ms = Date.now() - t0;
        if (res.ok) {
            console.log(`  PASS  ${s.id.padEnd(4)}  (${ms}ms)  ${s.title}`);
            pass++;
        } else {
            console.log(`  FAIL  ${s.id.padEnd(4)}  ${s.title}`);
            console.log(`        ${res.error}`);
            fail++;
        }
    }
    console.log("");
    console.log(`Total: ${scenarios.length}, pass: ${pass}, fail: ${fail}`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error("smoke-all crashed:", e);
    process.exit(2);
});
