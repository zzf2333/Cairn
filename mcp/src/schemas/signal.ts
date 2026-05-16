import { z } from "zod";
import { GravityLevelEnum } from "./shared.js";

export const GIT_SIGNAL_TYPES = [
    "revert", "dependency_removed", "dependency_replaced",
    "large_refactor",
] as const;

export const GitSignalSchema = z.object({
    id: z.string(),
    signal_type: z.enum(GIT_SIGNAL_TYPES),
    raw_data: z.object({
        commits: z.array(z.string()).optional(),
        files_changed: z.array(z.string()).optional(),
        packages: z.object({
            added: z.array(z.string()).optional(),
            removed: z.array(z.string()).optional(),
            replaced: z.array(z.object({
                from: z.string(),
                to: z.string(),
            })).optional(),
        }).optional(),
        stats: z.object({
            commit_count_30d: z.number().optional(),
            project_avg: z.number().optional(),
        }).optional(),
    }).default({}),
    inferred_gravity: GravityLevelEnum,
    inferred_domain: z.string().optional(),
    confidence: z.number().min(0).max(1),
    captured_at: z.string(),
});
export type GitSignal = z.infer<typeof GitSignalSchema>;

export const CONVERSATION_SIGNAL_TYPES = [
    "user_rejection", "historical_reference",
    "constraint_declaration", "decision",
    "debt_acceptance", "stage_constraint",
] as const;

export const ConversationSignalSchema = z.object({
    id: z.string(),
    signal_type: z.enum(CONVERSATION_SIGNAL_TYPES),
    domain: z.string().optional(),
    details: z.object({
        what: z.string(),
        reason: z.string().optional(),
        rejected_alternatives: z.array(z.object({
            path: z.string(),
            reason: z.string(),
        })).optional(),
        revisit_when: z.array(z.string()).optional(),
    }),
    evidence: z.object({
        user_said: z.string().optional(),
        files: z.array(z.string()).optional(),
        commit_ref: z.string().optional(),
    }).default({}),
    confidence: z.number().min(0).max(1),
    captured_at: z.string(),
});
export type ConversationSignal = z.infer<typeof ConversationSignalSchema>;

export const CALIBRATION_SIGNAL_TYPES = [
    "calibration_conflict", "skeleton_drift",
    "debt_resolution_candidate", "dna_drift_warning",
    "dna_safety_valve_triggered",
] as const;

export const CalibrationSignalSchema = z.object({
    id: z.string(),
    signal_type: z.enum(CALIBRATION_SIGNAL_TYPES),
    domain: z.string().optional(),
    affected_trait: z.string().optional(),
    description: z.string(),
    evidence: z.object({
        expected: z.string(),
        actual: z.string(),
        source: z.string(),
    }),
    inferred_gravity: GravityLevelEnum,
    confidence: z.number().min(0).max(1),
    captured_at: z.string(),
});
export type CalibrationSignal = z.infer<typeof CalibrationSignalSchema>;

export type Signal = GitSignal | ConversationSignal | CalibrationSignal;
