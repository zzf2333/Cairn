import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleContext(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const task = args.task as string | undefined;
        const files = args.files as string[] | undefined;

        const result = await ctx.activationEngine.activate({ task, files });

        const hint = await deriveInteractionHint(ctx, result);
        const payload = hint ? { ...result, interaction_hint: hint } : result;

        return toolResult(JSON.stringify(payload));
    } catch (error) {
        return formatToolError(error);
    }
}

async function deriveInteractionHint(
    ctx: CairnContext,
    result: { meta: { skeleton_nodes_activated: string[]; blood_events_scanned: number } }
): Promise<"needs_init" | "review_staged_first" | undefined> {
    const hasConfig = await ctx.configStore.exists();
    if (!hasConfig) return "needs_init";

    if (result.meta.skeleton_nodes_activated.length === 0 && result.meta.blood_events_scanned === 0) {
        const stagedCount = await ctx.stagedStore.count();
        if (stagedCount > 0) return "review_staged_first";
        return "needs_init";
    }

    return undefined;
}
