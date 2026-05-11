import { createCairnContext } from "../server.js";

export async function runStatus(): Promise<void> {
    try {
        const ctx = createCairnContext();
        const memories = ctx.memoryStore.loadAll();
        const staged = ctx.stagedStore.loadPending();
        const signals = ctx.signalStore.loadAll();
        const conflicts = ctx.memoryStore.findConflicts();
        const state = ctx.stateStore.load();

        console.log("Cairn Status");
        console.log("─".repeat(40));
        console.log(`Memory entries:  ${memories.length}`);
        console.log(`Staged (pending): ${staged.length}`);
        console.log(`Signals (L1):    ${signals.length}`);
        console.log(`Conflicts:       ${conflicts.length}`);
        console.log();
        console.log(`Stage: ${state.stage.phase} (confidence: ${state.stage.confidence}, ${state.stage.status})`);
        console.log(`Last git scan:   ${state.last_session_commit ?? "never"}`);

        if (staged.length > 0) {
            console.log(`\n⚠ ${staged.length} entries pending review. Run 'cairn review'.`);
        }
        if (conflicts.length > 0) {
            console.log(`\n⚠ ${conflicts.length} conflicted entries found.`);
            for (const c of conflicts) {
                console.log(`  - ${c.id}: ${c.health.reason}`);
            }
        }
    } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
    }
}
