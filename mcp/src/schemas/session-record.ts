import { z } from "zod";

export const SessionRecordSchema = z.object({
    id: z.string(),
    started_at: z.string(),
    ended_at: z.string(),
    summary: z.string(),
    signals_captured: z.number().int().default(0),
    signals_routed: z.object({
        G0: z.number().int().default(0),
        G1: z.number().int().default(0),
        G2: z.number().int().default(0),
        G3: z.number().int().default(0),
    }).default({}),
    domains_touched: z.array(z.string()).default([]),
    decisions_made: z.array(z.string()).default([]),
    unresolved: z.array(z.string()).default([]),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;
