import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { SessionRecord } from "../schemas/index.js";
import { downgradeGravity, type GravityLevel } from "../constants.js";

interface SessionEndArgs {
    summary: string;
    changed_domains?: string[];
    decisions_made?: string[];
    unresolved?: string[];
}

function formatSessionId(now: Date): string {
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    return `sess_${y}_${mo}_${d}_${h}${mi}${s}`;
}

export async function handleSessionEnd(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const {
            summary,
            changed_domains: changedDomains,
            decisions_made: decisionsMade,
            unresolved,
        } = args as unknown as SessionEndArgs;

        const now = new Date();
        const nowIso = now.toISOString();
        const sessionId = formatSessionId(now);

        const headCommit = await ctx.gitEar.getHeadCommit();

        const state = await ctx.stateStore.load();

        if (state.last_session.ended_at) {
            const lastEnded = new Date(state.last_session.ended_at);
            const daysSince = Math.floor((now.getTime() - lastEnded.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince > 30) {
                await ctx.stateStore.clearActivationLog();
            }
        }

        state.last_session.commit = headCommit;
        state.last_session.ended_at = nowIso;
        await ctx.stateStore.save(state);

        const config = await ctx.configStore.load();
        const cognitiveMode = config?.cognitive_mode ?? "standard";
        const decayActions = await ctx.decayEngine.checkDecay(cognitiveMode);

        for (const action of decayActions) {
            if (action.action === "mark_stale") {
                await ctx.bloodEngine.archive(action.event_id, action.reason);
            } else if (action.action === "downgrade") {
                const event = await ctx.bloodStore.load(action.event_id);
                if (event) {
                    event.gravity.level = downgradeGravity(event.gravity.level as GravityLevel);
                    event.updated_at = new Date().toISOString();
                    if (event.gravity.level === "G0") {
                        await ctx.bloodEngine.archive(action.event_id, "downgraded to G0");
                    } else {
                        await ctx.bloodStore.save(event);
                    }
                }
            }
        }

        await ctx.viewsEngine.regenerate();

        const record: SessionRecord = {
            id: sessionId,
            started_at: nowIso,
            ended_at: nowIso,
            summary,
            signals_captured: 0,
            signals_routed: { G0: 0, G1: 0, G2: 0, G3: 0 },
            domains_touched: changedDomains ?? [],
            decisions_made: decisionsMade ?? [],
            unresolved: unresolved ?? [],
        };

        await ctx.sessionStore.save(record);

        const stagedCount = await ctx.stagedStore.count();

        return toolResult(JSON.stringify({
            signals_processed: 0,
            new_blood: 0,
            new_staged: 0,
            views_regenerated: true,
            pending_review: stagedCount,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
