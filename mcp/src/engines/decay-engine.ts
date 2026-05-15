import type { BloodStore } from "../stores/index.js";
import type { CognitiveMode } from "../constants.js";
import { COGNITIVE_MODE_PARAMS } from "../constants.js";

export interface DecayAction {
    event_id: string;
    action: "mark_stale" | "archive";
    reason: string;
}

export class DecayEngine {
    constructor(private readonly bloodStore: BloodStore) {}

    async checkDecay(cognitiveMode: CognitiveMode): Promise<DecayAction[]> {
        const params = COGNITIVE_MODE_PARAMS[cognitiveMode];
        const events = await this.bloodStore.findActive();
        const now = new Date();
        const actions: DecayAction[] = [];

        for (const event of events) {
            if (event.trauma.is_trauma && event.trauma.decay_override === "permanent") {
                continue;
            }

            if (event.lifecycle.review_after) {
                const reviewDate = new Date(event.lifecycle.review_after);
                if (reviewDate < now) {
                    const daysPast = Math.floor((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));

                    if (event.lifecycle.decay_policy === "expire" && daysPast > params.decayStaleDays) {
                        actions.push({
                            event_id: event.id,
                            action: "archive",
                            reason: `review_after passed ${daysPast} days ago with expire policy`,
                        });
                        continue;
                    }

                    actions.push({
                        event_id: event.id,
                        action: "mark_stale",
                        reason: `review_after date ${event.lifecycle.review_after} has passed`,
                    });
                    continue;
                }
            }

            const lastActivation = new Date(event.updated_at);
            const daysSinceActivation = Math.floor(
                (now.getTime() - lastActivation.getTime()) / (1000 * 60 * 60 * 24),
            );

            if (daysSinceActivation > params.decayUnusedDays) {
                actions.push({
                    event_id: event.id,
                    action: "mark_stale",
                    reason: `no activation for ${daysSinceActivation} days (threshold: ${params.decayUnusedDays})`,
                });
            }
        }

        return actions;
    }
}
