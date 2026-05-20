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
            recentSessions,
        ] = await Promise.all([
            ctx.bloodStore.loadAll(),
            ctx.stagedStore.loadAll(),
            ctx.skeletonStore.loadAll(),
            ctx.dnaStore.loadIdentity(),
            ctx.dnaStagedStore.findPending(),
            ctx.stateStore.load(),
            ctx.governanceStore.loadAuditLog(),
            ctx.sessionStore.loadRecent(10),
        ]);

        const inactiveCount = bloodEvents.filter(e => e.health.state === "stale" || e.health.state === "archived").length;
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
                inactive: inactiveCount,
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
            compliance: (() => {
                const withCompliance = recentSessions.filter(s => s.compliance);
                if (withCompliance.length === 0) return { sessions_analyzed: 0, message: "no compliance data yet" };
                const total = withCompliance.length;
                const contextCount = withCompliance.filter(s => s.compliance!.context_loaded).length;
                const planCount = withCompliance.filter(s => s.compliance!.plan_called).length;
                const observeCount = withCompliance.filter(s => s.compliance!.observe_called).length;
                const totalSignals = withCompliance.reduce((sum, s) => sum + s.compliance!.signals_count, 0);
                const totalDegraded = withCompliance.reduce((sum, s) => sum + s.compliance!.degraded_signals_count, 0);
                return {
                    sessions_analyzed: total,
                    context_rate: `${Math.round((contextCount / total) * 100)}%`,
                    plan_rate: `${Math.round((planCount / total) * 100)}%`,
                    observe_rate: `${Math.round((observeCount / total) * 100)}%`,
                    signal_avg: Math.round((totalSignals / total) * 10) / 10,
                    degraded_rate: totalSignals > 0
                        ? `${Math.round((totalDegraded / totalSignals) * 100)}%`
                        : "0%",
                };
            })(),
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
