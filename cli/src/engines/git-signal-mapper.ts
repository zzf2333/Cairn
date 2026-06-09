import type { GitSignal, EvolutionEvent } from "../schemas/index.js";

const MAPPER_VERSION = "git-signal-mapper:v2";

const ARCHITECTURE_MESSAGE_PATTERN = /\b(migration|migrate|refactor|architecture|restructure|split|extract|move|remove legacy)\b|迁移|重构|架构|拆分|移除/i;
const ARCHITECTURE_DOC_PATTERN = /(^|\/)docs\/.*(architecture|design|technical|runtime|infrastructure|prd|direction|philosophy).*\.md$/i;
const API_BOUNDARY_PATTERN = /(^|\/)(api|routes|runtime|queue|db|schema|migration|packages\/shared|packages\/validation)(\/|$)/i;
const LOW_SIGNAL_FILE_PATTERN = /(^|\/)(AGENTS\.md|CLAUDE\.md|README\.md|\.gitignore|[^/]*lock[^/]*|routeTree\.gen\.ts)$/i;
const GENERATED_FILE_PATTERN = /(\.gen\.ts|\.map|dist\/|coverage\/|node_modules\/)/i;

function evidenceFor(signal: GitSignal, routingReason: string): EvolutionEvent["evidence"] {
    return {
        source_signal_id: signal.id,
        mapper_version: MAPPER_VERSION,
        routing_reason: routingReason,
        confidence: signal.confidence,
        domain_confidence: signal.inferred_domain_confidence,
        domain_evidence: signal.raw_data.domain_evidence ?? [],
        signal_snapshot: {
            signal_type: signal.signal_type,
            commits: signal.raw_data.commits ?? [],
            files_changed: signal.raw_data.files_changed ?? [],
            commit_message: signal.raw_data.commit_message,
        },
    };
}

function isLowSignalOnly(files: string[]): boolean {
    const meaningful = files.filter(f => !GENERATED_FILE_PATTERN.test(f));
    return meaningful.length === 0 || meaningful.every(f =>
        LOW_SIGNAL_FILE_PATTERN.test(f)
        || f.startsWith("docs/")
        || f.startsWith(".github/")
    );
}

function assessLargeRefactor(signal: GitSignal): {
    accepted: boolean;
    reason: string;
    subject: string;
    decision: string;
    instruction: string;
} {
    const files = signal.raw_data.files_changed ?? [];
    const message = signal.raw_data.commit_message ?? "";
    const domain = signal.inferred_domain ?? "global";
    const hasArchitectureMessage = ARCHITECTURE_MESSAGE_PATTERN.test(message);
    const hasArchitectureDocs = files.some(f => ARCHITECTURE_DOC_PATTERN.test(f));
    const hasApiBoundary = files.some(f => API_BOUNDARY_PATTERN.test(f));
    const hasStrongDomain = (signal.inferred_domain_confidence ?? 0) >= 0.7
        && !["global", "unknown", "multi"].includes(domain);

    if (isLowSignalOnly(files) && !hasArchitectureMessage) {
        return {
            accepted: false,
            reason: "dropped large refactor: docs/config/generated-only change without architecture message",
            subject: "",
            decision: "",
            instruction: "",
        };
    }

    const reasons: string[] = [];
    if (hasArchitectureMessage) reasons.push("architecture-like commit message");
    if (hasArchitectureDocs) reasons.push("architecture/design docs changed");
    if (hasApiBoundary) reasons.push("API/runtime boundary paths changed");
    if (hasStrongDomain) reasons.push(`strong ${domain} path ownership evidence`);

    if (reasons.length === 0) {
        return {
            accepted: false,
            reason: "dropped large refactor: file count alone is not enough evidence",
            subject: "",
            decision: "",
            instruction: "",
        };
    }

    const scope = domain === "multi" ? "multiple domains" : domain;
    const messageSummary = message.trim() || `${files.length} files changed`;
    return {
        accepted: true,
        reason: `staged large refactor: ${reasons.join(", ")}`,
        subject: `${scope} structural change`,
        decision: messageSummary,
        instruction: `Review ${scope} structure change before assuming old layout or behavior still applies`,
    };
}

export function mapGitSignalToEvent(signal: GitSignal, now: string): EvolutionEvent | null {
    const domain = signal.inferred_domain ?? "global";
    const commitRef = signal.raw_data.commits?.[0];
    const refs = commitRef ? [{ type: "commit", id: commitRef }] : [];

    const baseSource = {
        confidence: signal.confidence,
        verified: false,
        refs,
    };

    const baseShared = {
        time: signal.captured_at,
        domain,
        gravity: { level: signal.inferred_gravity },
        constraints_added: [] as string[],
        constraints_removed: [] as string[],
        accepted_debt: [] as string[],
        affects: { skeleton: false, dna: false, domains: [domain] },
        supersedes: null,
        conflicts_with: [] as string[],
        related: [] as string[],
        health: { state: "ok" as const, reason: null },
        trauma: {
            is_trauma: false,
            sensitivity_multiplier: 1.0,
            decay_override: null,
            affects_dna: false,
            requires_human_ratification: true,
        },
        created_at: now,
        updated_at: now,
        governance_status: "pending" as const,
    };

    switch (signal.signal_type) {
        case "revert": {
            const shortRef = commitRef?.slice(0, 7) ?? "unknown";
            return {
                ...baseShared,
                id: `evt_git_${domain}_revert_${shortRef}`,
                type: "rejection",
                source: { type: "git_revert", ...baseSource },
                subject: { name: `reverted commit ${shortRef}`, aliases: [] },
                trigger: "git revert detected",
                decision_or_change: `previous direction at ${shortRef} reverted`,
                rejected_paths: [],
                reasoning: "a revert commit suggests the prior direction was abandoned",
                behavior_effect: {
                    type: "warn_before",
                    instruction: `previous direction at ${shortRef} was reverted; investigate before similar attempts`,
                },
                lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
                evidence: evidenceFor(signal, "git revert detected"),
            };
        }

        case "dependency_removed": {
            const removed = signal.raw_data.packages?.removed ?? [];
            if (removed.length === 0) return null;
            const pkg = removed[0];
            return {
                ...baseShared,
                id: `evt_git_${domain}_dep_removed_${pkg.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
                type: "transition",
                source: { type: "git_dependency", ...baseSource },
                subject: { type: "dependency", name: pkg, aliases: [] },
                trigger: `${pkg} removed from dependencies`,
                decision_or_change: `dependency removed: ${pkg}`,
                rejected_paths: [],
                reasoning: "git diff shows the dependency was removed without replacement",
                behavior_effect: {
                    type: "avoid_suggestion",
                    instruction: `do not reintroduce ${pkg} without strong justification`,
                },
                lifecycle: { validity: "strategic", decay_policy: "downgrade", resurrection_count: 0 },
                evidence: evidenceFor(signal, `${pkg} removed from dependency file`),
            };
        }

        case "dependency_replaced": {
            const replaced = signal.raw_data.packages?.replaced ?? [];
            if (replaced.length === 0) return null;
            const pair = replaced[0];
            return {
                ...baseShared,
                id: `evt_git_${domain}_dep_replaced_${pair.to.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
                type: "transition",
                source: { type: "git_dependency", ...baseSource },
                subject: { type: "dependency", name: pair.to, aliases: [pair.from] },
                trigger: `dependency replaced: ${pair.from} → ${pair.to}`,
                decision_or_change: `${pair.from} replaced with ${pair.to}`,
                rejected_paths: [{ path: pair.from, reason: `replaced by ${pair.to}` }],
                reasoning: "git diff shows the dependency was replaced",
                behavior_effect: {
                    type: "prefer_approach",
                    instruction: `prefer ${pair.to} over ${pair.from}`,
                },
                lifecycle: { validity: "strategic", decay_policy: "downgrade", resurrection_count: 0 },
                evidence: evidenceFor(signal, `dependency replacement ${pair.from} -> ${pair.to}`),
            };
        }

        case "large_refactor": {
            const assessment = assessLargeRefactor(signal);
            if (!assessment.accepted) return null;
            return {
                ...baseShared,
                id: `evt_git_${domain}_refactor_${commitRef?.slice(0, 7) ?? "unknown"}`,
                type: "architecture_decision",
                source: { type: "runtime_observed", ...baseSource },
                subject: { name: assessment.subject, aliases: [] },
                trigger: assessment.reason,
                decision_or_change: assessment.decision,
                rejected_paths: [],
                reasoning: assessment.reason,
                behavior_effect: {
                    type: "require_review",
                    instruction: assessment.instruction,
                },
                lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
                evidence: evidenceFor(signal, assessment.reason),
            };
        }

        default:
            return null;
    }
}
