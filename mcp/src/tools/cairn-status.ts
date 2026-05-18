import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleStatus(ctx: CairnContext) {
    try {
        const [
            bloodEvents,
            stagedEntries,
            skeletonNodes,
            dnaIdentity,
            dnaStagedPending,
            state,
            auditLog,
        ] = await Promise.all([
            ctx.bloodStore.loadAll(),
            ctx.stagedStore.loadAll(),
            ctx.skeletonStore.loadAll(),
            ctx.dnaStore.loadIdentity(),
            ctx.dnaStagedStore.findPending(),
            ctx.stateStore.load(),
            ctx.governanceStore.loadAuditLog(),
        ]);

        const staleCount = bloodEvents.filter(e => e.health.state === "stale" || e.health.state === "archived").length;
        const activeCount = bloodEvents.filter(
            e => e.health.state === "ok" || e.health.state === "resurrected",
        ).length;
        const traumaCount = bloodEvents.filter(e => e.trauma.is_trauma).length;

        const pendingStaged = stagedEntries.filter(e => e.review_status === "pending").length;
        const stageTransitionsPending = stagedEntries.filter(
            e => e.review_status === "pending" && e.draft_event.type === "stage_transition",
        ).length;

        const pendingGovernance = auditLog.filter(e => e.action === "auto_confirmed").length;

        const driftWarningTraits: Record<string, number> = {};
        for (const [name, trait] of Object.entries(dnaIdentity.traits)) {
            if (trait.drift_warning_count > 0) {
                driftWarningTraits[name] = trait.drift_warning_count;
            }
        }

        return toolResult(JSON.stringify({
            initialization: state.initialization_status,
            stage: {
                phase: state.stage.phase,
                confidence: state.stage.confidence,
                status: state.stage.status,
                last_updated: state.stage.last_updated ?? null,
            },
            blood: {
                total: bloodEvents.length,
                active: activeCount,
                stale: staleCount,
                trauma: traumaCount,
            },
            staged: {
                total: stagedEntries.length,
                pending: pendingStaged,
                stage_transitions_pending: stageTransitionsPending,
            },
            skeleton: {
                nodes: skeletonNodes.length,
                domains: skeletonNodes.map(n => n.domain),
            },
            dna: {
                status: dnaIdentity.status,
                trait_count: Object.keys(dnaIdentity.traits).length,
                reevaluation_mode: dnaIdentity.reevaluation_mode,
                pending_candidates: dnaStagedPending.length,
                drift_warning_traits: driftWarningTraits,
            },
            governance: {
                pending: pendingGovernance,
            },
            last_session: state.last_session,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
