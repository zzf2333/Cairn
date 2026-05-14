import type { CairnContext } from "../server.js";
import { formatToolError, toolResult } from "../errors.js";

export function handleCairnMemory(
    ctx: CairnContext,
    args: { action: "list" | "show" | "archive"; id?: string; domain?: string },
) {
    switch (args.action) {
        case "list": {
            let entries = ctx.memoryStore.loadAll();
            if (args.domain) {
                entries = entries.filter((e) => e.domain === args.domain);
            }
            const summary = entries.map((e) => ({
                id: e.id,
                type: e.type,
                domain: e.domain,
                status: e.status,
                subject: e.subject.name,
                summary: e.summary,
                behavior_effect: e.behavior_effect.type,
                created_at: e.created_at,
            }));
            return toolResult(JSON.stringify(summary, null, 2));
        }

        case "show": {
            if (!args.id) {
                return formatToolError(new Error("id is required for show"));
            }
            const entry = ctx.memoryStore.loadById(args.id);
            if (!entry) {
                return formatToolError(
                    new Error(`Memory entry not found: ${args.id}`),
                );
            }
            return toolResult(JSON.stringify(entry, null, 2));
        }

        case "archive": {
            if (!args.id) {
                return formatToolError(new Error("id is required for archive"));
            }
            const archived = ctx.memoryEngine.archive(args.id);
            if (!archived) {
                return formatToolError(
                    new Error(`Memory entry not found: ${args.id}`),
                );
            }
            return toolResult(JSON.stringify({ archived: true }));
        }
    }
}
