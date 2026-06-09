import { createContext } from "../context.js";
import type { StagedEntry } from "../schemas/index.js";

export interface ReviewCluster {
    id: string;
    count: number;
    sample_ids: string[];
    reason: string;
    suggested_action: string;
}

function eventSummary(entry: StagedEntry): string {
    return `${entry.draft_event.trigger} ${entry.draft_event.decision_or_change} ${entry.routing_reason}`.toLowerCase();
}

export function isLegacyNoisyLargeRefactor(entry: StagedEntry): boolean {
    const ev = entry.draft_event;
    if (ev.source.type !== "runtime_observed") return false;
    if (ev.evidence) return false;
    if (ev.type !== "architecture_decision") return false;
    if (entry.gravity !== "G2") return false;

    const text = eventSummary(entry);
    return text.includes("large refactor")
        && (
            text.includes("files changed")
            || text.includes("refactored apps")
            || text.includes("refactored docs")
            || text.includes("refactored agents.md")
            || text.includes("refactored claude.md")
            || text.includes("refactored .gitignore")
        );
}

export function clusterStagedEntries(entries: StagedEntry[]): ReviewCluster[] {
    const clusters: ReviewCluster[] = [];
    const noisyLargeRefactors = entries.filter(isLegacyNoisyLargeRefactor);
    if (noisyLargeRefactors.length > 0) {
        clusters.push({
            id: "noisy-large-refactor",
            count: noisyLargeRefactors.length,
            sample_ids: noisyLargeRefactors.slice(0, 5).map(entry => entry.id),
            reason: "legacy large-refactor entries without mapper evidence or domain confidence",
            suggested_action: "dismiss after dry-run review if samples are non-decisions",
        });
    }

    const missingEvidence = entries.filter(entry =>
        !entry.draft_event.evidence
        && !isLegacyNoisyLargeRefactor(entry)
        && entry.draft_event.source.type === "runtime_observed",
    );
    if (missingEvidence.length > 0) {
        clusters.push({
            id: "missing-evidence",
            count: missingEvidence.length,
            sample_ids: missingEvidence.slice(0, 5).map(entry => entry.id),
            reason: "runtime-observed staged entries predate evidence metadata",
            suggested_action: "review manually; do not batch dismiss by default",
        });
    }

    return clusters;
}

function printClusters(clusters: ReviewCluster[]): void {
    if (clusters.length === 0) {
        console.log("No review clusters detected");
        return;
    }
    console.log(`${clusters.length} review cluster(s):\n`);
    for (const cluster of clusters) {
        console.log(`  id:      ${cluster.id}`);
        console.log(`  count:   ${cluster.count}`);
        console.log(`  samples: ${cluster.sample_ids.join(", ")}`);
        console.log(`  reason:  ${cluster.reason}`);
        console.log(`  action:  ${cluster.suggested_action}`);
        console.log();
    }
}

export async function runReview(args: string[] = []): Promise<void> {
    const ctx = await createContext(process.cwd());
    const asJson = args.includes("--json");
    const wantsClusters = args.includes("--clusters");

    const pending = await ctx.stagedStore.findPending();

    if (args[0] === "dismiss") {
        const clusterIndex = args.indexOf("--cluster");
        const clusterId = clusterIndex >= 0 ? args[clusterIndex + 1] : null;
        const yes = args.includes("--yes");
        const dryRun = args.includes("--dry-run") || !yes;

        if (clusterId !== "noisy-large-refactor") {
            throw new Error("Only --cluster noisy-large-refactor is currently batch-dismissible");
        }

        const matches = pending.filter(isLegacyNoisyLargeRefactor);
        if (!dryRun) {
            const nowIso = new Date().toISOString();
            for (const entry of matches) {
                await ctx.stagedStore.remove(entry.id);
                await ctx.governanceStore.appendAudit({
                    time: nowIso,
                    action: "rejected",
                    target: entry.draft_event.id,
                    actor: "system",
                    reason: "batch dismissed noisy legacy large-refactor review cluster",
                });
            }
        }

        const result = {
            cluster: clusterId,
            dry_run: dryRun,
            matched: matches.length,
            affected_ids: matches.map(entry => entry.id),
        };
        if (asJson) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(`${dryRun ? "Would reject" : "Rejected"} ${matches.length} staged entr${matches.length === 1 ? "y" : "ies"} from ${clusterId}`);
        }
        return;
    }

    if (wantsClusters) {
        const clusters = clusterStagedEntries(pending);
        if (asJson) {
            console.log(JSON.stringify({ clusters }, null, 2));
        } else {
            printClusters(clusters);
        }
        return;
    }

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
