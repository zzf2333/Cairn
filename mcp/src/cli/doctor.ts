import { createContext } from "../context.js";
import type { ConsistencyReport } from "../engines/index.js";

export async function runDoctor(): Promise<void> {
    const ctx = await createContext(process.cwd());

    const cognitiveMode = await ctx.governanceEngine.getCognitiveMode();

    const [report, decayActions, resurrectionCandidates] = await Promise.all([
        ctx.consistencyEngine.runAll(),
        ctx.decayEngine.checkDecay(cognitiveMode),
        ctx.resurrectionEngine.checkResurrection(),
    ]);

    let hasViolations = false;

    console.log("=== Consistency Checks ===");
    for (const key of Object.keys(report) as (keyof ConsistencyReport)[]) {
        if (key === "overall") continue;
        const result = report[key];
        if (typeof result !== "object" || !("passed" in result)) continue;

        const status = result.passed ? "PASS" : "FAIL";
        console.log(`  ${key}: ${status}`);
        for (const v of result.violations) {
            hasViolations = true;
            console.log(`    - ${v.description}`);
            console.log(`      recommendation: ${v.recommendation}`);
        }
    }
    console.log(`  Overall: ${report.overall}`);

    if (decayActions.length > 0) {
        console.log("\n=== Decay Actions ===");
        for (const action of decayActions) {
            console.log(`  ${action.event_id}: ${action.action} — ${action.reason}`);
        }
    }

    if (resurrectionCandidates.length > 0) {
        console.log("\n=== Resurrection Candidates ===");
        for (const candidate of resurrectionCandidates) {
            console.log(`  ${candidate.event_id}: ${candidate.reason}`);
            console.log(`    ${candidate.recommendation} (${candidate.governance})`);
        }
    }

    if (hasViolations) {
        process.exit(1);
    }
}
