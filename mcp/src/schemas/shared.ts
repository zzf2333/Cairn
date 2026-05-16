import { z } from "zod";

export const GRAVITY_LEVELS = ["G0", "G1", "G2", "G3"] as const;
export const GravityLevelEnum = z.enum(GRAVITY_LEVELS);

export const GravitySchema = z.object({
    level: GravityLevelEnum,
    architectural: z.enum(["low", "medium", "high"]).optional(),
    operational: z.enum(["low", "medium", "high"]).optional(),
    local: z.enum(["low", "medium", "high"]).optional(),
});
export type Gravity = z.infer<typeof GravitySchema>;

export const HEALTH_STATES = ["ok", "stale", "conflicted", "resurrected"] as const;
export const HealthSchema = z.object({
    state: z.enum(HEALTH_STATES).default("ok"),
    reason: z.string().nullable().default(null),
});
export type Health = z.infer<typeof HealthSchema>;

export const SOURCE_TYPES = [
    "git_revert", "git_dependency", "conversation",
    "runtime_observed", "human_explicit", "agent_inferred",
] as const;
export const SourceSchema = z.object({
    type: z.enum(SOURCE_TYPES),
    confidence: z.number().min(0).max(1),
    verified: z.boolean().default(false),
    refs: z.array(z.object({ type: z.string(), id: z.string() })).default([]),
});
export type Source = z.infer<typeof SourceSchema>;

export const BEHAVIOR_EFFECT_TYPES = [
    "avoid_suggestion", "prefer_approach", "warn_before", "require_review",
] as const;
export const BehaviorEffectSchema = z.object({
    type: z.enum(BEHAVIOR_EFFECT_TYPES),
    instruction: z.string(),
});
export type BehaviorEffect = z.infer<typeof BehaviorEffectSchema>;

export const SUBJECT_TYPES = [
    "technology", "architecture", "domain", "dependency", "constraint",
] as const;
export const SubjectSchema = z.object({
    type: z.enum(SUBJECT_TYPES).optional(),
    name: z.string(),
    aliases: z.array(z.string()).default([]),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const VALIDITY_LEVELS = ["transient", "tactical", "strategic", "identity"] as const;
export const DECAY_POLICIES = ["downgrade", "expire", "permanent"] as const;
export const LifecycleSchema = z.object({
    validity: z.enum(VALIDITY_LEVELS),
    review_after: z.string().optional(),
    decay_policy: z.enum(DECAY_POLICIES).default("downgrade"),
    resurrection_count: z.number().default(0),
});
export type Lifecycle = z.infer<typeof LifecycleSchema>;

export const TraumaSchema = z.object({
    is_trauma: z.boolean().default(false),
    sensitivity_multiplier: z.number().default(1.0),
    decay_override: z.enum(["permanent"]).nullable().default(null),
    affects_dna: z.boolean().default(false),
    requires_human_ratification: z.boolean().default(true),
});
export type Trauma = z.infer<typeof TraumaSchema>;

export const RevisitSchema = z.object({
    when: z.array(z.string()).default([]),
    status: z.enum(["not_met", "possibly_met", "met"]).default("not_met"),
});
export type Revisit = z.infer<typeof RevisitSchema>;

export const GOVERNANCE_STATUSES = ["pending", "auto_confirmed", "ratified"] as const;
export const GovernanceStatusEnum = z.enum(GOVERNANCE_STATUSES);
export type GovernanceStatus = z.infer<typeof GovernanceStatusEnum>;
