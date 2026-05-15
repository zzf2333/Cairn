import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleContext(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const task = args.task as string | undefined;
        const files = args.files as string[] | undefined;

        const result = await ctx.activationEngine.activate({ task, files });

        const challenges = await ctx.challengeEngine.detectConflicts({
            task,
            domain: result.relevant_domains[0]?.domain,
        });

        result.challenges = [...result.challenges, ...challenges];

        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
