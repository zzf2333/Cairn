import type { Signal } from "../schemas/index.js";
import type { Config } from "../schemas/config.js";
import type { MemoryEntry } from "../schemas/memory-entry.js";
import type { StagedEntry } from "../schemas/staged-entry.js";
import type { MemoryStore } from "../stores/memory-store.js";
import type { SignalStore } from "../stores/signal-store.js";
import type { StagedStore } from "../stores/staged-store.js";
import type { MemoryEngine } from "./memory-engine.js";
import type { StateStore } from "../stores/state-store.js";

export interface RoutingResult {
    level: "L0" | "L1" | "L2" | "L3";
    route: "dropped" | "signals" | "staged" | "memory";
    reason: string;
}

const L1_ACCUMULATION_THRESHOLD = 3;

export class TrustRouter {
    constructor(
        private memoryStore: MemoryStore,
        private signalStore: SignalStore,
        private stagedStore: StagedStore,
        private memoryEngine: MemoryEngine,
        private stateStore: StateStore,
    ) {}

    route(signal: Signal, config: Config): RoutingResult {
        const domain = signal.inferred.probable_domain ?? "unknown";
        const subjectName =
            (signal.raw_data as Record<string, unknown>)["subject"] as string ??
            (signal.raw_data as Record<string, unknown>)["what"] as string ??
            signal.signal_type;

        // 1. Duplicate check
        const existing = this.memoryStore.findDuplicate(
            domain,
            subjectName,
            signal.inferred.probable_type ?? signal.signal_type,
        );
        if (existing) {
            existing.source.refs.push({
                type: "session",
                id: signal.id,
            });
            existing.updated_at = new Date().toISOString();
            this.memoryStore.save(existing);
            return {
                level: "L0",
                route: "dropped",
                reason: "Merged into existing memory entry: " + existing.id,
            };
        }

        // 2. Hard rule L2 check (never_auto — not configurable)
        if (this.isHardL2(signal)) {
            this.writeStaged(signal, domain, subjectName, "Hard rule: requires human review");
            return {
                level: "L2",
                route: "staged",
                reason: "Hard rule L2: " + this.hardL2Reason(signal),
            };
        }

        // 3. Config L2 check
        if (this.matchesL2Policy(signal, config)) {
            this.writeStaged(signal, domain, subjectName, "Policy rule: requires human review");
            return {
                level: "L2",
                route: "staged",
                reason: "Config L2 policy match",
            };
        }

        // 4. L3 auto-write check
        if (this.matchesL3Policy(signal, config)) {
            const memory = this.signalToMemory(signal, domain, subjectName);
            this.memoryEngine.write(memory);
            return {
                level: "L3",
                route: "memory",
                reason: "L3 auto-write: conditions met",
            };
        }

        // 5. Confidence-based routing
        const confidence = signal.inferred.confidence ?? "medium";
        if (confidence === "low") {
            return {
                level: "L0",
                route: "dropped",
                reason: "Low confidence signal dropped",
            };
        }

        // L1 — save to signals
        this.signalStore.save(signal);

        // Check L1 accumulation
        const count = this.signalStore.countByDomainAndSubject(
            domain,
            subjectName,
        );
        if (count >= L1_ACCUMULATION_THRESHOLD) {
            this.writeStaged(
                signal,
                domain,
                subjectName,
                `L1 accumulation: ${count} signals for same domain+subject`,
            );
            return {
                level: "L2",
                route: "staged",
                reason: `L1→L2 upgrade: ${count} accumulated signals`,
            };
        }

        return {
            level: "L1",
            route: "signals",
            reason: "Saved to candidate pool",
        };
    }

    private isHardL2(signal: Signal): boolean {
        const raw = signal.raw_data as Record<string, unknown>;
        const scope = raw["scope"] as string | undefined;
        const type = signal.signal_type;

        // Global scope behavior_effect
        if (scope === "global") return true;

        // Stage change signal
        if (type === "stage-signal") return true;

        // Global no-go
        if (
            type === "user-rejection" &&
            scope === "global"
        )
            return true;

        return false;
    }

    private hardL2Reason(signal: Signal): string {
        const raw = signal.raw_data as Record<string, unknown>;
        if (raw["scope"] === "global") return "global scope requires review";
        if (signal.signal_type === "stage-signal")
            return "stage change requires review";
        return "hard rule match";
    }

    private matchesL2Policy(signal: Signal, config: Config): boolean {
        const raw = signal.raw_data as Record<string, unknown>;
        const scope = raw["scope"] as string | undefined;
        const type = signal.inferred.probable_type ?? signal.signal_type;

        for (const rule of config.trust_policy.L2_staged) {
            if (rule.includes("scope == 'global'") && scope === "global")
                return true;
            if (
                rule.includes("type == 'transition'") &&
                type === "transition"
            )
                return true;
        }
        return false;
    }

    private matchesL3Policy(signal: Signal, config: Config): boolean {
        const sourceKind = this.inferSourceKind(signal);
        const raw = signal.raw_data as Record<string, unknown>;
        const scope = (raw["scope"] as string | undefined) ?? "local";
        const type = signal.inferred.probable_type ?? signal.signal_type;
        const vars: Record<string, string> = { "source.kind": sourceKind, scope, type };
        return config.trust_policy.L3_auto_write.some(rule => this.evaluateRule(rule, vars));
    }

    private evaluateRule(rule: string, vars: Record<string, string>): boolean {
        return rule.split(/\s+AND\s+/).every(cond => {
            const m = cond.trim().match(/^(\S+)\s*==\s*'([^']+)'$/);
            return m ? vars[m[1]] === m[2] : false;
        });
    }

    private inferSourceKind(
        signal: Signal,
    ): "git-revert" | "git-dependency" | "conversation" | "manual" {
        if (signal.source_ear === "git") {
            if (signal.signal_type === "revert") return "git-revert";
            if (
                signal.signal_type === "dependency-removed" ||
                signal.signal_type === "dependency-replaced"
            )
                return "git-dependency";
        }
        if (signal.source_ear === "conversation") return "conversation";
        return "manual";
    }

    private writeStaged(
        signal: Signal,
        domain: string,
        subjectName: string,
        routingReason: string,
    ): void {
        const now = new Date().toISOString();
        const dateSlug = now.slice(0, 10).replace(/-/g, "_");

        const staged: StagedEntry = {
            id: `staged_${dateSlug}_${subjectName.slice(0, 30).replace(/\s+/g, "_").toLowerCase()}`,
            origin_signal: signal.id,
            draft_memory: {
                type: (signal.inferred.probable_type as "decision" | "rejection" | "transition" | "debt" | "experiment") ?? "decision",
                domain,
                scope:
                    ((signal.raw_data as Record<string, unknown>)["scope"] as "local" | "global") ??
                    "local",
                subject: { name: subjectName },
                summary:
                    ((signal.raw_data as Record<string, unknown>)["what"] as string) ??
                    signal.signal_type,
                rejected: (signal.raw_data as Record<string, unknown>)["rejected"]
                    ? {
                          what: ((signal.raw_data as Record<string, unknown>)["rejected"] as Record<string, string>)["what"] ?? "[TODO]",
                          reason: ((signal.raw_data as Record<string, unknown>)["rejected"] as Record<string, string>)["reason"] ?? "[TODO]",
                      }
                    : undefined,
                confidence: {
                    level: (signal.inferred.confidence as "high" | "medium" | "low") ?? "medium",
                },
                behavior_effect: {
                    type: this.inferBehaviorType(signal),
                    instruction: `[TODO: review and refine]`,
                },
                revisit: {
                    when: ["[TODO]"],
                    status: "not_met",
                },
            },
            review_status: "pending",
            routing_reason: routingReason,
            created_at: now,
        };
        this.stagedStore.save(staged);
    }

    signalToMemory(
        signal: Signal,
        domain: string,
        subjectName: string,
    ): MemoryEntry {
        const now = new Date().toISOString();
        const sourceKind = this.inferSourceKind(signal);
        const raw = signal.raw_data as Record<string, unknown>;

        return {
            id: `mem_${now.slice(0, 10).replace(/-/g, "_")}_${subjectName.slice(0, 30).replace(/\s+/g, "_").toLowerCase()}`,
            type: (signal.inferred.probable_type as MemoryEntry["type"]) ?? "decision",
            domain,
            scope: (raw["scope"] as "local" | "global") ?? "local",
            status: "active",
            health: { state: "ok", reason: null },
            confidence: {
                level: signal.inferred.confidence ?? "medium",
            },
            source: {
                kind: sourceKind,
                refs: [{ type: "session", id: signal.id }],
                captured_at: signal.captured_at,
            },
            subject: { name: subjectName },
            summary: (raw["what"] as string) ?? signal.signal_type,
            rejected: raw["rejected"]
                ? {
                      what: (raw["rejected"] as Record<string, string>)["what"] ?? "",
                      reason: (raw["rejected"] as Record<string, string>)["reason"] ?? "",
                  }
                : undefined,
            behavior_effect: {
                type: this.inferBehaviorType(signal),
                instruction:
                    (raw["reason"] as string) ??
                    `Auto-generated from ${signal.signal_type}`,
            },
            revisit: { when: [], status: "not_met" },
            relations: { related: [], conflicts: [] },
            created_at: now,
            updated_at: now,
        };
    }

    private inferBehaviorType(
        signal: Signal,
    ): "avoid_suggestion" | "prefer_approach" | "warn_before" | "require_review" {
        switch (signal.signal_type) {
            case "user-rejection":
            case "revert":
            case "dependency-removed":
                return "avoid_suggestion";
            case "decision":
            case "dependency-replaced":
                return "prefer_approach";
            case "debt-acceptance":
                return "warn_before";
            default:
                return "require_review";
        }
    }
}
