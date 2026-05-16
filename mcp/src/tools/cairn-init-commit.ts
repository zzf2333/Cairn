import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { EvolutionEvent } from "../schemas/index.js";
import type { GravityLevel } from "../constants.js";

interface BloodCandidate {
    type: string;
    domain: string;
    gravity: { level: string };
    summary: string;
    rejected_paths?: Array<{ path: string; reason: string }>;
    behavior_effect: { type: string; instruction: string };
    revisit?: { when: string[] };
    trauma?: { is_trauma: boolean; sensitivity_multiplier?: number };
    source: { type: string; confidence: number; refs?: any[] };
    lifecycle: { validity: string; review_after?: string };
}

interface InitCommitArgs {
    config: { project_name: string; domains: string[]; cognitive_mode: string };
    skeleton: Array<{
        domain: string;
        role: string;
        owns: string[];
        does_not_own: string[];
        causal_keywords: string[];
        dependencies?: string[];
    }>;
    blood_candidates: BloodCandidate[];
    stage?: { phase: string; confidence: number; evidence: string[] };
    dna?: { traits?: Array<{ name: string; level: string; confidence: number; reasoning: string }> };
    imprint?: {
        inherited_from: string;
        inherited_constraints: string[];
        inherited_warnings: Array<{ domain: string; warning: string }>;
    };
}

function buildEventFromCandidate(candidate: BloodCandidate, index: number): EvolutionEvent {
    const now = new Date().toISOString();
    const domain = candidate.domain;
    const id = `evt_init_${domain}_${candidate.type}_${index}`;

    return {
        id,
        time: now,
        domain,
        type: candidate.type as EvolutionEvent["type"],
        gravity: {
            level: candidate.gravity.level as GravityLevel,
        },
        source: {
            type: candidate.source.type as EvolutionEvent["source"]["type"],
            confidence: candidate.source.confidence,
            verified: false,
            refs: candidate.source.refs ?? [],
        },
        subject: {
            name: candidate.summary,
            aliases: [],
        },
        trigger: "initialization",
        decision_or_change: candidate.summary,
        rejected_paths: candidate.rejected_paths ?? [],
        reasoning: candidate.summary,
        constraints_added: [],
        constraints_removed: [],
        accepted_debt: [],
        behavior_effect: {
            type: candidate.behavior_effect.type as EvolutionEvent["behavior_effect"]["type"],
            instruction: candidate.behavior_effect.instruction,
        },
        affects: {
            skeleton: false,
            dna: false,
            domains: [domain],
        },
        lifecycle: {
            validity: candidate.lifecycle.validity as EvolutionEvent["lifecycle"]["validity"],
            review_after: candidate.lifecycle.review_after,
            decay_policy: "downgrade",
            resurrection_count: 0,
        },
        revisit: candidate.revisit
            ? { when: candidate.revisit.when, status: "not_met" }
            : undefined,
        supersedes: null,
        conflicts_with: [],
        related: [],
        health: { state: "ok", reason: null },
        trauma: {
            is_trauma: candidate.trauma?.is_trauma ?? false,
            sensitivity_multiplier: candidate.trauma?.sensitivity_multiplier ?? 1.0,
            decay_override: candidate.trauma?.is_trauma ? "permanent" : null,
            affects_dna: false,
            requires_human_ratification: candidate.trauma?.is_trauma ?? false,
        },
        created_at: now,
        updated_at: now,
        governance_status: "auto_confirmed",
    };
}

export async function handleInitCommit(ctx: CairnContext, args: Record<string, unknown>) {
    // Init intentionally does NOT call gitEar.scan() to backscan git history.
    // Initial cognition is curated by the AI via the blood_candidates argument
    // (higher quality than mass-scanning historical commits would produce).
    // Auto git scanning begins on the first session_end after init, using
    // state.last_session.commit (set below) as the starting point.
    try {
        const {
            config,
            skeleton,
            blood_candidates: bloodCandidates,
            stage,
            dna,
            imprint,
        } = args as unknown as InitCommitArgs;
        const now = new Date().toISOString();

        await ctx.configStore.save({
            version: "3.0",
            project: { name: config.project_name, created: now },
            domains: config.domains,
            cognitive_mode: config.cognitive_mode as "lightweight" | "standard" | "institutional",
            stage: { override: null },
            tech_stack: [],
        });

        for (const node of skeleton) {
            await ctx.skeletonStore.save({
                domain: node.domain,
                role: node.role,
                owns: node.owns,
                does_not_own: node.does_not_own,
                stability: "stable",
                dependencies: node.dependencies ?? [],
                causal_keywords: node.causal_keywords,
            });
        }

        let autoConfirmed = 0;
        let staged = 0;

        for (let i = 0; i < bloodCandidates.length; i++) {
            const candidate = bloodCandidates[i];
            const event = buildEventFromCandidate(candidate, i);

            const routing = await ctx.trustRouter.route({
                domain: event.domain,
                subject_name: event.subject.name,
                type: event.type,
                gravity: event.gravity.level as GravityLevel,
                isTrauma: event.trauma.is_trauma,
            });

            if (routing.destination === "blood") {
                event.governance_status = "auto_confirmed";
                await ctx.bloodEngine.commit(event);
                autoConfirmed++;
            } else if (routing.destination === "staged") {
                event.governance_status = "pending";
                await ctx.stagedStore.save({
                    id: event.id,
                    draft_event: event,
                    review_status: "pending",
                    routing_reason: routing.reason,
                    gravity: routing.gravity as GravityLevel,
                    governance_required: routing.governance === "human_ratified"
                        ? "human_ratified"
                        : "auto_confirmable",
                    created_at: now,
                });
                staged++;
            }
        }

        if (stage) {
            await ctx.stateStore.updateStage({
                phase: stage.phase as "exploration" | "growth" | "maturity" | "maintenance",
                confidence: stage.confidence,
                status: "advisory",
                evidence: stage.evidence.map(e => ({ source: "init", signal: e })),
                guidance: [],
            });
        }

        if (dna?.traits && dna.traits.length > 0) {
            const identity = await ctx.dnaStore.loadIdentity();
            for (const trait of dna.traits) {
                identity.traits[trait.name] = {
                    level: trait.level as "low" | "medium" | "high",
                    confidence: trait.confidence,
                    evidence_count: 1,
                    last_updated: now,
                    reasoning: trait.reasoning,
                    drift_warning_count: 0,
                    last_safety_valve_at: null,
                };
            }
            identity.status = "emerging";
            await ctx.dnaStore.saveIdentity(identity);
        }

        if (imprint) {
            await ctx.dnaStore.saveImprint({
                inherited_from: imprint.inherited_from,
                inherited_at: now,
                inherited_constraints: imprint.inherited_constraints,
                inherited_warnings: imprint.inherited_warnings,
                identity_status: "not_yet_emerged",
            });
        }

        const state = await ctx.stateStore.load();
        state.initialization_status = "complete";
        await ctx.stateStore.save(state);

        await ctx.viewsEngine.regenerate();

        return toolResult(JSON.stringify({
            created: true,
            written: {
                config: true,
                skeleton: skeleton.length,
                blood_auto_confirmed: autoConfirmed,
                blood_staged: staged,
                stage: !!stage,
                views: true,
            },
            pending_review: staged,
            initialization_status: "complete",
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
