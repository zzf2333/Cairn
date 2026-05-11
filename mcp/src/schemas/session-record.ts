import { z } from "zod";

export const SessionRecordSchema = z.object({
    id: z.string(),
    started_at: z.string(),
    ended_at: z.string(),
    summary: z.string(),
    signals_captured: z.number().default(0),
    signals_routed: z
        .object({
            L0: z.number().default(0),
            L1: z.number().default(0),
            L2: z.number().default(0),
            L3: z.number().default(0),
        })
        .default({}),
    domains_touched: z.array(z.string()).default([]),
    decisions_made: z.array(z.string()).default([]),
    unresolved: z.array(z.string()).default([]),
    context_injections: z
        .array(
            z.object({
                tool: z.string(),
                domains_returned: z.array(z.string()).default([]),
                no_go_returned: z.array(z.string()).default([]),
            }),
        )
        .default([]),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;
