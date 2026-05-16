import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";

export async function handleDnaAccept(
    ctx: CairnContext,
    args: { id: string },
) {
    try {
        const entry = await ctx.dnaStagedStore.load(args.id);
        if (!entry) {
            throw new Error(`DNA staged entry "${args.id}" not found`);
        }
        if (entry.review_status !== "pending") {
            throw new Error(`DNA staged entry "${args.id}" already ${entry.review_status}`);
        }

        const now = new Date().toISOString();
        const identity = await ctx.dnaStore.loadIdentity();
        const existing = identity.traits[entry.trait_name];

        identity.traits[entry.trait_name] = {
            level: entry.level,
            confidence: entry.confidence,
            evidence_count: (existing?.evidence_count ?? 0) + entry.evidence_events.length,
            last_updated: now,
            reasoning: entry.reasoning,
            drift_warning_count: existing?.drift_warning_count ?? 0,
            last_safety_valve_at: existing?.last_safety_valve_at ?? null,
        };

        if (identity.status === "not_yet_emerged") {
            identity.status = "emerging";
        }
        if (Object.values(identity.traits).some(t => t.level === "high")) {
            identity.status = "emerged";
        }

        await ctx.dnaStore.saveIdentity(identity);

        entry.review_status = "accepted";
        await ctx.dnaStagedStore.save(entry);

        await ctx.governanceEngine.logAudit({
            time: now,
            action: "ratified",
            target: entry.id,
            actor: "human",
        });

        await ctx.viewsEngine.regenerate();

        return toolResult(JSON.stringify({
            success: true,
            trait_name: entry.trait_name,
            level: entry.level,
            confidence: entry.confidence,
            dna_status: identity.status,
            views_regenerated: true,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
