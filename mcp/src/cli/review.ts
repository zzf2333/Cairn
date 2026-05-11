import { createInterface } from "node:readline";
import { stringify as yamlStringify } from "yaml";
import { createCairnContext } from "../server.js";

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

export async function runReview(): Promise<void> {
    try {
        const ctx = createCairnContext();
        const pending = ctx.stagedStore.loadPending();

        if (pending.length === 0) {
            console.log("No staged entries pending review.");
            return;
        }

        console.log(`\n${pending.length} staged entries pending review.\n`);

        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        let accepted = 0;
        let rejected = 0;
        let skipped = 0;

        for (const entry of pending) {
            console.log("─".repeat(60));
            console.log(`ID: ${entry.id}`);
            console.log(`Origin: ${entry.origin_signal}`);
            console.log(`Routing reason: ${entry.routing_reason}`);
            console.log();
            console.log("Draft memory:");
            console.log(yamlStringify(entry.draft_memory));
            console.log();

            const action = await ask(
                rl,
                "[a]ccept / [d]elete / [s]kip ? ",
            );

            switch (action.toLowerCase().charAt(0)) {
                case "a": {
                    const memory = ctx.stagedStore.accept(entry.id);
                    if (memory) {
                        ctx.memoryEngine.write(memory);
                        console.log(`✅ Accepted → ${memory.id}`);
                        accepted++;
                    }
                    break;
                }
                case "d":
                    ctx.stagedStore.reject(entry.id);
                    console.log("❌ Deleted.");
                    rejected++;
                    break;
                default:
                    console.log("⏭ Skipped.");
                    skipped++;
                    break;
            }
        }

        rl.close();

        console.log("\n─".repeat(60));
        console.log(
            `Review complete: ${accepted} accepted, ${rejected} deleted, ${skipped} skipped`,
        );

        if (accepted > 0) {
            ctx.viewsEngine.regenerate();
            console.log("Views regenerated.");
        }
    } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
    }
}
