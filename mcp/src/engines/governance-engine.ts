import type { AuditEntry } from "../schemas/index.js";
import type { GovernanceStore } from "../stores/index.js";
import type { ConfigStore } from "../stores/index.js";
import { type GravityLevel, type CognitiveMode, gravityAtLeast, COGNITIVE_MODE_PARAMS } from "../constants.js";

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
        const params = COGNITIVE_MODE_PARAMS[mode];

        if (gravityAtLeast(gravityLevel, params.governanceApprovalMinGravity)) {
            return "human_ratified";
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
