import type { CairnContext } from "../context.js";
import { toolResult } from "../errors.js";

export async function handleStageList(
    ctx: CairnContext,
) {
    const pending = await ctx.stagedStore.findPending();

    const items = pending.map(entry => ({
        id: entry.id,
        type: entry.draft_event.type,
        domain: entry.draft_event.domain,
        summary: entry.draft_event.decision_or_change,
        gravity: entry.gravity,
        confidence: entry.draft_event.source.confidence,
        governance_required: entry.governance_required,
        created_at: entry.created_at,
    }));

    return toolResult(JSON.stringify({ items, total: items.length }, null, 2));
}
