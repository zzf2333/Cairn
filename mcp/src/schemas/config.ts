import { z } from "zod";

export const COGNITIVE_MODES = ["lightweight", "standard", "institutional"] as const;

export const ConfigSchema = z.object({
    version: z.literal("3.0"),
    project: z.object({
        name: z.string(),
        created: z.string(),
    }),
    domains: z.array(z.string()).default([]),
    cognitive_mode: z.enum(COGNITIVE_MODES).default("standard"),
    stage: z.object({
        override: z.string().nullable().default(null),
    }).default({}),
    tech_stack: z.array(z.object({
        name: z.string(),
        domain: z.string(),
        summary: z.string(),
    })).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
