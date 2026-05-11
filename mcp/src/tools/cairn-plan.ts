import type { CairnContext } from "../server.js";
import { toolResult } from "../errors.js";

export function handleCairnPlan(
    ctx: CairnContext,
    args: { task: string },
) {
    // cairn_plan is STRICTLY read-only — never writes signals/staged/memory
    const memories = ctx.memoryStore.findActive();
    const state = ctx.stateStore.load();
    const taskLower = args.task.toLowerCase();

    // Find relevant historical constraints
    const relevantMemories = memories.filter((m) => {
        const keywords = [
            m.domain,
            m.subject.name,
            ...(m.rejected?.what ? [m.rejected.what] : []),
            ...(m.chosen?.what ? [m.chosen.what] : []),
        ].map((k) => k.toLowerCase());

        return keywords.some(
            (k) => taskLower.includes(k) || k.includes(taskLower.split(/\s+/)[0]),
        );
    });

    const historicalConstraints = relevantMemories.map((m) => {
        let constraint = `[${m.type}] ${m.summary}`;
        if (m.behavior_effect.type === "avoid_suggestion") {
            constraint += ` → DO NOT suggest: ${m.behavior_effect.instruction}`;
        } else if (m.behavior_effect.type === "prefer_approach") {
            constraint += ` → PREFER: ${m.behavior_effect.instruction}`;
        } else if (m.behavior_effect.type === "warn_before") {
            constraint += ` → WARNING: ${m.behavior_effect.instruction}`;
        }
        return constraint;
    });

    // Stage guidance
    const stageGuidance = state.stage.confidence >= 0.5
        ? `Project is in ${state.stage.phase} phase. ${state.stage.guidance?.join(". ") ?? ""}`
        : `Stage inference confidence too low (${state.stage.confidence}). No stage guidance applied.`;

    // Warnings
    const warnings: string[] = [];
    const noGoHits = relevantMemories.filter(
        (m) => m.behavior_effect.type === "avoid_suggestion",
    );
    for (const hit of noGoHits) {
        warnings.push(
            `⚠ No-go: "${hit.subject.name}" — ${hit.behavior_effect.instruction}`,
        );
    }

    const revisitHits = relevantMemories.filter(
        (m) => m.revisit.status === "possibly_met",
    );
    for (const hit of revisitHits) {
        warnings.push(
            `Revisit condition may be met for: ${hit.subject.name}`,
        );
    }

    // Recommended direction
    const preferredApproaches = relevantMemories
        .filter((m) => m.behavior_effect.type === "prefer_approach")
        .map((m) => m.behavior_effect.instruction);

    const recommendedDirection =
        preferredApproaches.length > 0
            ? preferredApproaches.join(". ")
            : "No specific historical preference found for this task.";

    return toolResult(
        JSON.stringify(
            {
                task: args.task,
                stage_guidance: stageGuidance,
                historical_constraints: historicalConstraints,
                recommended_direction: recommendedDirection,
                warnings,
            },
            null,
            2,
        ),
    );
}
