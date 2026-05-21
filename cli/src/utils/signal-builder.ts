import type { EvolutionEvent } from "../schemas/index.js";
import type { GravityLevel } from "../constants.js";

export const SIGNAL_TYPE_MAP: Record<string, EvolutionEvent["type"]> = {
    user_rejection: "rejection",
    decision: "architecture_decision",
    constraint_declaration: "constraint_added",
    debt_acceptance: "debt_acceptance",
    historical_reference: "architecture_decision",
    stage_constraint: "stage_transition",
};

export const SIGNAL_GRAVITY_MAP: Record<string, GravityLevel> = {
    user_rejection: "G1",
    decision: "G1",
    constraint_declaration: "G2",
    debt_acceptance: "G1",
    historical_reference: "G1",
    stage_constraint: "G2",
};

export interface SignalDetails {
    what: string;
    aliases?: string[];
    reason?: string;
    rejected_alternatives?: Array<{ path: string; reason: string }>;
    revisit_when?: string[];
}

export interface SignalEvidence {
    user_said?: string;
    files?: string[];
    commit_ref?: string;
}

export function buildEventFromSignalDetails(input: {
    signalType: string;
    domain?: string;
    details: SignalDetails;
    evidence: SignalEvidence;
    idPrefix?: string;
}): { event: EvolutionEvent; eventType: string; gravity: GravityLevel } {
    const now = new Date().toISOString();
    const eventDomain = input.domain ?? "global";
    const prefix = input.idPrefix ?? "evt";
    const id = `${prefix}_${eventDomain}_${input.signalType}_${Date.now()}`;
    const eventType = SIGNAL_TYPE_MAP[input.signalType] ?? "architecture_decision";
    const gravity = SIGNAL_GRAVITY_MAP[input.signalType] ?? "G1";

    const refs: Array<{ type: string; id: string }> = [];
    if (input.evidence.commit_ref) {
        refs.push({ type: "commit", id: input.evidence.commit_ref });
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
        subject: { name: input.details.what, aliases: input.details.aliases ?? [] },
        trigger: input.evidence.user_said ?? input.signalType,
        decision_or_change: input.details.what,
        rejected_paths: input.details.rejected_alternatives ?? [],
        reasoning: input.details.reason ?? input.details.what,
        constraints_added: input.signalType === "constraint_declaration" ? [input.details.what] : [],
        constraints_removed: [],
        accepted_debt: input.signalType === "debt_acceptance" ? [input.details.what] : [],
        behavior_effect: {
            type: input.signalType === "user_rejection" ? "avoid_suggestion" : "prefer_approach",
            instruction: input.details.reason ?? input.details.what,
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
        revisit: input.details.revisit_when
            ? { when: input.details.revisit_when, status: "not_met" }
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

    return { event, eventType, gravity };
}
