import type { Challenge } from "./activation-engine.js";
import type { BloodStore } from "../stores/blood-store.js";
import type { SkeletonStore } from "../stores/skeleton-store.js";
import type { DnaStore } from "../stores/dna-store.js";
import { GRAVITY_ORDER, type GravityLevel } from "../constants.js";

export interface ChallengeInput {
    task?: string;
    domain?: string;
    subject_name?: string;
    involves_complex_framework?: boolean;
    involves_new_infrastructure?: boolean;
}

function gravityToLevel(gravity: GravityLevel): Challenge["level"] {
    if (gravity === "G3") return "hard_constraint";
    if (gravity === "G2") return "reflective_challenge";
    return "suggestion";
}

function upgradeLevel(level: Challenge["level"]): Challenge["level"] {
    if (level === "suggestion") return "reflective_challenge";
    if (level === "reflective_challenge") return "hard_constraint";
    return "hard_constraint";
}

function downgradeLevelForArchived(level: Challenge["level"]): Challenge["level"] | null {
    if (level === "hard_constraint") return "reflective_challenge";
    if (level === "reflective_challenge") return "suggestion";
    return null;
}

export class ChallengeEngine {
    constructor(
        private readonly bloodStore: BloodStore,
        private readonly skeletonStore: SkeletonStore,
        private readonly dnaStore: DnaStore,
    ) {}

    async detectConflicts(input: ChallengeInput): Promise<Challenge[]> {
        const challenges: Challenge[] = [];

        await Promise.all([
            this.checkNoGo(input, challenges),
            this.checkTrauma(input, challenges),
            this.checkDna(input, challenges),
            this.checkSkeletonBoundary(input, challenges),
        ]);

        return challenges;
    }

    private async checkNoGo(input: ChallengeInput, challenges: Challenge[]): Promise<void> {
        const allEvents = await this.bloodStore.loadAll();
        const avoidEvents = allEvents.filter(e =>
            e.behavior_effect.type === "avoid_suggestion"
            && e.health.state !== "conflicted",
        );

        const searchTerms: string[] = [];
        if (input.task) searchTerms.push(input.task.toLowerCase());
        if (input.subject_name) searchTerms.push(input.subject_name.toLowerCase());

        if (searchTerms.length === 0) return;

        for (const event of avoidEvents) {
            const matchTerms = [
                event.subject.name,
                ...event.subject.aliases,
                ...event.rejected_paths.map(rp => rp.path),
            ].map(t => t.toLowerCase()).filter(t => t.length > 0);

            const matches = matchTerms.some(mt =>
                searchTerms.some(st => st.includes(mt) || mt.includes(st)),
            );
            if (!matches) continue;

            const baseLevel = gravityToLevel(event.gravity.level as GravityLevel);
            const isArchived = event.health.state === "stale";
            const finalLevel = isArchived ? downgradeLevelForArchived(baseLevel) : baseLevel;
            if (finalLevel === null) continue;

            challenges.push({
                level: finalLevel,
                conflict_with: event.id,
                description: isArchived
                    ? `[archived] Was no-go: ${event.subject.name} — ${event.behavior_effect.instruction}`
                    : `Conflicts with no-go: ${event.subject.name} — ${event.behavior_effect.instruction}`,
                required_response: !isArchived && GRAVITY_ORDER[event.gravity.level as GravityLevel] >= GRAVITY_ORDER.G2
                    ? "Explain why this direction is necessary despite previous decision"
                    : undefined,
                archived: isArchived || undefined,
            });
        }
    }

    private async checkTrauma(input: ChallengeInput, challenges: Challenge[]): Promise<void> {
        if (!input.domain) return;

        const traumaEvents = await this.bloodStore.findTrauma(input.domain);

        const searchTerms: string[] = [];
        if (input.task) searchTerms.push(input.task.toLowerCase());
        if (input.subject_name) searchTerms.push(input.subject_name.toLowerCase());

        for (const event of traumaEvents) {
            if (searchTerms.length > 0) {
                const eventText = [
                    event.subject.name,
                    ...event.subject.aliases,
                    event.trigger,
                    event.decision_or_change,
                ].join(" ").toLowerCase();
                const isRelevant = searchTerms.some(term =>
                    eventText.includes(term) || term.includes(event.subject.name.toLowerCase())
                );
                if (!isRelevant) continue;
            }

            const baseLevel = gravityToLevel(event.gravity.level as GravityLevel);
            challenges.push({
                level: upgradeLevel(baseLevel),
                conflict_with: event.id,
                description: `Trauma event: ${event.subject.name} — ${event.behavior_effect.instruction}`,
                required_response: "Acknowledge trauma history and provide explicit justification",
                trauma: true,
            });
        }
    }

    private async checkDna(input: ChallengeInput, challenges: Challenge[]): Promise<void> {
        const identity = await this.dnaStore.loadIdentity();
        if (identity.status === "not_yet_emerged") return;

        if (input.involves_complex_framework) {
            const simplicityTrait = identity.traits["simplicity_bias"];
            if (simplicityTrait && simplicityTrait.level === "high") {
                challenges.push({
                    level: "suggestion",
                    conflict_with: "dna:simplicity_bias",
                    description: "This project has a strong simplicity bias. Complex frameworks conflict with established patterns.",
                });
            }
        }

        if (input.involves_new_infrastructure) {
            const infraTrait = identity.traits["infra_aggressiveness"];
            if (infraTrait && infraTrait.level === "low") {
                challenges.push({
                    level: "suggestion",
                    conflict_with: "dna:infra_aggressiveness",
                    description: "This project is conservative with infrastructure. New infrastructure should be well-justified.",
                });
            }
        }
    }

    private async checkSkeletonBoundary(input: ChallengeInput, challenges: Challenge[]): Promise<void> {
        if (!input.domain || !input.task) return;

        const node = await this.skeletonStore.load(input.domain);
        if (!node) return;

        const taskLower = input.task.toLowerCase();
        for (const capability of node.does_not_own) {
            if (taskLower.includes(capability.toLowerCase())) {
                challenges.push({
                    level: "reflective_challenge",
                    conflict_with: `skeleton:${input.domain}:does_not_own`,
                    description: `Task mentions "${capability}" which is outside the boundary of domain "${input.domain}". Check if another domain owns this.`,
                    required_response: "Confirm whether this crosses module boundaries intentionally",
                });
            }
        }
    }
}
