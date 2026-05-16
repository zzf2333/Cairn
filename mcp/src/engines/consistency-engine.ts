import type { EvolutionEvent, DNAIdentity } from "../schemas/index.js";
import type { BloodStore } from "../stores/blood-store.js";
import type { SkeletonStore } from "../stores/skeleton-store.js";
import type { DnaStore } from "../stores/dna-store.js";
import type { StateStore } from "../stores/state-store.js";
import { RESURRECTION_THRESHOLD } from "../constants.js";

export interface ConsistencyViolation {
    rule: string;
    description: string;
    recommendation: string;
}

export interface ConsistencyResult {
    passed: boolean;
    violations: ConsistencyViolation[];
}

export interface ConsistencyReport {
    dna_event_consistency: ConsistencyResult;
    no_go_support: ConsistencyResult;
    skeleton_reality: ConsistencyResult;
    archived_reactivation: ConsistencyResult;
    constraint_consistency: ConsistencyResult;
    overall: "consistent" | "warnings" | "violations";
}

export class ConsistencyEngine {
    constructor(
        private readonly bloodStore: BloodStore,
        private readonly skeletonStore: SkeletonStore,
        private readonly dnaStore: DnaStore,
        private readonly stateStore: StateStore,
    ) {}

    async runAll(): Promise<ConsistencyReport> {
        const [dna, noGo, skeleton, archived, constraint] = await Promise.all([
            this.checkDNAConsistency(),
            this.checkNoGoSupport(),
            this.checkSkeletonReality(),
            this.checkArchivedReactivation(),
            this.checkConstraintConsistency(),
        ]);

        const allResults = [dna, noGo, skeleton, archived, constraint];
        const hasViolations = allResults.some(r => !r.passed);
        const hasWarnings = allResults.some(r => r.violations.length > 0);

        let overall: ConsistencyReport["overall"] = "consistent";
        if (hasViolations) {
            overall = "violations";
        } else if (hasWarnings) {
            overall = "warnings";
        }

        return {
            dna_event_consistency: dna,
            no_go_support: noGo,
            skeleton_reality: skeleton,
            archived_reactivation: archived,
            constraint_consistency: constraint,
            overall,
        };
    }

    async checkDNAConsistency(): Promise<ConsistencyResult> {
        const identity = await this.dnaStore.loadIdentity();
        if (identity.status === "not_yet_emerged") {
            return { passed: true, violations: [] };
        }

        const allEvents = await this.bloodStore.loadAll();
        const recentHighGravity = allEvents.filter(e =>
            (e.gravity.level === "G2" || e.gravity.level === "G3")
            && (e.health.state === "ok" || e.health.state === "resurrected")
        );

        const violations: ConsistencyViolation[] = [];

        for (const [traitName, trait] of Object.entries(identity.traits)) {
            if (trait.level !== "high") continue;

            const contradicting = recentHighGravity.filter(e => {
                if (traitName === "simplicity_bias") {
                    return e.type === "transition" || e.type === "architecture_decision";
                }
                return false;
            });

            if (contradicting.length > 3) {
                violations.push({
                    rule: "dna_event_consistency",
                    description: `Trait "${traitName}" is high but ${contradicting.length} recent high-gravity events contradict it`,
                    recommendation: `Re-evaluate trait "${traitName}" — recent behavior may have shifted`,
                });
            }
        }

        return { passed: violations.length === 0, violations };
    }

    async checkNoGoSupport(): Promise<ConsistencyResult> {
        const allEvents = await this.bloodStore.loadAll();
        const noGoEvents = allEvents.filter(e => e.behavior_effect.type === "avoid_suggestion");

        const violations: ConsistencyViolation[] = [];

        for (const event of noGoEvents) {
            if (event.health.state === "stale") {
                violations.push({
                    rule: "no_go_support",
                    description: `No-go event "${event.id}" (${event.subject.name}) has stale health — orphaned constraint`,
                    recommendation: `Review and either refresh or archive no-go for "${event.subject.name}"`,
                });
            }
        }

        return { passed: violations.length === 0, violations };
    }

    async checkSkeletonReality(): Promise<ConsistencyResult> {
        const allNodes = await this.skeletonStore.loadAll();
        const skeletonDomains = new Set(allNodes.map(n => n.domain));

        const allEvents = await this.bloodStore.loadAll();
        const bloodDomains = new Set(allEvents.map(e => e.domain));

        const violations: ConsistencyViolation[] = [];

        for (const domain of bloodDomains) {
            if (!skeletonDomains.has(domain)) {
                violations.push({
                    rule: "skeleton_reality",
                    description: `Domain "${domain}" has blood events but no skeleton node`,
                    recommendation: `Create a skeleton node for "${domain}" or reassign its events to an existing domain`,
                });
            }
        }

        return { passed: violations.length === 0, violations };
    }

    async checkArchivedReactivation(): Promise<ConsistencyResult> {
        const state = await this.stateStore.load();
        const recentHits = state.activation_log.recent_hits;
        const archivedEvents = await this.bloodStore.findArchived();

        const violations: ConsistencyViolation[] = [];

        for (const event of archivedEvents) {
            const hits = recentHits[event.id] ?? 0;
            if (hits >= RESURRECTION_THRESHOLD) {
                violations.push({
                    rule: "archived_reactivation",
                    description: `Archived event "${event.id}" (${event.subject.name}) has ${hits} recent hits, exceeding resurrection threshold of ${RESURRECTION_THRESHOLD}`,
                    recommendation: `Consider resurrecting event "${event.id}" — it is still actively relevant`,
                });
            }
        }

        return { passed: violations.length === 0, violations };
    }

    async checkConstraintConsistency(): Promise<ConsistencyResult> {
        const activeEvents = await this.bloodStore.findActive();

        const domainGroups = new Map<string, EvolutionEvent[]>();
        for (const event of activeEvents) {
            const existing = domainGroups.get(event.domain) ?? [];
            existing.push(event);
            domainGroups.set(event.domain, existing);
        }

        const violations: ConsistencyViolation[] = [];

        for (const [domain, events] of domainGroups) {
            const avoidSubjects = new Set<string>();
            const preferSubjects = new Set<string>();

            for (const event of events) {
                if (event.behavior_effect.type === "avoid_suggestion") {
                    avoidSubjects.add(event.subject.name);
                } else if (event.behavior_effect.type === "prefer_approach") {
                    preferSubjects.add(event.subject.name);
                }
            }

            for (const subject of avoidSubjects) {
                if (preferSubjects.has(subject)) {
                    violations.push({
                        rule: "constraint_consistency",
                        description: `Domain "${domain}" has contradictory constraints for "${subject}" — both avoid and prefer`,
                        recommendation: `Resolve conflict for "${subject}" in domain "${domain}" — keep one, archive the other`,
                    });
                }
            }
        }

        return { passed: violations.length === 0, violations };
    }
}
