import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { contextAction } from "../actions/context-action.js";

export async function handleContext(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const result = await contextAction(ctx, {
            task: args.task as string | undefined,
            files: args.files as string[] | undefined,
        });
        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
