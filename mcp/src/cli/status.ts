import { createContext } from "../context.js";

export async function runStatus(): Promise<void> {
    const ctx = await createContext(process.cwd());

    const [config, state, bloodEvents, skeletonNodes, dnaIdentity, stagedEntries, dnaStagedPending] =
        await Promise.all([
            ctx.configStore.load(),
            ctx.stateStore.load(),
            ctx.bloodStore.loadAll(),
            ctx.skeletonStore.loadAll(),
            ctx.dnaStore.loadIdentity(),
            ctx.stagedStore.findPending(),
            ctx.dnaStagedStore.findPending(),
        ]);

    const activeCount = bloodEvents.filter(
        e => e.health.state === "ok" || e.health.state === "resurrected",
    ).length;
    const inactiveCount = bloodEvents.filter(e => e.health.state === "stale" || e.health.state === "archived").length;
    const traumaCount = bloodEvents.filter(e => e.trauma.is_trauma).length;
    const stageTransitions = stagedEntries.filter(e => e.draft_event.type === "stage_transition").length;

    const projectName = config?.project.name || "(unnamed)";
    const phase = state.stage.phase;
    const mode = config?.cognitive_mode ?? "standard";

    console.log(`Project: ${projectName} (stage: ${phase})`);
    console.log(`Cognitive Mode: ${mode}`);
    console.log(`Blood: ${bloodEvents.length} events (${activeCount} active, ${inactiveCount} inactive, ${traumaCount} trauma)`);
    console.log(`Skeleton: ${skeletonNodes.length} domains`);
    console.log(`DNA: ${dnaIdentity.status}${dnaIdentity.reevaluation_mode ? " (REEVALUATION_MODE)" : ""}`);
    if (dnaStagedPending.length > 0) {
        console.log(`  pending candidates: ${dnaStagedPending.length}`);
    }
    const driftEntries = Object.entries(dnaIdentity.traits)
        .filter(([, t]) => t.drift_warning_count > 0);
    if (driftEntries.length > 0) {
        const summary = driftEntries.map(([n, t]) => `${n}=${t.drift_warning_count}`).join(", ");
        console.log(`  drift warnings: ${summary}`);
    }
    console.log(`Staged: ${stagedEntries.length} pending${stageTransitions > 0 ? ` (${stageTransitions} stage_transition)` : ""}`);
}
