import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { EvolutionEvent } from "../schemas/index.js";
import type { GravityLevel } from "../constants.js";

const SIGNAL_TYPE_MAP: Record<string, EvolutionEvent["type"]> = {
    user_rejection: "rejection",
    decision: "architecture_decision",
    constraint_declaration: "constraint_added",
    debt_acceptance: "debt_acceptance",
    historical_reference: "architecture_decision",
    stage_constraint: "stage_transition",
};

const SIGNAL_GRAVITY_MAP: Record<string, GravityLevel> = {
    user_rejection: "G1",
    decision: "G1",
    constraint_declaration: "G2",
    debt_acceptance: "G1",
    historical_reference: "G1",
    stage_constraint: "G2",
};

interface SignalArgs {
    signal_type: string;
    domain?: string;
    details: {
        what: string;
        aliases?: string[];
        reason?: string;
        rejected_alternatives?: Array<{ path: string; reason: string }>;
        revisit_when?: string[];
    };
    evidence: {
        user_said?: string;
        files?: string[];
        commit_ref?: string;
    };
}

export async function handleSignal(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const {
            signal_type: signalType,
            domain,
            details,
            evidence,
        } = args as unknown as SignalArgs;

        const now = new Date().toISOString();
        const eventDomain = domain ?? "global";
        const id = `evt_${eventDomain}_${signalType}_${Date.now()}`;
        const eventType = SIGNAL_TYPE_MAP[signalType] ?? "architecture_decision";
        const gravity = SIGNAL_GRAVITY_MAP[signalType] ?? "G1";

        const refs: Array<{ type: string; id: string }> = [];
        if (evidence.commit_ref) {
            refs.push({ type: "commit", id: evidence.commit_ref });
        }

        const event: EvolutionEvent = {
            id,
            time: now,
            domain: eventDomain,
            type: eventType,
            gravity: { level: gravity },
            source: {
                type: "conversation",
                confidence: 0.9,
                verified: false,
                refs,
            },
            subject: { name: details.what, aliases: details.aliases ?? [] },
            trigger: evidence.user_said ?? signalType,
            decision_or_change: details.what,
            rejected_paths: details.rejected_alternatives ?? [],
            reasoning: details.reason ?? details.what,
            constraints_added: signalType === "constraint_declaration" ? [details.what] : [],
            constraints_removed: [],
            accepted_debt: signalType === "debt_acceptance" ? [details.what] : [],
            behavior_effect: {
                type: signalType === "user_rejection" ? "avoid_suggestion" : "prefer_approach",
                instruction: details.reason ?? details.what,
            },
            affects: {
                skeleton: false,
                dna: false,
                domains: [eventDomain],
            },
            lifecycle: {
                validity: "strategic",
                decay_policy: "downgrade",
                resurrection_count: 0,
            },
            revisit: details.revisit_when
                ? { when: details.revisit_when, status: "not_met" }
                : undefined,
            supersedes: null,
            conflicts_with: [],
            related: [],
            health: { state: "ok", reason: null },
            trauma: {
                is_trauma: false,
                sensitivity_multiplier: 1.0,
                decay_override: null,
                affects_dna: false,
                requires_human_ratification: true,
            },
            created_at: now,
            updated_at: now,
            governance_status: "pending",
        };

        const routing = await ctx.trustRouter.route({
            domain: eventDomain,
            subject_name: details.what,
            type: eventType,
            gravity,
        });

        let challenges: Array<{ level: string; conflict_with: string; description: string }> = [];

        if (routing.merged_with) {
            if (refs.length > 0) {
                await ctx.bloodEngine.mergeRefs(routing.merged_with, refs);
            }
        } else if (routing.destination === "blood") {
            event.governance_status = "auto_confirmed";
            await ctx.bloodEngine.commit(event);
        } else if (routing.destination === "staged") {
            event.governance_status = "pending";
            await ctx.stagedStore.save({
                id: event.id,
                draft_event: event,
                review_status: "pending",
                routing_reason: routing.reason,
                gravity: routing.gravity,
                governance_required: routing.governance === "human_ratified"
                    ? "human_ratified"
                    : "auto_confirmable",
                created_at: now,
            });
        }

        const detected = await ctx.challengeEngine.detectConflicts({
            task: details.what,
            domain: eventDomain,
            subject_name: details.what,
        });
        challenges = detected.map(c => ({
            level: c.level,
            conflict_with: c.conflict_with,
            description: c.description,
        }));

        return toolResult(JSON.stringify({
            accepted: true,
            routing: {
                level: routing.gravity,
                destination: routing.destination,
                governance: routing.governance,
            },
            challenges,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
