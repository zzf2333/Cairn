import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { generateSessionId } from "./session-guard.js";

export async function handleContext(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const task = args.task as string | undefined;
        const files = args.files as string[] | undefined;

        const existing = await ctx.stateStore.getActiveSession();

        let recoveredFrom: { id: string; started_at: string; signals_count: number } | null = null;

        if (existing && existing.signals_count > 0) {
            recoveredFrom = {
                id: existing.id,
                started_at: existing.started_at,
                signals_count: existing.signals_count,
            };
            await ctx.stateStore.startSession({ id: generateSessionId(), task, files });
        } else if (existing) {
            await ctx.stateStore.touchSession({ task, files });
        } else {
            await ctx.stateStore.startSession({ id: generateSessionId(), task, files });
        }

        const result = await ctx.activationEngine.activate({ task, files });

        const hint = await deriveInteractionHint(ctx, result);
        const payload: Record<string, unknown> = hint ? { ...result, interaction_hint: hint } : { ...result };

        const hasConfig = await ctx.configStore.exists();
        if (hasConfig) {
            payload.observe_reminder = "Call cairn_observe before every git commit";
        }

        const activeSession = await ctx.stateStore.getActiveSession();
        payload.session = {
            id: activeSession!.id,
            status: "active",
            recovered_from: recoveredFrom,
        };

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
