import { createCairnContext } from "../server.js";

export async function runStage(args: string[]): Promise<void> {
    try {
        const ctx = createCairnContext();
        const state = ctx.stateStore.load();

        if (args[0] === "confirm") {
            if (state.stage.status === "confirmed") {
                console.log(
                    `Stage already confirmed: ${state.stage.phase}`,
                );
                return;
            }

            state.stage.status = "confirmed";
            state.stage.last_updated = new Date().toISOString();
            ctx.stateStore.save(state);
            ctx.viewsEngine.regenerate();

            console.log(
                `✅ Stage confirmed: ${state.stage.phase} (confidence: ${state.stage.confidence})`,
            );
            return;
        }

        // Default: show current stage
        console.log("Stage Advisory");
        console.log("─".repeat(40));
        console.log(`Phase:      ${state.stage.phase}`);
        console.log(`Confidence: ${state.stage.confidence}`);
        console.log(`Status:     ${state.stage.status}`);

        if (state.stage.evidence.length > 0) {
            console.log("\nEvidence:");
            for (const e of state.stage.evidence) {
                console.log(`  [${e.source}] ${e.signal}`);
            }
        }

        if (state.stage.guidance.length > 0) {
            console.log("\nGuidance:");
            for (const g of state.stage.guidance) {
                console.log(`  - ${g}`);
            }
        }

        if (state.stage.status === "advisory") {
            console.log(
                "\nRun 'cairn stage confirm' to confirm this assessment.",
            );
        }
    } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
    }
}
