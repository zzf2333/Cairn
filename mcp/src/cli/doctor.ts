import { createContext } from "../context.js";
import type { ConsistencyReport } from "../engines/index.js";

export async function runDoctor(args: string[] = []): Promise<void> {
    const flags = new Set(args);
    const ctx = await createContext(process.cwd());

    if (flags.has("--metrics")) {
        await runMetrics(ctx);
        return;
    }

    if (flags.has("--recover")) {
        await runRecover(ctx);
        return;
    }

    if (flags.has("--fix")) {
        await runFix(ctx);
        return;
    }

    await runStandard(ctx);
}

async function runStandard(ctx: Awaited<ReturnType<typeof createContext>>): Promise<void> {
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

    const state = await ctx.stateStore.load();
    if (state.session_in_progress) {
        console.log("\n=== Incomplete Session ===");
        console.log(`  started_at: ${state.session_in_progress.started_at}`);
        console.log(`  last step:  ${state.session_in_progress.step}`);
        console.log("  hint: run 'cairn doctor --recover' to clear");
    }

    if (hasViolations) {
        process.exit(1);
    }
}

async function runFix(ctx: Awaited<ReturnType<typeof createContext>>): Promise<void> {
    console.log("=== Scanning for corruption ===");
    const report = await ctx.recoveryEngine.scan();
    console.log(`Scanned ${report.scanned} yaml files, found ${report.corruptions.length} corruption(s).`);
    if (report.corruptions.length === 0) return;

    for (const c of report.corruptions) {
        console.log(`  [${c.kind}] ${c.path}`);
        console.log(`    ${c.message}`);
    }

    console.log("\n=== Quarantining ===");
    const fixed = await ctx.recoveryEngine.fix(report);
    if (fixed.quarantined.length > 0) {
        console.log(`Moved ${fixed.quarantined.length} file(s) to quarantine:`);
        for (const q of fixed.quarantined) console.log(`  ${q}`);
    }

    const orphans = report.corruptions.filter(c => c.kind === "orphan_skeleton_ref");
    if (orphans.length > 0) {
        console.log(`\n${orphans.length} orphan skeleton ref(s) reported but not auto-fixed:`);
        for (const o of orphans) {
            console.log(`  ${o.path} — ${o.message}`);
        }
        console.log("Fix manually by either adding the skeleton node or deleting the orphan blood file.");
    }
}

async function runRecover(ctx: Awaited<ReturnType<typeof createContext>>): Promise<void> {
    console.log("=== Recovering incomplete session ===");
    const result = await ctx.recoveryEngine.recoverSession();
    if (!result.recovered) {
        console.log("No incomplete session to recover.");
        return;
    }
    console.log(`Cleared checkpoint:`);
    console.log(`  started_at: ${result.previous_checkpoint!.started_at}`);
    console.log(`  last step:  ${result.previous_checkpoint!.step}`);
    console.log("Note: session_end did not finish, so its side effects (git scan, decay, calibration,");
    console.log("compression, views regen) were partial. Re-run cairn_session_end to complete.");
}

async function runMetrics(ctx: Awaited<ReturnType<typeof createContext>>): Promise<void> {
    const [blood, dna, staged, state, dnaStaged] = await Promise.all([
        ctx.bloodStore.loadAll(),
        ctx.dnaStore.loadIdentity(),
        ctx.stagedStore.findPending(),
        ctx.stateStore.load(),
        ctx.dnaStagedStore.loadAll(),
    ]);

    const archived = blood.filter(e => e.health.state === "stale").length;
    const active = blood.filter(e => e.health.state === "ok" || e.health.state === "resurrected").length;
    const traumaCount = blood.filter(e => e.trauma.is_trauma).length;

    const traitsByLevel: Record<string, number> = {};
    for (const trait of Object.values(dna.traits)) {
        traitsByLevel[trait.level] = (traitsByLevel[trait.level] ?? 0) + 1;
    }

    const lastSessionAt = state.last_session.ended_at;
    const sessionAge = lastSessionAt
        ? `${Math.floor((Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24))} days ago`
        : "never";

    console.log(".cairn health:");
    console.log(`  cairn_version:       ${state.cairn_version ?? "(unstamped)"}`);
    console.log(`  blood events:        ${blood.length} (${active} active, ${archived} archived, ${traumaCount} trauma)`);
    console.log(`  DNA identity:        ${dna.status}`);
    console.log(`  DNA traits:          ${Object.keys(dna.traits).length} (${Object.entries(traitsByLevel).map(([s, n]) => `${n} ${s}`).join(", ") || "none"})`);
    console.log(`  DNA reevaluation:    ${dna.reevaluation_mode ? "ACTIVE" : "off"}`);
    console.log(`  DNA staged candid.:  ${dnaStaged.length}`);
    console.log(`  staged backlog:      ${staged.length}`);
    console.log(`  last session_end:    ${sessionAge}`);
    console.log(`  stage:               ${state.stage.phase} (confidence ${state.stage.confidence.toFixed(2)}, ${state.stage.status})`);
    if (state.session_in_progress) {
        console.log(`  session_in_progress: YES (started ${state.session_in_progress.started_at}, step ${state.session_in_progress.step})`);
    }
}
