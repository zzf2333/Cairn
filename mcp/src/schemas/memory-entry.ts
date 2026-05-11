import { z } from "zod";

export const MEMORY_TYPES = [
    "decision",
    "rejection",
    "transition",
    "debt",
    "experiment",
] as const;

export const BEHAVIOR_EFFECT_TYPES = [
    "avoid_suggestion",
    "prefer_approach",
    "warn_before",
    "require_review",
] as const;

export const HealthStateSchema = z.object({
    state: z.enum(["ok", "stale", "conflicted"]).default("ok"),
    reason: z.string().nullable().default(null),
});

export const ConfidenceSchema = z.object({
    level: z.enum(["high", "medium", "low"]).default("high"),
    score: z.number().min(0).max(1).optional(),
    reason: z.string().optional(),
});

export const SourceRefSchema = z.object({
    type: z.enum(["commit", "session", "file", "manual"]),
    id: z.string(),
});

export const SourceSchema = z.object({
    kind: z.enum([
        "git-revert",
        "git-dependency",
        "conversation",
        "manual",
    ]),
    refs: z.array(SourceRefSchema).default([]),
    captured_at: z.string(),
});

export const SubjectSchema = z.object({
    name: z.string(),
    category: z.string().optional(),
});

export const BehaviorEffectSchema = z.object({
    type: z.enum(BEHAVIOR_EFFECT_TYPES),
    instruction: z.string(),
});

export const RevisitSchema = z.object({
    when: z.array(z.string()).default([]),
    status: z.enum(["not_met", "possibly_met", "met"]).default("not_met"),
});

export const RelationsSchema = z.object({
    related: z.array(z.string()).default([]),
    conflicts: z.array(z.string()).default([]),
});

export const MemoryEntrySchema = z.object({
    id: z.string(),
    type: z.enum(MEMORY_TYPES),
    domain: z.string(),
    scope: z.enum(["local", "global"]).default("local"),

    status: z.enum(["active", "superseded", "archived"]).default("active"),

    health: HealthStateSchema.default({ state: "ok", reason: null }),
    confidence: ConfidenceSchema.default({ level: "high" }),

    source: SourceSchema,
    subject: SubjectSchema,

    summary: z.string(),

    rejected: z
        .object({
            what: z.string(),
            reason: z.string(),
        })
        .optional(),

    chosen: z
        .object({
            what: z.string(),
            reason: z.string(),
        })
        .optional(),

    behavior_effect: BehaviorEffectSchema,

    revisit: RevisitSchema.default({ when: [], status: "not_met" }),
    relations: RelationsSchema.default({ related: [], conflicts: [] }),

    created_at: z.string(),
    updated_at: z.string(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
export type BehaviorEffect = z.infer<typeof BehaviorEffectSchema>;
export type HealthState = z.infer<typeof HealthStateSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
