import { z } from "zod";

export const DNAStagedEntrySchema = z.object({
    id: z.string(),
    trait_name: z.string().min(1),
    level: z.enum(["low", "medium", "high"]),
    confidence: z.number().min(0).max(1),
    evidence_events: z.array(z.string()).default([]),
    reasoning: z.string(),
    proposed_at: z.string(),
    review_status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
});
export type DNAStagedEntry = z.infer<typeof DNAStagedEntrySchema>;
