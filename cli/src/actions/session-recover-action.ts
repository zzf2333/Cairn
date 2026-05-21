import type { CairnContext } from "../context.js";
import { sessionEndAction } from "./session-end-action.js";

export async function sessionRecoverAction(ctx: CairnContext): Promise<Record<string, unknown>> {
    const activeSession = await ctx.stateStore.getActiveSession();

    if (!activeSession) {
        const state = await ctx.stateStore.load();
        if (state.session_in_progress) {
            await ctx.stateStore.clearSession();
            return {
                recovered: true,
                legacy: true,
                cleared: "session_in_progress",
            };
        }
        return {
            recovered: false,
            reason: "no_stale_session",
        };
    }

    const originalSession = {
        id: activeSession.id,
        started_at: activeSession.started_at,
        signals_count: activeSession.signals_count,
        degraded_signals_count: activeSession.degraded_signals_count,
    };

    await ctx.stateStore.markSessionRecovered();

    const endData = await sessionEndAction(ctx, {
        summary: `[recovered] Stale session ${activeSession.id} recovered automatically`,
    });

    return {
        recovered: true,
        original_session: originalSession,
        session_end_result: endData,
    };
}
