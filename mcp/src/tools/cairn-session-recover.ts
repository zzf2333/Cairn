import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { handleSessionEnd } from "./cairn-session-end.js";

export async function handleSessionRecover(ctx: CairnContext) {
    try {
        const activeSession = await ctx.stateStore.getActiveSession();

        if (!activeSession) {
            const state = await ctx.stateStore.load();
            if (state.session_in_progress) {
                await ctx.stateStore.clearSession();
                return toolResult(JSON.stringify({
                    recovered: true,
                    legacy: true,
                    cleared: "session_in_progress",
                }));
            }
            return toolResult(JSON.stringify({
                recovered: false,
                reason: "no_stale_session",
            }));
        }

        const originalSession = {
            id: activeSession.id,
            started_at: activeSession.started_at,
            signals_count: activeSession.signals_count,
            degraded_signals_count: activeSession.degraded_signals_count,
        };

        await ctx.stateStore.markSessionRecovered();

        const endResult = await handleSessionEnd(ctx, {
            summary: `[recovered] Stale session ${activeSession.id} recovered automatically`,
        });

        const endData = JSON.parse(endResult.content[0].text);

        return toolResult(JSON.stringify({
            recovered: true,
            original_session: originalSession,
            session_end_result: endData,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
