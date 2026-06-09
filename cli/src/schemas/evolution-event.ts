import { z } from "zod";
import {
    GravitySchema, SourceSchema, SubjectSchema,
    BehaviorEffectSchema, LifecycleSchema, TraumaSchema,
    RevisitSchema, HealthSchema, GovernanceStatusEnum,
} from "./shared.js";

export const EVENT_TYPES = [
    "architecture_decision", "rejection", "transition",
    "debt_acceptance", "debt_resolution",
    "experiment_success", "experiment_failure",
    "incident", "constraint_added", "constraint_removed",
    "stage_transition",
] as const;
export const EventTypeEnum = z.enum(EVENT_TYPES);

export const EvolutionEventSchema = z.object({
    id: z.string(),
    time: z.string(),
    domain: z.string(),
    type: EventTypeEnum,

    gravity: GravitySchema,
    source: SourceSchema,
    subject: SubjectSchema,

    trigger: z.string(),
    decision_or_change: z.string(),
    rejected_paths: z.array(z.object({
        path: z.string(),
        reason: z.string(),
    })).default([]),
    reasoning: z.string(),

    constraints_added: z.array(z.string()).default([]),
    constraints_removed: z.array(z.string()).default([]),
    accepted_debt: z.array(z.string()).default([]),

    behavior_effect: BehaviorEffectSchema,

    affects: z.object({
        skeleton: z.boolean().default(false),
        dna: z.boolean().default(false),
        domains: z.array(z.string()).default([]),
    }).default({}),

    future_implications: z.string().optional(),
    lifecycle: LifecycleSchema,
    revisit: RevisitSchema.optional(),

    supersedes: z.string().nullable().default(null),
    conflicts_with: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),

    health: HealthSchema.default({}),
    trauma: TraumaSchema.default({}),
    evidence: z.object({
        source_signal_id: z.string().optional(),
        mapper_version: z.string().optional(),
        routing_reason: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        domain_confidence: z.number().min(0).max(1).optional(),
        domain_evidence: z.array(z.string()).default([]),
        signal_snapshot: z.record(z.unknown()).optional(),
    }).optional(),

    created_at: z.string(),
    updated_at: z.string(),
    governance_status: GovernanceStatusEnum,
});

export type EvolutionEvent = z.infer<typeof EvolutionEventSchema>;
