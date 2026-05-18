import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { GravityLevel } from "../constants.js";
import { buildEventFromSignalDetails, type SignalDetails, type SignalEvidence } from "../utils/signal-builder.js";

interface SignalArgs {
    signal_type: string;
    domain?: string;
    details: SignalDetails;
    evidence: SignalEvidence;
}

export async function handleSignal(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const {
            signal_type: signalType,
            domain,
            details,
            evidence,
        } = args as unknown as SignalArgs;

        const { event, eventType, gravity } = buildEventFromSignalDetails({
            signalType,
            domain,
            details,
            evidence,
        });

        const routing = await ctx.trustRouter.route({
            domain: event.domain,
            subject_name: details.what,
            type: eventType,
            gravity,
        });

        let challenges: Array<{ level: string; conflict_with: string; description: string }> = [];

        if (routing.merged_with) {
            if (event.source.refs.length > 0) {
                await ctx.bloodEngine.mergeRefs(routing.merged_with, event.source.refs);
            }
        } else if (routing.destination === "blood") {
            event.governance_status = "auto_confirmed";
            await ctx.bloodEngine.commit(event);
        } else if (routing.destination === "staged") {
            event.governance_status = "pending";
            await ctx.stagedStore.save({
                id: event.id,
                draft_event: event,
                review_status: "pending",
                routing_reason: routing.reason,
                gravity: routing.gravity,
                governance_required: routing.governance === "human_ratified"
                    ? "human_ratified"
                    : "auto_confirmable",
                created_at: event.created_at,
            });
        }

        const detected = await ctx.challengeEngine.detectConflicts({
            task: details.what,
            domain: event.domain,
            subject_name: details.what,
        });
        challenges = detected.map(c => ({
            level: c.level,
            conflict_with: c.conflict_with,
            description: c.description,
            required_response: c.required_response,
            archived: c.archived,
            trauma: c.trauma,
        }));

        return toolResult(JSON.stringify({
            accepted: true,
            routing: {
                level: routing.gravity,
                destination: routing.destination,
                governance: routing.governance,
            },
            challenges,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
