import type { ScenarioResult } from "./types.js";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export function printResult(r: ScenarioResult): void {
    const tag = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    const time = `${r.run.duration_ms}ms`;
    console.log(`${tag} [${r.platform}] ${r.scenarioId} ${DIM}(${r.run.tool_calls.length} tool calls, ${time})${RESET}`);
    if (r.run.error) {
        console.log(`  ${RED}error: ${r.run.error}${RESET}`);
    }
    if (!r.passed) {
        for (const a of r.assertions) {
            if (!a.passed) {
                console.log(`    ${RED}✗${RESET} ${a.name}`);
                if (a.detail) console.log(`        ${DIM}${a.detail}${RESET}`);
            }
        }
    }
}

export function printSummary(results: ScenarioResult[]): void {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;
    console.log("");
    console.log(`${BOLD}Scenario summary:${RESET}`);
    console.log(`  total:  ${total}`);
    console.log(`  ${GREEN}passed: ${passed}${RESET}`);
    if (failed > 0) console.log(`  ${RED}failed: ${failed}${RESET}`);

    // group by scenario
    const byScenario = new Map<string, ScenarioResult[]>();
    for (const r of results) {
        const arr = byScenario.get(r.scenarioId) ?? [];
        arr.push(r);
        byScenario.set(r.scenarioId, arr);
    }
    console.log("");
    console.log(`${BOLD}By scenario:${RESET}`);
    for (const [id, rs] of [...byScenario.entries()].sort()) {
        const platforms = rs.map((r) => `${r.platform}=${r.passed ? GREEN + "✓" + RESET : RED + "✗" + RESET}`).join("  ");
        console.log(`  ${id}  ${platforms}`);
    }
}
