import { createContext } from "../context.js";

export async function runStatus(): Promise<void> {
    const ctx = await createContext(process.cwd());

    const [config, state, bloodEvents, skeletonNodes, dnaIdentity, stagedEntries] =
        await Promise.all([
            ctx.configStore.load(),
            ctx.stateStore.load(),
            ctx.bloodStore.loadAll(),
            ctx.skeletonStore.loadAll(),
            ctx.dnaStore.loadIdentity(),
            ctx.stagedStore.findPending(),
        ]);

    const activeCount = bloodEvents.filter(
        e => e.health.state === "ok" || e.health.state === "resurrected",
    ).length;
    const staleCount = bloodEvents.filter(e => e.health.state === "stale").length;
    const traumaCount = bloodEvents.filter(e => e.trauma.is_trauma).length;

    const projectName = config?.project.name || "(unnamed)";
    const phase = state.stage.phase;
    const mode = config?.cognitive_mode ?? "standard";

    console.log(`Project: ${projectName} (stage: ${phase})`);
    console.log(`Cognitive Mode: ${mode}`);
    console.log(`Blood: ${bloodEvents.length} events (${activeCount} active, ${staleCount} stale, ${traumaCount} trauma)`);
    console.log(`Skeleton: ${skeletonNodes.length} domains`);
    console.log(`DNA: ${dnaIdentity.status}`);
    console.log(`Staged: ${stagedEntries.length} pending`);
}
