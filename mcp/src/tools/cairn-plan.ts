import type { CairnContext } from "../context.js";
import { toolResult } from "../errors.js";

export async function handlePlan(
    ctx: CairnContext,
    args: { task: string },
) {
    const activation = await ctx.activationEngine.activate({ task: args.task });

    const identity = await ctx.dnaStore.loadIdentity();
    const dnaGuidance: string[] = [];
    if (identity.status !== "not_yet_emerged") {
        for (const [name, trait] of Object.entries(identity.traits)) {
            if (trait.level === "high" || trait.level === "low") {
                dnaGuidance.push(`${name}: ${trait.level}`);
            }
        }
    }

    const warnings: string[] = [];
    for (const noGo of activation.constraints.no_go) {
        warnings.push(`No-go: "${noGo.what}" — ${noGo.reason}`);
    }
    for (const challenge of activation.challenges) {
        warnings.push(`[${challenge.level}] ${challenge.description}`);
    }

    const openQuestions: string[] = [];
    for (const domain of activation.relevant_domains) {
        for (const q of domain.open_questions) {
            openQuestions.push(`[${domain.domain}] ${q}`);
        }
    }

    const historicalConstraints: string[] = [];
    for (const noGo of activation.constraints.no_go) {
        historicalConstraints.push(`[no-go] ${noGo.what}: ${noGo.reason} (${noGo.gravity})`);
    }
    for (const debt of activation.constraints.accepted_debt) {
        historicalConstraints.push(`[debt] ${debt.what}: ${debt.reason}`);
    }
    for (const domain of activation.relevant_domains) {
        for (const rp of domain.rejected_paths) {
            historicalConstraints.push(`[rejected] ${rp.path}: ${rp.reason}`);
        }
        for (const pitfall of domain.pitfalls) {
            historicalConstraints.push(`[pitfall] ${pitfall}`);
        }
    }

    const preferredApproaches: string[] = [];
    for (const sc of activation.constraints.stage_constraints) {
        preferredApproaches.push(sc);
    }

    const result = {
        task: args.task,
        stage_guidance: {
            phase: activation.stage.phase,
            confidence: activation.stage.confidence,
            guidance: activation.stage.guidance,
        },
        dna_guidance: dnaGuidance,
        historical_constraints: historicalConstraints,
        recommended_direction: preferredApproaches.length > 0
            ? preferredApproaches.join(". ")
            : "No specific historical preference found for this task.",
        warnings,
        open_questions: openQuestions,
    };

    return toolResult(JSON.stringify(result, null, 2));
}
