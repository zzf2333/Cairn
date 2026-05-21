import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { observeAction } from "../actions/observe-action.js";

export async function handleObserve(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const result = await observeAction(ctx, args as any);
        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
