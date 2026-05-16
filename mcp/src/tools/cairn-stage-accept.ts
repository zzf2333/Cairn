import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { PROJECT_PHASES } from "../schemas/state.js";

type ProjectPhase = typeof PROJECT_PHASES[number];

function parsePhaseSubject(name: string): ProjectPhase | null {
    if (!name.startsWith("phase:")) return null;
    const phase = name.slice("phase:".length);
    if ((PROJECT_PHASES as readonly string[]).includes(phase)) {
        return phase as ProjectPhase;
    }
    return null;
}

export async function handleStageAccept(
    ctx: CairnContext,
    args: { id: string },
) {
    const entry = await ctx.stagedStore.load(args.id);
    if (!entry) {
        return formatToolError(new Error(`Staged entry "${args.id}" not found`));
    }

    const now = new Date().toISOString();

    await ctx.bloodEngine.commit(entry.draft_event);

    let stageApplied = false;
    if (entry.draft_event.type === "stage_transition") {
        const newPhase = parsePhaseSubject(entry.draft_event.subject.name);
        if (newPhase) {
            const state = await ctx.stateStore.load();
            state.stage.phase = newPhase;
            state.stage.status = "confirmed";
            state.stage.last_updated = now;
            state.stage.guidance = entry.draft_event.behavior_effect.instruction
                .split(";")
                .map(s => s.trim())
                .filter(Boolean);
            await ctx.stateStore.save(state);
            stageApplied = true;
        }
    }

    entry.review_status = "accepted";
    await ctx.stagedStore.save(entry);

    await ctx.governanceEngine.logAudit({
        time: now,
        action: "ratified",
        target: entry.draft_event.id,
        actor: "human",
    });

    await ctx.viewsEngine.regenerate();

    return toolResult(JSON.stringify({
        success: true,
        moved_to: "blood",
        views_regenerated: true,
        governance_logged: true,
        stage_applied: stageApplied,
    }, null, 2));
}
