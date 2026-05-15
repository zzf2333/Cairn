import { z } from "zod";

export const DEFAULT_L3_AUTO_WRITE: string[] = [
    "source.kind == 'git-revert' AND scope == 'local'",
    "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'",
    "source.kind == 'conversation' AND type == 'rejection'",
    "source.kind == 'conversation' AND type == 'decision'",
    "source.kind == 'conversation' AND type == 'debt'",
];

export const ConfigSchema = z.object({
    version: z.string().default("2.0"),

    project: z.object({
        name: z.string(),
        created: z.string(),
    }),

    domains: z
        .object({
            locked: z.array(z.string()).default([]),
        })
        .default({ locked: [] }),

    trust_policy: z
        .object({
            L3_auto_write: z.array(z.string()).default(DEFAULT_L3_AUTO_WRITE),
            L2_staged: z.array(z.string()).default([
                "scope == 'global'",
                "type == 'transition' AND affects_output == true",
            ]),
            never_auto: z.array(z.string()).default([
                "New global no-go",
                "Stage change",
                "Output-level stack change",
                "scope == 'global' behavior_effect",
            ]),
        })
        .default({}),

    stage: z
        .object({
            override: z.string().nullable().default(null),
            auto_constraint: z.boolean().default(false),
        })
        .default({}),

    tech_stack: z
        .array(z.object({
            name: z.string(),
            domain: z.string(),
            summary: z.string(),
        }))
        .default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
