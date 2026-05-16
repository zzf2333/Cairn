import type { GitSignal, EvolutionEvent } from "../schemas/index.js";

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
            };
        }

        case "large_refactor": {
            const files = signal.raw_data.files_changed ?? [];
            const topDir = files[0]?.split("/")[0] ?? "unknown";
            return {
                ...baseShared,
                id: `evt_git_${domain}_refactor_${commitRef?.slice(0, 7) ?? "unknown"}`,
                type: "architecture_decision",
                source: { type: "runtime_observed", ...baseSource },
                subject: { name: `large refactor in ${topDir}`, aliases: [] },
                trigger: `large refactor detected (${files.length} files in one commit)`,
                decision_or_change: `refactored ${topDir} (${files.length} files)`,
                rejected_paths: [],
                reasoning: `${files.length} files changed in a single commit suggests an intentional refactor`,
                behavior_effect: {
                    type: "prefer_approach",
                    instruction: `recent refactor in ${topDir}; respect the new structure`,
                },
                lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
            };
        }

        case "commit_frequency_change":
        case "new_contributor":
        case "todo_fixme_cluster":
            return null;

        default:
            return null;
    }
}
