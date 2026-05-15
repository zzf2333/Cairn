import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleStatus(ctx: CairnContext) {
    try {
        const [
            bloodEvents,
            stagedEntries,
            skeletonNodes,
            dnaIdentity,
            state,
            auditLog,
        ] = await Promise.all([
            ctx.bloodStore.loadAll(),
            ctx.stagedStore.loadAll(),
            ctx.skeletonStore.loadAll(),
            ctx.dnaStore.loadIdentity(),
            ctx.stateStore.load(),
            ctx.governanceStore.loadAuditLog(),
        ]);

        const staleCount = bloodEvents.filter(e => e.health.state === "stale").length;
        const activeCount = bloodEvents.filter(
            e => e.health.state === "ok" || e.health.state === "resurrected",
        ).length;
        const traumaCount = bloodEvents.filter(e => e.trauma.is_trauma).length;

        const pendingStaged = stagedEntries.filter(e => e.review_status === "pending").length;

        const pendingGovernance = auditLog.filter(e => e.action === "auto_confirmed").length;

        return toolResult(JSON.stringify({
            initialization: state.initialization_status,
            stage: {
                phase: state.stage.phase,
                confidence: state.stage.confidence,
                status: state.stage.status,
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
            },
            skeleton: {
                nodes: skeletonNodes.length,
                domains: skeletonNodes.map(n => n.domain),
            },
            dna: {
                status: dnaIdentity.status,
                trait_count: Object.keys(dnaIdentity.traits).length,
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
