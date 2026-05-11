import type { CairnContext } from "../server.js";
import { toolResult } from "../errors.js";

export function handleCairnStatus(ctx: CairnContext) {
    const memories = ctx.memoryStore.loadAll();
    const staged = ctx.stagedStore.loadPending();
    const signals = ctx.signalStore.loadAll();
    const conflicts = ctx.memoryStore.findConflicts();
    const state = ctx.stateStore.load();

    // Detect stale domains: domains with no recent updates
    const domainUpdates = new Map<string, string>();
    for (const m of memories) {
        const existing = domainUpdates.get(m.domain);
        if (!existing || m.updated_at > existing) {
            domainUpdates.set(m.domain, m.updated_at);
        }
    }

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const staleDomains: string[] = [];
    for (const [domain, lastUpdate] of domainUpdates) {
        if (new Date(lastUpdate) < threeMonthsAgo) {
            staleDomains.push(domain);
        }
    }

    const result = {
        memory_count: memories.length,
        staged_count: staged.length,
        signals_count: signals.length,
        stale_domains: staleDomains,
        conflicts: conflicts.map((c) => ({
            id: c.id,
            domain: c.domain,
            reason: c.health.reason,
        })),
        last_git_scan: state.last_session_commit,
        stage: {
            phase: state.stage.phase,
            confidence: state.stage.confidence,
            status: state.stage.status,
        },
    };

    return toolResult(JSON.stringify(result, null, 2));
}
