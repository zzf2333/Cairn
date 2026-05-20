import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { GravityLevel } from "../constants.js";
import { buildEventFromSignalDetails, type SignalDetails, type SignalEvidence } from "../utils/signal-builder.js";

interface ObserveCandidate {
    signal_type: string;
    domain?: string;
    details: SignalDetails;
    evidence: SignalEvidence;
    recommendation: "capture" | "skip";
    recommendation_reason: string;
}

interface ObserveArgs {
    summary: string;
    candidates: ObserveCandidate[];
}

export async function handleObserve(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const { summary, candidates } = args as unknown as ObserveArgs;
        const now = new Date().toISOString();

        await ctx.stateStore.markObserveCalled();

        const results: Array<{
            what: string;
            signal_type: string;
            recommendation: string;
            action_taken: string;
            routing?: { level: string; destination: string; governance: string };
            challenges?: Array<{ level: string; conflict_with: string; description: string }>;
        }> = [];

        for (const candidate of candidates) {
            if (candidate.recommendation === "skip") {
                results.push({
                    what: candidate.details.what,
                    signal_type: candidate.signal_type,
                    recommendation: "skip",
                    action_taken: "skipped_by_ai",
                });
                continue;
            }

            const { event, eventType, gravity } = buildEventFromSignalDetails({
                signalType: candidate.signal_type,
                domain: candidate.domain,
                details: candidate.details,
                evidence: candidate.evidence,
                idPrefix: "evt_obs",
            });

            const routing = await ctx.trustRouter.route({
                domain: event.domain,
                subject_name: candidate.details.what,
                type: eventType,
                gravity,
            });

            if (routing.merged_with) {
                if (event.source.refs.length > 0) {
                    await ctx.bloodEngine.mergeRefs(routing.merged_with, event.source.refs);
                }
                const mergeConflicts = await ctx.challengeEngine.detectConflicts({
                    task: candidate.details.what,
                    domain: event.domain,
                    subject_name: candidate.details.what,
                });
                results.push({
                    what: candidate.details.what,
                    signal_type: candidate.signal_type,
                    recommendation: "capture",
                    action_taken: "merged",
                    routing: { level: routing.gravity, destination: "blood", governance: routing.governance },
                    challenges: mergeConflicts.length > 0
                        ? mergeConflicts.map(c => ({
                            level: c.level,
                            conflict_with: c.conflict_with,
                            description: c.description,
                        }))
                        : undefined,
                });
                continue;
            }

            event.gravity.level = routing.gravity;

            if (routing.destination === "blood") {
                event.governance_status = "auto_confirmed";
                await ctx.bloodEngine.commit(event);
            } else if (routing.destination === "staged") {
                event.governance_status = "pending";
                await ctx.stagedStore.save({
                    id: event.id,
                    draft_event: event,
                    review_status: "pending",
                    routing_reason: routing.reason,
                    gravity: routing.gravity as GravityLevel,
                    governance_required: routing.governance === "human_ratified"
                        ? "human_ratified"
                        : "auto_confirmable",
                    created_at: now,
                });
            }

            const detected = await ctx.challengeEngine.detectConflicts({
                task: candidate.details.what,
                domain: event.domain,
                subject_name: candidate.details.what,
            });

            results.push({
                what: candidate.details.what,
                signal_type: candidate.signal_type,
                recommendation: "capture",
                action_taken: routing.destination,
                routing: {
                    level: routing.gravity,
                    destination: routing.destination,
                    governance: routing.governance,
                },
                challenges: detected.length > 0
                    ? detected.map(c => ({
                        level: c.level,
                        conflict_with: c.conflict_with,
                        description: c.description,
                    }))
                    : undefined,
            });
        }

        const captured = results.filter(r => r.recommendation === "capture" && r.action_taken !== "dropped").length;
        const skipped = results.filter(r => r.recommendation === "skip").length;
        const staged = results.filter(r => r.action_taken === "staged").length;

        if (captured > 0) {
            await ctx.stateStore.touchSession();
        }
        await ctx.stateStore.recordObserveStats(candidates.length, captured);

        return toolResult(JSON.stringify({
            observed: true,
            summary,
            total_candidates: candidates.length,
            captured,
            skipped,
            staged,
            results,
            instruction: staged > 0
                ? "Some candidates were staged for human review. Present them before committing."
                : "All captured candidates processed. Safe to proceed with commit.",
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
