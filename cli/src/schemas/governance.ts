import { z } from "zod";
import { COGNITIVE_MODES } from "./config.js";

export const GovernancePolicySchema = z.object({
    cognitive_mode: z.enum(COGNITIVE_MODES).default("standard"),
});
export type GovernancePolicy = z.infer<typeof GovernancePolicySchema>;

export const AUDIT_ACTIONS = [
    "ratified", "auto_confirmed", "rejected",
    "archived", "resurrected",
    "trauma_marked", "trauma_removed",
    "dna_updated", "skeleton_updated",
    "stage_confirmed",
] as const;

export const AuditEntrySchema = z.object({
    time: z.string(),
    action: z.enum(AUDIT_ACTIONS),
    target: z.string(),
    actor: z.enum(["human", "system", "agent"]),
    reason: z.string().optional(),
    evidence: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditLogSchema = z.array(AuditEntrySchema).default([]);
