import { stringify as yamlStringify } from "yaml";
import { createCairnContext } from "../server.js";

export async function runMemory(args: string[]): Promise<void> {
    try {
        const ctx = createCairnContext();
        const subcommand = args[0];
        const id = args[1];

        switch (subcommand) {
            case "show": {
                if (!id) {
                    console.error("Usage: cairn memory show <id>");
                    process.exit(1);
                }
                const entry = ctx.memoryStore.loadById(id);
                if (!entry) {
                    console.error(`Memory entry not found: ${id}`);
                    process.exit(1);
                }
                console.log(yamlStringify(entry));
                break;
            }

            case "archive": {
                if (!id) {
                    console.error("Usage: cairn memory archive <id>");
                    process.exit(1);
                }
                const success = ctx.memoryEngine.archive(id);
                if (success) {
                    console.log(`✅ Archived: ${id}`);
                } else {
                    console.error(`Memory entry not found: ${id}`);
                    process.exit(1);
                }
                break;
            }

            case "list":
            case undefined: {
                const all = ctx.memoryStore.loadAll();
                if (all.length === 0) {
                    console.log("No memory entries.");
                    return;
                }
                console.log(`${all.length} memory entries:\n`);
                for (const m of all) {
                    const status = m.status === "active" ? "●" : m.status === "archived" ? "○" : "◎";
                    console.log(
                        `  ${status} ${m.id} [${m.type}] ${m.domain} — ${m.summary.slice(0, 60)}`,
                    );
                }
                break;
            }

            default:
                console.error(
                    `Unknown memory subcommand: ${subcommand}\n` +
                        "Usage: cairn memory [list|show <id>|archive <id>]",
                );
                process.exit(1);
        }
    } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
    }
}
