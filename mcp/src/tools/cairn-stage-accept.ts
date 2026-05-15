import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleStageAccept(
    ctx: CairnContext,
    args: { id: string },
) {
    const entry = await ctx.stagedStore.load(args.id);
    if (!entry) {
        return formatToolError(new Error(`Staged entry "${args.id}" not found`));
    }

    await ctx.bloodEngine.commit(entry.draft_event);

    entry.review_status = "accepted";
    await ctx.stagedStore.save(entry);

    await ctx.governanceEngine.logAudit({
        time: new Date().toISOString(),
        action: "ratified",
        target: entry.draft_event.id,
        actor: "human",
    });

    await ctx.viewsEngine.regenerate();

    return toolResult(JSON.stringify({
        success: true,
        moved_to: "blood",
        views_regenerated: true,
        governance_logged: true,
    }, null, 2));
}
