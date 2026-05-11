import { z } from "zod";
import { MEMORY_TYPES, BEHAVIOR_EFFECT_TYPES } from "./memory-entry.js";

export const DraftMemorySchema = z.object({
    type: z.enum(MEMORY_TYPES),
    domain: z.string(),
    scope: z.enum(["local", "global"]).default("local"),
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
    behavior_effect: z.object({
        type: z.enum(BEHAVIOR_EFFECT_TYPES),
        instruction: z.string(),
    }),
    revisit: z
        .object({
            when: z.array(z.string()).default([]),
            status: z.enum(["not_met", "possibly_met", "met"]).default("not_met"),
        })
        .optional(),
});

export const StagedEntrySchema = z.object({
    id: z.string(),
    origin_signal: z.string(),
    draft_memory: DraftMemorySchema,
    review_status: z
        .enum(["pending", "accepted", "rejected", "expired"])
        .default("pending"),
    routing_reason: z.string(),
    created_at: z.string(),
});

export type StagedEntry = z.infer<typeof StagedEntrySchema>;
export type DraftMemory = z.infer<typeof DraftMemorySchema>;
