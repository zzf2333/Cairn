import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleDnaReject(
    ctx: CairnContext,
    args: { id: string; reason: string },
) {
    try {
        const entry = await ctx.dnaStagedStore.load(args.id);
        if (!entry) {
            throw new Error(`DNA staged entry "${args.id}" not found`);
        }
        if (entry.review_status !== "pending") {
            throw new Error(`DNA staged entry "${args.id}" already ${entry.review_status}`);
        }

        const now = new Date().toISOString();
        entry.review_status = "rejected";
        await ctx.dnaStagedStore.save(entry);

        await ctx.governanceEngine.logAudit({
            time: now,
            action: "rejected",
            target: entry.id,
            actor: "human",
            reason: args.reason,
        });

        return toolResult(JSON.stringify({
            success: true,
            id: entry.id,
            trait_name: entry.trait_name,
            reason: args.reason,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
