import { createContext } from "../context.js";

export async function runReview(): Promise<void> {
    const ctx = await createContext(process.cwd());

    const pending = await ctx.stagedStore.findPending();

    if (pending.length === 0) {
        console.log("No pending staged entries");
        return;
    }

    console.log(`${pending.length} pending staged entries:\n`);
    for (const entry of pending) {
        const ev = entry.draft_event;
        console.log(`  id:      ${entry.id}`);
        console.log(`  type:    ${ev.type}`);
        console.log(`  domain:  ${ev.domain}`);
        console.log(`  gravity: ${entry.gravity}`);
        console.log(`  summary: ${ev.decision_or_change}`);
        console.log();
    }
}
