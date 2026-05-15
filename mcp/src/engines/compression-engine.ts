import type { BloodStore } from "../stores/index.js";
import type { EvolutionEvent } from "../schemas/index.js";

export interface DNACandidate {
    trait_name: string;
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

            const sources = new Set(group.map(e => e.source.type));
            const sourceBonus = Math.min(sources.size * 0.05, 0.2);
            const countBonus = Math.min(group.length * 0.05, 0.3);
            const confidence = Math.min(0.4 + countBonus + sourceBonus, 1);

            const [domain] = key.split(":");
            const commonSubject = group[0].subject.name;
            const traitName = `${domain}/${commonSubject}`;

            candidates.push({
                trait_name: traitName,
                level: determineLevel(group.length),
                confidence,
                evidence_events: group.map(e => e.id),
                reasoning: `${group.length} events over ${span} months in ${key} from ${sources.size} source types`,
            });
        }

        return candidates;
    }
}
