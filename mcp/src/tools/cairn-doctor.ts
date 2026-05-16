import type { CairnContext } from "../context.js";
import { toolResult } from "../errors.js";

export async function handleDoctor(
    ctx: CairnContext,
) {
    const cognitiveMode = await ctx.governanceEngine.getCognitiveMode();

    const [consistencyReport, decayActions, resurrectionCandidates] = await Promise.all([
        ctx.consistencyEngine.runAll(),
        ctx.decayEngine.checkDecay(cognitiveMode),
        ctx.resurrectionEngine.checkResurrection(),
    ]);

    const [stagedCount, traumaEvents, policy, dnaIdentity] = await Promise.all([
        ctx.stagedStore.count(),
        ctx.bloodStore.findTrauma(),
        ctx.governanceStore.loadPolicy(),
        ctx.dnaStore.loadIdentity(),
    ]);

    const driftCounts: Record<string, number> = {};
    for (const [name, trait] of Object.entries(dnaIdentity.traits)) {
        if (trait.drift_warning_count > 0) {
            driftCounts[name] = trait.drift_warning_count;
        }
    }

    const pendingGovernance = await ctx.stagedStore.findPending();
    const governancePendingCount = pendingGovernance.filter(
        e => e.governance_required === "human_ratified",
    ).length;

    const unratifiedTrauma: string[] = [];
    for (const event of traumaEvents) {
        if (event.governance_status !== "ratified") {
            unratifiedTrauma.push(`${event.id}: ${event.subject.name}`);
        }
    }

    const issues: string[] = [];

    if (consistencyReport.overall !== "consistent") {
        for (const key of Object.keys(consistencyReport) as (keyof typeof consistencyReport)[]) {
            if (key === "overall") continue;
            const result = consistencyReport[key];
            if (typeof result === "object" && "violations" in result) {
                for (const v of result.violations) {
                    issues.push(`[${v.rule}] ${v.description}`);
                }
            }
        }
    }

    if (decayActions.length > 0) {
        for (const action of decayActions) {
            issues.push(`[decay] ${action.event_id}: ${action.reason} (${action.action})`);
        }
    }

    if (unratifiedTrauma.length > 0) {
        issues.push(`${unratifiedTrauma.length} trauma event(s) not yet ratified`);
    }

    if (governancePendingCount > 0) {
        issues.push(`${governancePendingCount} entry/entries pending human ratification`);
    }

    if (dnaIdentity.reevaluation_mode) {
        issues.push("DNA is in reevaluation_mode — traits no longer modulating routing/challenges");
    }

    for (const [traitName, count] of Object.entries(driftCounts)) {
        issues.push(`DNA trait "${traitName}" has ${count} unresolved drift warning(s)`);
    }

    const result = {
        consistency: consistencyReport,
        health: {
            decay_actions: decayActions,
            resurrection_candidates: resurrectionCandidates,
            unratified_trauma: unratifiedTrauma,
        },
        staged: {
            total: stagedCount,
            governance_pending: governancePendingCount,
        },
        dna: {
            reevaluation_mode: dnaIdentity.reevaluation_mode,
            drift_warning_counts: driftCounts,
        },
        cognitive_mode: policy.cognitive_mode,
        issues_count: issues.length,
        issues,
    };

    return toolResult(JSON.stringify(result, null, 2));
}
