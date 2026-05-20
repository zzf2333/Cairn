import type { CairnContext } from "../context.js";
import { toolResult } from "../errors.js";
import { requireContext } from "./session-guard.js";

export async function handlePlan(
    ctx: CairnContext,
    args: { task: string },
) {
    const guard = await requireContext(ctx.stateStore);
    if (!guard.ok) {
        return {
            content: [{ type: "text" as const, text: JSON.stringify({
                error: "context_not_loaded",
                message: guard.warning,
            }) }],
            isError: true,
        };
    }

    await ctx.stateStore.markPlanCalled();

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

    const driftWarnings: string[] = [];
    for (const [name, trait] of Object.entries(identity.traits)) {
        if (trait.drift_warning_count > 0) {
            driftWarnings.push(`${name} has ${trait.drift_warning_count} unresolved drift warning(s) — recent behavior may contradict this trait`);
        }
    }

    const warnings: string[] = [];
    for (const noGo of activation.constraints.no_go) {
        const prefix = noGo.archived ? "Archived no-go (reactivating)" : "No-go";
        warnings.push(`${prefix}: "${noGo.what}" — ${noGo.reason}`);
    }
    for (const challenge of activation.challenges) {
        const tag = challenge.archived ? "archived " : (challenge.trauma ? "trauma " : "");
        warnings.push(`[${tag}${challenge.level}] ${challenge.description}`);
    }

    const openQuestions: string[] = [];
    for (const domain of activation.relevant_domains) {
        for (const q of domain.open_questions) {
            openQuestions.push(`[${domain.domain}] ${q}`);
        }
    }

    const pendingStaged = await ctx.stagedStore.findPending();
    for (const entry of pendingStaged) {
        if (entry.draft_event.type === "stage_transition") {
            openQuestions.push(`[stage_transition_pending] ${entry.draft_event.decision_or_change} (id: ${entry.id})`);
        }
    }

    const historicalConstraints: string[] = [];
    for (const noGo of activation.constraints.no_go) {
        const archivedTag = noGo.archived ? "[archived] " : "";
        historicalConstraints.push(`[no-go]${archivedTag} ${noGo.what}: ${noGo.reason} (${noGo.gravity})`);
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
        dna_health: {
            reevaluation_mode: identity.reevaluation_mode,
            drift_warnings: driftWarnings,
        },
        historical_constraints: historicalConstraints,
        recommended_direction: preferredApproaches.length > 0
            ? preferredApproaches.join(". ")
            : "No specific historical preference found for this task.",
        warnings,
        open_questions: openQuestions,
    };

    return toolResult(JSON.stringify(result, null, 2));
}
