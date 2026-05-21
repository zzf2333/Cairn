import { z } from "zod";
import { EvolutionEventSchema } from "./evolution-event.js";
import { GravityLevelEnum, GovernanceStatusEnum } from "./shared.js";

export const STAGED_REVIEW_STATUSES = ["pending", "accepted", "rejected", "expired"] as const;

export const StagedEntrySchema = z.object({
    id: z.string(),
    origin_signal: z.string().optional(),
    draft_event: EvolutionEventSchema,
    review_status: z.enum(STAGED_REVIEW_STATUSES).default("pending"),
    routing_reason: z.string(),
    gravity: GravityLevelEnum,
    governance_required: z.enum(["auto_confirmable", "human_ratified"]),
    created_at: z.string(),
});

export type StagedEntry = z.infer<typeof StagedEntrySchema>;
