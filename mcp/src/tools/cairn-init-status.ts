import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleInitStatus(ctx: CairnContext) {
    try {
        const state = await ctx.stateStore.load();
        const hasConfig = await ctx.configStore.exists();

        let nextAction: string;
        if (state.initialization_status === "complete") {
            nextAction = "ready";
        } else if (hasConfig) {
            nextAction = "resume initialization — config exists but state incomplete";
        } else {
            nextAction = "run cairn_init_commit to initialize project";
        }

        return toolResult(JSON.stringify({
            status: state.initialization_status,
            has_cairn_dir: hasConfig,
            next_action: nextAction,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
