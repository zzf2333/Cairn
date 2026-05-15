import type { CairnContext } from "../server.js";
import { toolResult } from "../errors.js";
import { DEFAULT_L3_AUTO_WRITE } from "../schemas/config.js";
import type { Signal, SignalType } from "../schemas/index.js";

interface SignalArgs {
    type: SignalType;
    domain?: string;
    details: {
        what: string;
        reason?: string;
        rejected_alternatives?: string[];
        revisit_when?: string[];
    };
    evidence: {
        user_said?: string;
        files?: string[];
        commit?: string;
    };
}

export function handleCairnSignal(ctx: CairnContext, args: SignalArgs) {
    const now = new Date().toISOString();
    const dateSlug = now.slice(0, 10).replace(/-/g, "_");
    const typeSlug = args.type.replace(/-/g, "_");

    const signal: Signal = {
        id: `sig_conv_${dateSlug}_${typeSlug}_${Date.now().toString(36)}`,
        source_ear: "conversation",
        signal_type: args.type,
        raw_data: {
            what: args.details.what,
            reason: args.details.reason,
            rejected_alternatives: args.details.rejected_alternatives,
            revisit_when: args.details.revisit_when,
            user_said: args.evidence.user_said,
            files: args.evidence.files,
            commit: args.evidence.commit,
            subject: args.details.what,
            scope: args.type === "user-constraint" ? "global" : "local",
        },
        inferred: {
            probable_type: inferMemoryType(args.type),
            probable_domain: args.domain,
            // Conversation signals default to medium confidence
            confidence: args.evidence.commit ? "high" : "medium",
        },
        captured_at: now,
    };

    // Load config for Trust Router
    let config;
    try {
        config = ctx.stateStore.loadConfig(ctx.paths.configYaml);
    } catch {
        // Use default config if not found
        config = {
            version: "2.0",
            project: { name: "unknown", created: now.slice(0, 7) },
            domains: { locked: [] },
            trust_policy: {
                L3_auto_write: DEFAULT_L3_AUTO_WRITE,
                L2_staged: [],
                never_auto: [],
            },
            stage: { override: null, auto_constraint: false },
            tech_stack: [],
        };
    }

    const result = ctx.trustRouter.route(signal, config);

    return toolResult(
        JSON.stringify(
            {
                accepted: result.level !== "L0",
                level: result.level,
                route: result.route,
                reason: result.reason,
            },
            null,
            2,
        ),
    );
}

function inferMemoryType(
    signalType: SignalType,
): string {
    switch (signalType) {
        case "user-rejection":
        case "dependency-removed":
        case "revert":
            return "rejection";
        case "decision":
        case "user-constraint":
        case "historical-reference":
            return "decision";
        case "dependency-replaced":
        case "large-refactor":
        case "stage-signal":
            return "transition";
        case "debt-acceptance":
            return "debt";
        default:
            return "decision";
    }
}
