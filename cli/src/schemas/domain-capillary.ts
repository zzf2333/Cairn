import { z } from "zod";

export const DomainConstraintsSchema = z.object({
    domain: z.string(),
    constraints: z.array(z.object({
        what: z.string(),
        reason: z.string(),
        source_event: z.string(),
        gravity: z.string(),
    })).default([]),
});
export type DomainConstraints = z.infer<typeof DomainConstraintsSchema>;

export const DomainAcceptedDebtSchema = z.object({
    domain: z.string(),
    debts: z.array(z.object({
        what: z.string(),
        reason: z.string(),
        source_event: z.string(),
        revisit_when: z.array(z.string()).default([]),
    })).default([]),
});
export type DomainAcceptedDebt = z.infer<typeof DomainAcceptedDebtSchema>;

export const DomainRejectedPathsSchema = z.object({
    domain: z.string(),
    paths: z.array(z.object({
        path: z.string(),
        reason: z.string(),
        source_event: z.string(),
    })).default([]),
});
export type DomainRejectedPaths = z.infer<typeof DomainRejectedPathsSchema>;

export const DomainCapillarySchema = z.object({
    constraints: DomainConstraintsSchema,
    accepted_debt: DomainAcceptedDebtSchema,
    rejected_paths: DomainRejectedPathsSchema,
});
export type DomainCapillary = z.infer<typeof DomainCapillarySchema>;
