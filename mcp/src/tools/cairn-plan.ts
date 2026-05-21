import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { planAction, ContextNotLoadedError } from "../actions/plan-action.js";

export async function handlePlan(
    ctx: CairnContext,
    args: { task: string },
) {
    try {
        const result = await planAction(ctx, args);
        return toolResult(JSON.stringify(result, null, 2));
    } catch (error) {
        if (error instanceof ContextNotLoadedError) {
            return {
                content: [{ type: "text" as const, text: JSON.stringify({
                    error: "context_not_loaded",
                    message: error.message,
                }) }],
                isError: true,
            };
        }
        return formatToolError(error);
    }
}
