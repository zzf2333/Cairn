import { z } from "zod";

export const PROJECT_PHASES = ["exploration", "growth", "maturity", "maintenance"] as const;

export const StageSnapshotSchema = z.object({
    phase: z.enum(PROJECT_PHASES).default("exploration"),
    confidence: z.number().min(0).max(1).default(0),
    status: z.enum(["advisory", "confirmed"]).default("advisory"),
    evidence: z.array(z.object({
        source: z.string(),
        signal: z.string(),
    })).default([]),
    guidance: z.array(z.string()).default([]),
    last_updated: z.string().optional(),
});
export type StageSnapshot = z.infer<typeof StageSnapshotSchema>;

export const INIT_STATUSES = ["not_initialized", "partial", "complete"] as const;

export const StateSchema = z.object({
    initialization_status: z.enum(INIT_STATUSES).default("not_initialized"),
    last_session: z.object({
        commit: z.string().nullable().default(null),
        ended_at: z.string().nullable().default(null),
    }).default({}),
    stage: StageSnapshotSchema.default({}),
    activation_log: z.object({
        recent_hits: z.record(z.string(), z.number()).default({}),
    }).default({}),
});

export type State = z.infer<typeof StateSchema>;
