import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { sessionEndAction } from "../actions/session-end-action.js";

export async function handleSessionEnd(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const result = await sessionEndAction(ctx, args as any);
        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
