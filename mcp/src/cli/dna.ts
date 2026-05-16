import { createContext } from "../context.js";
import { handleDnaList } from "../tools/cairn-dna-list.js";
import { handleDnaAccept } from "../tools/cairn-dna-accept.js";
import { handleDnaReject } from "../tools/cairn-dna-reject.js";

function parseToolResult(result: { content: Array<{ type: string; text: string }>; isError?: boolean }): unknown {
    if (result.isError) {
        console.error(result.content[0].text);
        process.exit(1);
    }
    return JSON.parse(result.content[0].text);
}

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
        const data = parseToolResult(await handleDnaList(ctx)) as {
            count: number;
            candidates: Array<{
                id: string;
                trait_name: string;
                level: string;
                confidence: number;
                evidence_events: string[];
                reasoning: string;
                proposed_at: string;
            }>;
        };
        if (data.count === 0) {
            console.log("No pending DNA candidates");
            return;
        }
        console.log(`${data.count} pending DNA candidate(s):\n`);
        for (const c of data.candidates) {
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
        const data = parseToolResult(await handleDnaAccept(ctx, { id })) as {
            success: boolean;
            trait_name: string;
            level: string;
            confidence: number;
            dna_status: string;
        };
        console.log(`Accepted: ${data.trait_name} (level=${data.level}, confidence=${data.confidence.toFixed(2)})`);
        console.log(`DNA status: ${data.dna_status}`);
        return;
    }

    if (sub === "reject") {
        const id = args[1];
        const reason = args.slice(2).join(" ");
        if (!id || !reason) {
            console.error("Usage: cairn dna reject <id> <reason>");
            process.exit(1);
        }
        const data = parseToolResult(await handleDnaReject(ctx, { id, reason })) as {
            success: boolean;
            trait_name: string;
        };
        console.log(`Rejected DNA candidate for trait: ${data.trait_name}`);
        return;
    }

    console.log("Usage: cairn dna <show|reevaluate|list|accept <id>|reject <id> <reason>>");
    process.exit(1);
}
