import { z } from "zod";

export const STAGE_PHASES = [
    "exploration",
    "growth",
    "maturity",
    "maintenance",
] as const;

export const StageEvidenceSchema = z.object({
    source: z.enum(["git", "conversation", "manual"]),
    signal: z.string(),
});

export const StageSnapshotSchema = z.object({
    phase: z.enum(STAGE_PHASES).default("growth"),
    confidence: z.number().min(0).max(1).default(0.4),
    status: z.enum(["advisory", "confirmed"]).default("advisory"),
    evidence: z.array(StageEvidenceSchema).default([]),
    guidance: z.array(z.string()).default([]),
    last_updated: z.string(),
});

export type StageSnapshot = z.infer<typeof StageSnapshotSchema>;
export type StagePhase = z.infer<typeof StageSnapshotSchema>["phase"];
