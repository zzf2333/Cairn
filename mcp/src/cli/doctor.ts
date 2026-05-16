import { createContext } from "../context.js";
import type { ConsistencyReport } from "../engines/index.js";

export async function runDoctor(): Promise<void> {
    const ctx = await createContext(process.cwd());

    const cognitiveMode = await ctx.governanceEngine.getCognitiveMode();

    const [report, decayActions, allCandidates, dnaIdentity] = await Promise.all([
        ctx.consistencyEngine.runAll(),
        ctx.decayEngine.checkDecay(cognitiveMode),
        ctx.resurrectionEngine.checkResurrection(),
        ctx.dnaStore.loadIdentity(),
    ]);

    const autoResurrected: string[] = [];
    const pendingCandidates: typeof allCandidates = [];
    for (const candidate of allCandidates) {
        if (candidate.governance === "system_validated") {
            try {
                await ctx.bloodEngine.resurrect(candidate.event_id);
                autoResurrected.push(candidate.event_id);
            } catch {
                pendingCandidates.push(candidate);
            }
        } else {
            pendingCandidates.push(candidate);
        }
    }

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

    if (autoResurrected.length > 0) {
        console.log("\n=== Auto-Resurrected ===");
        for (const id of autoResurrected) {
            console.log(`  ${id} (G0/G1, system_validated)`);
        }
    }

    if (pendingCandidates.length > 0) {
        console.log("\n=== Resurrection Candidates (pending human review) ===");
        for (const candidate of pendingCandidates) {
            console.log(`  ${candidate.event_id}: ${candidate.reason}`);
            console.log(`    ${candidate.recommendation} (${candidate.governance})`);
        }
    }

    if (dnaIdentity.reevaluation_mode) {
        console.log("\n=== DNA Reevaluation Mode ACTIVE ===");
        console.log("  Traits are not currently modulating routing/challenges.");
    }
    const driftEntries = Object.entries(dnaIdentity.traits)
        .filter(([, t]) => t.drift_warning_count > 0);
    if (driftEntries.length > 0) {
        console.log("\n=== DNA Drift Warnings ===");
        for (const [name, trait] of driftEntries) {
            console.log(`  ${name}: ${trait.drift_warning_count} unresolved warning(s)`);
        }
    }

    if (hasViolations) {
        process.exit(1);
    }
}
