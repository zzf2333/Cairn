import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleContext(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const task = args.task as string | undefined;
        const files = args.files as string[] | undefined;

        const result = await ctx.activationEngine.activate({ task, files });

        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
