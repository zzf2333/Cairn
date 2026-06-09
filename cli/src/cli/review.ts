import { createContext } from "../context.js";

export async function runReview(args: string[] = []): Promise<void> {
    const ctx = await createContext(process.cwd());
    const asJson = args.includes("--json");

    const pending = await ctx.stagedStore.findPending();

    if (pending.length === 0) {
        if (asJson) {
            console.log(JSON.stringify({ pending: [] }, null, 2));
        } else {
            console.log("No pending staged entries");
        }
        return;
    }

    if (asJson) {
        console.log(JSON.stringify({
            pending: pending.map(entry => ({
                id: entry.id,
                type: entry.draft_event.type,
                domain: entry.draft_event.domain,
                gravity: entry.gravity,
                summary: entry.draft_event.decision_or_change,
                routing_reason: entry.routing_reason,
                confidence: entry.draft_event.evidence?.confidence ?? entry.draft_event.source.confidence,
                domain_confidence: entry.draft_event.evidence?.domain_confidence ?? null,
                domain_evidence: entry.draft_event.evidence?.domain_evidence ?? [],
                evidence: entry.draft_event.evidence ?? null,
                suggested_action: entry.governance_required === "human_ratified"
                    ? "accept or reject after human review"
                    : "can be auto-confirmed if still valid",
            })),
        }, null, 2));
        return;
    }

    console.log(`${pending.length} pending staged entries:\n`);
    for (const entry of pending) {
        const ev = entry.draft_event;
        console.log(`  id:      ${entry.id}`);
        console.log(`  type:    ${ev.type}`);
        console.log(`  domain:  ${ev.domain}`);
        console.log(`  gravity: ${entry.gravity}`);
        console.log(`  summary: ${ev.decision_or_change}`);
        console.log(`  reason:  ${entry.routing_reason}`);
        if (ev.evidence?.domain_confidence !== undefined) {
            console.log(`  domain confidence: ${ev.evidence.domain_confidence.toFixed(2)}`);
        }
        if (ev.evidence?.domain_evidence && ev.evidence.domain_evidence.length > 0) {
            console.log(`  domain evidence: ${ev.evidence.domain_evidence.join(", ")}`);
        }
        if (ev.evidence?.routing_reason) {
            console.log(`  evidence: ${ev.evidence.routing_reason}`);
        }
        console.log(`  suggested action: ${entry.governance_required === "human_ratified" ? "accept or reject after human review" : "can be auto-confirmed if still valid"}`);
        console.log();
    }
}
