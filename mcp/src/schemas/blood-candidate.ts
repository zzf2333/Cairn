import { z } from "zod";
import {
    GRAVITY_LEVELS, BEHAVIOR_EFFECT_TYPES, SOURCE_TYPES, VALIDITY_LEVELS,
} from "./shared.js";
import { EVENT_TYPES } from "./evolution-event.js";

export const BloodCandidateSchema = z.object({
    type: z.enum(EVENT_TYPES),
    domain: z.string(),
    gravity: z.object({ level: z.enum(GRAVITY_LEVELS) }),
    summary: z.string(),
    rejected_paths: z.array(z.object({
        path: z.string(),
        reason: z.string(),
    })).optional(),
    behavior_effect: z.object({
        type: z.enum(BEHAVIOR_EFFECT_TYPES),
        instruction: z.string(),
    }),
    revisit: z.object({
        when: z.array(z.string()),
    }).optional(),
    trauma: z.object({
        is_trauma: z.boolean(),
        sensitivity_multiplier: z.number().optional(),
    }).optional(),
    source: z.object({
        type: z.enum(SOURCE_TYPES),
        confidence: z.number().min(0).max(1),
        refs: z.array(z.object({ type: z.string(), id: z.string() })).optional(),
    }),
    lifecycle: z.object({
        validity: z.enum(VALIDITY_LEVELS),
        review_after: z.string().optional(),
    }),
});

export type BloodCandidate = z.infer<typeof BloodCandidateSchema>;
