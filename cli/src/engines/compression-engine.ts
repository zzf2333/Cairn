import type { BloodStore } from "../stores/index.js";
import type { EvolutionEvent } from "../schemas/index.js";
import { type KnownDnaTrait } from "../constants.js";

export interface DNACandidate {
    trait_name: KnownDnaTrait;
    level: "low" | "medium" | "high";
    confidence: number;
    evidence_events: string[];
    reasoning: string;
}

function monthsBetween(a: Date, b: Date): number {
    const earlier = a < b ? a : b;
    const later = a < b ? b : a;
    return (later.getFullYear() - earlier.getFullYear()) * 12
        + (later.getMonth() - earlier.getMonth());
}

function determineLevel(count: number): "low" | "medium" | "high" {
    if (count >= 7) return "high";
    if (count >= 5) return "medium";
    return "low";
}

const SIMPLICITY_KEYWORDS = [
    "simple", "simplicity", "straightforward", "lightweight",
    "minimal", "avoid complexity", "keep it small",
];

const INFRA_AGGRESSIVENESS_TYPES = new Set([
    "avoid_suggestion", "prefer_approach",
]);

function isInfraDomain(domain: string): boolean {
    const lower = domain.toLowerCase();
    return lower.includes("infra")
        || lower.includes("deploy")
        || lower.includes("platform")
        || lower.includes("ops");
}

function isInfraEvent(event: EvolutionEvent): boolean {
    if (isInfraDomain(event.domain)) return true;
    if (event.subject.type === "dependency") return true;
    return false;
}

function isSimplicityEvent(event: EvolutionEvent): boolean {
    const text = [event.reasoning, event.behavior_effect.instruction, event.decision_or_change]
        .join(" ").toLowerCase();
    return SIMPLICITY_KEYWORDS.some(kw => text.includes(kw));
}

function inferKnownTrait(group: EvolutionEvent[]): {
    trait_name: KnownDnaTrait;
    level: "low" | "medium" | "high";
} | null {
    const infraCount = group.filter(e =>
        isInfraEvent(e) && INFRA_AGGRESSIVENESS_TYPES.has(e.behavior_effect.type)
    ).length;
    const infraRejections = group.filter(e =>
        isInfraEvent(e) && (e.type === "rejection" || e.behavior_effect.type === "avoid_suggestion")
    ).length;

    if (infraCount >= group.length * 0.6 && infraRejections >= 3) {
        return {
            trait_name: "infra_aggressiveness",
            level: infraRejections >= 7 ? "high" : (infraRejections >= 5 ? "medium" : "low"),
        };
    }

    const simplicityCount = group.filter(isSimplicityEvent).length;
    if (simplicityCount >= 3 && simplicityCount >= group.length * 0.5) {
        return {
            trait_name: "simplicity_bias",
            level: determineLevel(simplicityCount),
        };
    }

    return null;
}

export class CompressionEngine {
    constructor(private readonly bloodStore: BloodStore) {}

    async detectCandidates(minEvidence: number, minTimespanMonths: number): Promise<DNACandidate[]> {
        const events = await this.bloodStore.findActive();
        const groups = new Map<string, EvolutionEvent[]>();

        for (const event of events) {
            const key = `${event.domain}:${event.type}`;
            const group = groups.get(key);
            if (group) {
                group.push(event);
            } else {
                groups.set(key, [event]);
            }
        }

        const candidates: DNACandidate[] = [];

        for (const [key, group] of groups) {
            if (group.length < minEvidence) continue;

            const times = group.map(e => new Date(e.time));
            const earliest = new Date(Math.min(...times.map(t => t.getTime())));
            const latest = new Date(Math.max(...times.map(t => t.getTime())));
            const span = monthsBetween(earliest, latest);

            if (span < minTimespanMonths) continue;

            const inferred = inferKnownTrait(group);
            if (!inferred) continue;

            const sources = new Set(group.map(e => e.source.type));
            const sourceBonus = Math.min(sources.size * 0.05, 0.2);
            const countBonus = Math.min(group.length * 0.05, 0.3);
            const confidence = Math.min(0.4 + countBonus + sourceBonus, 1);

            candidates.push({
                trait_name: inferred.trait_name,
                level: inferred.level,
                confidence,
                evidence_events: group.map(e => e.id),
                reasoning: `${group.length} events over ${span} months in ${key} matched ${inferred.trait_name} pattern (${sources.size} source types)`,
            });
        }

        return candidates;
    }
}
