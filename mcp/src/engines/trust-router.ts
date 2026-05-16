import type { BloodStore } from "../stores/index.js";
import type { DnaStore } from "../stores/index.js";
import { type GravityLevel, upgradeGravity } from "../constants.js";
import { type GovernancePermission, GovernanceEngine } from "./governance-engine.js";

export interface RoutingResult {
    destination: "dropped" | "staged" | "blood";
    gravity: GravityLevel;
    governance: GovernancePermission;
    reason: string;
    merged_with?: string;
}

export class TrustRouter {
    constructor(
        private readonly bloodStore: BloodStore,
        private readonly dnaStore: DnaStore,
        private readonly governanceEngine: GovernanceEngine,
    ) {}

    async route(input: {
        domain: string;
        subject_name: string;
        type: string;
        gravity: GravityLevel;
        affectsSkeleton?: boolean;
        affectsDna?: boolean;
        isTrauma?: boolean;
        isStageTransition?: boolean;
        involves_complex_framework?: boolean;
        involves_new_infrastructure?: boolean;
    }): Promise<RoutingResult> {
        let gravity = input.gravity;
        const affectsSkeleton = input.affectsSkeleton ?? false;
        const affectsDna = input.affectsDna ?? false;
        const isTrauma = input.isTrauma ?? false;
        const isStageTransition = input.isStageTransition ?? false;

        const duplicate = await this.bloodStore.findDuplicate(input.domain, input.subject_name, input.type);
        if (duplicate) {
            return {
                destination: "blood",
                gravity,
                governance: "system_validated",
                reason: "duplicate merged with existing event",
                merged_with: duplicate.id,
            };
        }

        const traumaEvents = await this.bloodStore.findTrauma(input.domain);
        if (traumaEvents.length > 0) {
            const maxMultiplier = Math.max(...traumaEvents.map(e => e.trauma.sensitivity_multiplier));
            gravity = upgradeGravity(gravity);
            if (maxMultiplier >= 2.0) {
                gravity = upgradeGravity(gravity);
            }
        }

        const identity = await this.dnaStore.loadIdentity();
        if (!identity.reevaluation_mode) {
            const simplicityTrait = identity.traits["simplicity_bias"];
            if (simplicityTrait?.level === "high" && input.involves_complex_framework) {
                gravity = upgradeGravity(gravity);
            }

            const infraTrait = identity.traits["infra_aggressiveness"];
            if (infraTrait?.level === "low" && input.involves_new_infrastructure) {
                gravity = upgradeGravity(gravity);
            }
        }

        if (gravity === "G0") {
            return {
                destination: "dropped",
                gravity,
                governance: "system_validated",
                reason: "G0: below threshold",
            };
        }

        const governance = await this.governanceEngine.checkPermission(
            gravity,
            affectsSkeleton,
            affectsDna,
            isTrauma,
            isStageTransition,
        );

        if (governance === "human_ratified") {
            return {
                destination: "staged",
                gravity,
                governance,
                reason: "governance requires human ratification",
            };
        }

        if (governance === "agent_proposed") {
            return {
                destination: "staged",
                gravity,
                governance,
                reason: "agent proposed, awaiting confirmation",
            };
        }

        return {
            destination: "blood",
            gravity,
            governance,
            reason: "system validated, auto-confirmed",
        };
    }
}
