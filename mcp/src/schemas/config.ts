import { z } from "zod";

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
            L3_auto_write: z.array(z.string()).default([
                "source.kind == 'git-revert' AND scope == 'local'",
                "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'",
            ]),
            L2_staged: z.array(z.string()).default([
                "scope == 'global'",
                "type == 'transition' AND affects_output == true",
            ]),
            never_auto: z.array(z.string()).default([
                "新增全局 no-go",
                "阶段变更",
                "output 级别 stack 变更",
                "scope == 'global' 的 behavior_effect",
            ]),
        })
        .default({}),

    stage: z
        .object({
            override: z.string().nullable().default(null),
            auto_constraint: z.boolean().default(false),
        })
        .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
