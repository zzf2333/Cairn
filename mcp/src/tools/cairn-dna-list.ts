import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleDnaList(ctx: CairnContext) {
    try {
        const pending = await ctx.dnaStagedStore.findPending();
        return toolResult(JSON.stringify({
            count: pending.length,
            candidates: pending.map(p => ({
                id: p.id,
                trait_name: p.trait_name,
                level: p.level,
                confidence: p.confidence,
                evidence_events: p.evidence_events,
                reasoning: p.reasoning,
                proposed_at: p.proposed_at,
            })),
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
