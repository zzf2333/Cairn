import type { AuditEntry } from "../schemas/index.js";
import type { GovernanceStore } from "../stores/index.js";
import type { ConfigStore } from "../stores/index.js";
import { type GravityLevel, type CognitiveMode, gravityAtLeast } from "../constants.js";

export type GovernancePermission = "agent_proposed" | "system_validated" | "human_ratified";

export class GovernanceEngine {
    constructor(
        private readonly governanceStore: GovernanceStore,
        private readonly configStore: ConfigStore,
    ) {}

    async checkPermission(
        gravityLevel: GravityLevel,
        affectsSkeleton: boolean,
        affectsDna: boolean,
        isTrauma: boolean,
        isStageTransition: boolean,
    ): Promise<GovernancePermission> {
        if (isTrauma || affectsDna || affectsSkeleton || isStageTransition) {
            return "human_ratified";
        }

        const mode = await this.getCognitiveMode();

        if (gravityAtLeast(gravityLevel, "G3")) {
            return "human_ratified";
        }

        if (gravityAtLeast(gravityLevel, "G2") && (mode === "standard" || mode === "institutional")) {
            return "human_ratified";
        }

        if (gravityAtLeast(gravityLevel, "G1") && mode === "institutional") {
            return "human_ratified";
        }

        if (gravityAtLeast(gravityLevel, "G1")) {
            return "agent_proposed";
        }

        return "system_validated";
    }

    async logAudit(entry: AuditEntry): Promise<void> {
        await this.governanceStore.appendAudit(entry);
    }

    async getCognitiveMode(): Promise<CognitiveMode> {
        const config = await this.configStore.load();
        return config?.cognitive_mode ?? "standard";
    }
}
