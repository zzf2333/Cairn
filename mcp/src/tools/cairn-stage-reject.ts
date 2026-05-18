import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleStageReject(
    ctx: CairnContext,
    args: { id: string; reason: string },
) {
    const entry = await ctx.stagedStore.load(args.id);
    if (!entry) {
        return formatToolError(new Error(`Staged entry "${args.id}" not found`));
    }

    await ctx.stagedStore.remove(entry.id);

    await ctx.governanceEngine.logAudit({
        time: new Date().toISOString(),
        action: "rejected",
        target: entry.draft_event.id,
        actor: "human",
        reason: args.reason,
    });

    return toolResult(JSON.stringify({
        success: true,
        governance_logged: true,
    }, null, 2));
}
