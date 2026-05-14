import type { CairnContext } from "../server.js";
import { formatToolError, toolResult } from "../errors.js";

export function handleCairnReview(
    ctx: CairnContext,
    args: { action: "list" | "accept" | "reject"; id?: string },
) {
    switch (args.action) {
        case "list": {
            const pending = ctx.stagedStore.loadPending();
            return toolResult(JSON.stringify(pending, null, 2));
        }

        case "accept": {
            if (!args.id) {
                return formatToolError(new Error("id is required for accept"));
            }
            const memory = ctx.stagedStore.accept(args.id);
            if (!memory) {
                return formatToolError(
                    new Error(`Staged entry not found: ${args.id}`),
                );
            }
            ctx.memoryEngine.write(memory);
            return toolResult(
                JSON.stringify({ accepted: true, memory_id: memory.id }),
            );
        }

        case "reject": {
            if (!args.id) {
                return formatToolError(new Error("id is required for reject"));
            }
            const rejected = ctx.stagedStore.reject(args.id);
            if (!rejected) {
                return formatToolError(
                    new Error(`Staged entry not found: ${args.id}`),
                );
            }
            return toolResult(JSON.stringify({ rejected: true }));
        }
    }
}
