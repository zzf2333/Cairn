#!/usr/bin/env node
// Smoke test for the scenario harness — exercises fixture-builder + MCP bridge
// against a real scenario directory, WITHOUT invoking any LLM. Use this to
// confirm the runtime works before spending API credits on real runs.
//
// Usage: tsx tests/scenarios/runner/smoke.ts [scenarioId]

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { discoverScenarios } from "./discover.js";
import { buildFixture, loadFixtureSpec } from "./fixture-builder.js";
import { startMcp } from "./mcp-bridge.js";

async function main(): Promise<void> {
    const filter = process.argv[2];
    const scenarios = await discoverScenarios(filter);
    if (scenarios.length === 0) {
        console.error(`no scenario matched '${filter ?? "*"}'`);
        process.exit(1);
    }
    const s = scenarios[0];
    console.log(`smoke testing ${s.id} (${s.title})`);

    const tmp = await mkdtemp(join(tmpdir(), "cairn-smoke-"));
    try {
        if (existsSync(s.fixturePath)) {
            const spec = await loadFixtureSpec(s.fixturePath);
            await buildFixture(tmp, spec);
            console.log(`  fixture built at ${tmp}/.cairn/`);
        } else {
            console.log("  no fixture.yaml — starting MCP against empty project");
        }
        const bridge = await startMcp(tmp);
        console.log(`  MCP bridge online; ${bridge.tools.length} tools exposed:`);
        for (const t of bridge.tools) console.log(`    - ${t.name}`);

        const ctxResult = await bridge.callTool("cairn_context", { task: "smoke" });
        console.log(`  cairn_context returned ${ctxResult.text.length} chars, isError=${ctxResult.is_error ?? false}`);
        console.log(`  ${ctxResult.text.slice(0, 400).replace(/\n/g, " ")}...`);

        await bridge.close();
        console.log("smoke OK");
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}

main().catch((e) => {
    console.error("smoke FAIL:", e);
    process.exit(2);
});
