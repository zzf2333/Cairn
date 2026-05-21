import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { signalAction } from "../actions/signal-action.js";

export async function handleSignal(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const result = await signalAction(ctx, args as any);
        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
