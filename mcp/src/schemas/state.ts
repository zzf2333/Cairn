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

export const INIT_STEPS = ["config", "skeleton", "blood", "dna", "stage"] as const;
export type InitStep = typeof INIT_STEPS[number];
export const REQUIRED_INIT_STEPS: readonly InitStep[] = ["config", "skeleton", "blood"];

export const InitProgressSchema = z.object({
    completed_steps: z.array(z.enum(INIT_STEPS)).default([]),
    started_at: z.string().optional(),
});

export const StateSchema = z.object({
    cairn_version: z.string().optional(),
    initialization_status: z.enum(INIT_STATUSES).default("not_initialized"),
    last_session: z.object({
        commit: z.string().nullable().default(null),
        ended_at: z.string().nullable().default(null),
    }).default({}),
    stage: StageSnapshotSchema.default({}),
    activation_log: z.object({
        recent_hits: z.record(z.string(), z.number()).default({}),
    }).default({}),
    init_progress: InitProgressSchema.optional(),
    session_in_progress: z.object({
        started_at: z.string(),
        step: z.string(),
    }).optional(),
});

export type State = z.infer<typeof StateSchema>;
