import { createContext } from "../context.js";

export async function runDna(args: string[]): Promise<void> {
    const sub = args[0];
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);

    if (sub === "show") {
        const identity = await ctx.dnaStore.loadIdentity();
        if (Object.keys(identity.traits).length === 0) {
            console.log("No DNA traits defined");
            return;
        }
        for (const [name, trait] of Object.entries(identity.traits)) {
            const drift = trait.drift_warning_count > 0 ? ` drift_warnings=${trait.drift_warning_count}` : "";
            console.log(`${name}: level=${trait.level} confidence=${trait.confidence}${drift}`);
        }
        if (identity.reevaluation_mode) {
            console.log("\nDNA is in reevaluation_mode (traits not modulating routing/challenges)");
        }
        return;
    }

    if (sub === "reevaluate") {
        const identity = await ctx.dnaStore.loadIdentity();
        identity.reevaluation_mode = !identity.reevaluation_mode;
        await ctx.dnaStore.saveIdentity(identity);
        const mode = identity.reevaluation_mode ? "active" : "passive";
        console.log(`DNA reevaluation mode: ${mode}`);
        return;
    }

    if (sub === "list") {
        const pending = await ctx.dnaStagedStore.findPending();
        if (pending.length === 0) {
            console.log("No pending DNA candidates");
            return;
        }
        console.log(`${pending.length} pending DNA candidate(s):\n`);
        for (const c of pending) {
            console.log(`  ${c.id}`);
            console.log(`    trait: ${c.trait_name} (level=${c.level}, confidence=${c.confidence.toFixed(2)})`);
            console.log(`    evidence: ${c.evidence_events.length} events`);
            console.log(`    reasoning: ${c.reasoning}`);
            console.log(`    proposed: ${c.proposed_at}\n`);
        }
        return;
    }

    if (sub === "accept") {
        const id = args[1];
        if (!id) {
            console.error("Usage: cairn dna accept <id>");
            process.exit(1);
        }
        const entry = await ctx.dnaStagedStore.load(id);
        if (!entry) throw new Error(`DNA staged entry "${id}" not found`);
        if (entry.review_status !== "pending") throw new Error(`DNA staged entry "${id}" already ${entry.review_status}`);

        const now = new Date().toISOString();
        const identity = await ctx.dnaStore.loadIdentity();
        const existing = identity.traits[entry.trait_name];

        identity.traits[entry.trait_name] = {
            level: entry.level,
            confidence: entry.confidence,
            evidence_count: (existing?.evidence_count ?? 0) + Math.max(1, entry.evidence_events.length),
            last_updated: now,
            reasoning: entry.reasoning,
            drift_warning_count: existing?.drift_warning_count ?? 0,
            last_safety_valve_at: existing?.last_safety_valve_at ?? null,
        };
        if (identity.status === "not_yet_emerged") identity.status = "emerging";
        if (Object.values(identity.traits).some(t => t.level === "high")) identity.status = "emerged";

        await ctx.dnaStore.saveIdentity(identity);
        entry.review_status = "accepted";
        await ctx.dnaStagedStore.save(entry);
        await ctx.governanceEngine.logAudit({ time: now, action: "ratified", target: entry.id, actor: "human" });
        await ctx.viewsEngine.regenerate();

        console.log(`Accepted: ${entry.trait_name} (level=${entry.level}, confidence=${entry.confidence.toFixed(2)})`);
        console.log(`DNA status: ${identity.status}`);
        return;
    }

    if (sub === "reject") {
        const id = args[1];
        const reason = args.slice(2).join(" ");
        if (!id || !reason) {
            console.error("Usage: cairn dna reject <id> <reason>");
            process.exit(1);
        }
        const entry = await ctx.dnaStagedStore.load(id);
        if (!entry) throw new Error(`DNA staged entry "${id}" not found`);
        if (entry.review_status !== "pending") throw new Error(`DNA staged entry "${id}" already ${entry.review_status}`);

        entry.review_status = "rejected";
        await ctx.dnaStagedStore.save(entry);
        await ctx.governanceEngine.logAudit({ time: new Date().toISOString(), action: "rejected", target: entry.id, actor: "human", reason });

        console.log(`Rejected DNA candidate for trait: ${entry.trait_name}`);
        return;
    }

    console.log("Usage: cairn dna <show|reevaluate|list|accept <id>|reject <id> <reason>>");
    process.exit(1);
}
