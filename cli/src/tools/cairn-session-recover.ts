import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { sessionRecoverAction } from "../actions/session-recover-action.js";

export async function handleSessionRecover(ctx: CairnContext) {
    try {
        const result = await sessionRecoverAction(ctx);
        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
