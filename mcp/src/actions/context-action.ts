import type { CairnContext } from "../context.js";
import { SESSION_STALE_AFTER_MINUTES } from "../constants.js";
import { generateSessionId } from "../utils/session-guard.js";

export interface ContextArgs {
    task?: string;
    files?: string[];
}

export async function contextAction(ctx: CairnContext, args: ContextArgs): Promise<Record<string, unknown>> {
    const { task, files } = args;

    const existing = await ctx.stateStore.getActiveSession();

    if (existing && existing.signals_count > 0) {
        const minutesSinceTouch =
            (Date.now() - new Date(existing.last_touched_at).getTime()) / 60_000;

        if (minutesSinceTouch >= SESSION_STALE_AFTER_MINUTES) {
            return {
                session: {
                    id: existing.id,
                    status: "blocked_by_unclosed_session",
                    recovery_required: true,
                    required_action: "call cairn_session_recover before continuing",
                    unclosed_session: {
                        id: existing.id,
                        started_at: existing.started_at,
                        signals_count: existing.signals_count,
                        last_touched_at: existing.last_touched_at,
                    },
                },
            };
        }

        await ctx.stateStore.touchSession({ task, files });
        return buildActiveResponse(ctx, existing.id, task, files);
    }

    let currentSessionId: string;
    if (existing) {
        currentSessionId = existing.id;
        await ctx.stateStore.touchSession({ task, files });
    } else {
        currentSessionId = generateSessionId();
        await ctx.stateStore.startSession({ id: currentSessionId, task, files });
    }

    return buildActiveResponse(ctx, currentSessionId, task, files);
}

async function buildActiveResponse(
    ctx: CairnContext,
    sessionId: string,
    task?: string,
    files?: string[],
): Promise<Record<string, unknown>> {
    const result = await ctx.activationEngine.activate({ task, files });
    const hint = await deriveInteractionHint(ctx, result);
    const payload: Record<string, unknown> = hint
        ? { ...result, interaction_hint: hint }
        : { ...result };

    const hasConfig = await ctx.configStore.exists();
    if (hasConfig) {
        payload.observe_reminder = "Call cairn_observe before every git commit";
    }

    payload.session = {
        id: sessionId,
        status: "active",
    };

    return payload;
}

async function deriveInteractionHint(
    ctx: CairnContext,
    result: { meta: { skeleton_nodes_activated: string[]; blood_events_scanned: number } },
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
