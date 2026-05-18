import type { BloodStore, StateStore } from "../stores/index.js";
import { RESURRECTION_THRESHOLD, gravityAtLeast } from "../constants.js";

export interface ResurrectionCandidate {
    event_id: string;
    reason: string;
    recommendation: string;
    governance: "human_ratified" | "system_validated";
}

export class ResurrectionEngine {
    constructor(
        private readonly bloodStore: BloodStore,
        private readonly stateStore: StateStore,
    ) {}

    async checkResurrection(threshold?: number): Promise<ResurrectionCandidate[]> {
        const effectiveThreshold = threshold ?? RESURRECTION_THRESHOLD;
        const state = await this.stateStore.load();
        const recentHits = state.activation_log.recent_hits;

        const allEvents = await this.bloodStore.loadAll();
        const archived = allEvents.filter(
            e => e.health.state === "stale" || e.health.state === "archived" || e.health.state === "conflicted",
        );

        const candidates: ResurrectionCandidate[] = [];

        for (const event of archived) {
            const hits = recentHits[event.id] ?? 0;
            if (hits < effectiveThreshold) continue;

            const isHighGravity = gravityAtLeast(event.gravity.level, "G2");

            candidates.push({
                event_id: event.id,
                reason: `${hits} activations detected for archived event (threshold: ${effectiveThreshold})`,
                recommendation: `Resurrect "${event.subject.name}" — still actively referenced`,
                governance: isHighGravity ? "human_ratified" : "system_validated",
            });
        }

        return candidates;
    }
}
