import { z } from "zod";

export const SIGNAL_TYPES = [
    "dependency-removed",
    "dependency-replaced",
    "revert",
    "large-refactor",
    "user-rejection",
    "user-constraint",
    "historical-reference",
    "stage-signal",
    "decision",
    "debt-acceptance",
] as const;

export const ROUTING_LEVELS = ["L0", "L1", "L2", "L3"] as const;

export const SignalRoutingSchema = z.object({
    level: z.enum(ROUTING_LEVELS),
    reason: z.string(),
});

export const SignalSchema = z.object({
    id: z.string(),
    source_ear: z.enum(["git", "conversation"]),
    signal_type: z.enum(SIGNAL_TYPES),
    raw_data: z.record(z.unknown()).default({}),
    inferred: z
        .object({
            probable_type: z.string().optional(),
            probable_domain: z.string().optional(),
            confidence: z.enum(["high", "medium", "low"]).default("medium"),
        })
        .default({}),
    routing: SignalRoutingSchema.optional(),
    captured_at: z.string(),
});

export type Signal = z.infer<typeof SignalSchema>;
export type SignalRouting = z.infer<typeof SignalRoutingSchema>;
export type SignalType = z.infer<typeof SignalSchema>["signal_type"];
