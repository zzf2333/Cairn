import type { StateStore } from "../stores/index.js";
import type { ActiveSession } from "../schemas/index.js";

export function generateSessionId(now = new Date()): string {
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return `sess_${y}_${mo}_${d}_${h}${mi}${s}_${ms}`;
}

export interface ContextGuardResult {
    ok: boolean;
    warning?: string;
    session?: ActiveSession;
}

export async function requireContext(stateStore: StateStore): Promise<ContextGuardResult> {
    const session = await stateStore.getActiveSession();
    if (session?.context_loaded) {
        return { ok: true, session };
    }
    return {
        ok: false,
        warning: "cairn_context was not called before this tool. Call cairn_context({ task }) first to activate session context.",
    };
}

export interface ContextCheckResult {
    session: ActiveSession | null;
    warning: string | null;
}

export async function checkContext(stateStore: StateStore): Promise<ContextCheckResult> {
    const session = await stateStore.getActiveSession();
    if (session?.context_loaded) return { session, warning: null };
    return {
        session,
        warning: "cairn_context was not called before this tool. Signal accepted but marked as degraded.",
    };
}

export async function warnIfNoContext(stateStore: StateStore): Promise<string | null> {
    const { warning } = await checkContext(stateStore);
    return warning;
}
