import { z } from "zod";

export const DNA_TRAIT_LEVELS = ["low", "medium", "high"] as const;

export const DNATraitSchema = z.object({
    level: z.enum(DNA_TRAIT_LEVELS),
    confidence: z.number().min(0).max(1),
    evidence_count: z.number().int().min(0),
    last_updated: z.string(),
    reasoning: z.string(),
});
export type DNATrait = z.infer<typeof DNATraitSchema>;

export const DNA_STATUSES = ["not_yet_emerged", "emerging", "emerged"] as const;

export const DNAIdentitySchema = z.object({
    traits: z.record(z.string(), DNATraitSchema).default({}),
    status: z.enum(DNA_STATUSES).default("not_yet_emerged"),
    reevaluation_mode: z.boolean().default(false),
    compression_threshold: z.object({
        min_evidence: z.number().int().default(3),
        min_timespan_months: z.number().int().default(3),
        min_confidence: z.number().default(0.6),
    }).default({}),
});
export type DNAIdentity = z.infer<typeof DNAIdentitySchema>;

export const DNAImprintSchema = z.object({
    inherited_from: z.string(),
    inherited_at: z.string(),
    inherited_constraints: z.array(z.string()).default([]),
    inherited_warnings: z.array(z.object({
        domain: z.string(),
        warning: z.string(),
    })).default([]),
    identity_status: z.literal("not_yet_emerged").default("not_yet_emerged"),
});
export type DNAImprint = z.infer<typeof DNAImprintSchema>;
