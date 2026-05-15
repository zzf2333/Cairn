import { z } from "zod";

export const STABILITY_LEVELS = ["stable", "evolving", "unstable"] as const;

export const SkeletonNodeSchema = z.object({
    domain: z.string(),
    role: z.string(),
    owns: z.array(z.string()).default([]),
    does_not_own: z.array(z.string()).default([]),
    stability: z.enum(STABILITY_LEVELS).default("stable"),
    dependencies: z.array(z.string()).default([]),
    causal_keywords: z.array(z.string()).default([]),
});

export type SkeletonNode = z.infer<typeof SkeletonNodeSchema>;
