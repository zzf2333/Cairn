import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import {
    StageSnapshotSchema,
    type StageSnapshot,
} from "../schemas/index.js";
import { ConfigSchema, type Config } from "../schemas/config.js";

export interface StateData {
    last_session_commit: string | null;
    last_session_at: string | null;
    stage: StageSnapshot;
}

const DEFAULT_STAGE: StageSnapshot = {
    phase: "growth",
    confidence: 0.4,
    status: "advisory",
    evidence: [],
    guidance: [],
    last_updated: new Date().toISOString(),
};

export class StateStore {
    constructor(private filepath: string) {}

    load(): StateData {
        if (!existsSync(this.filepath)) {
            return {
                last_session_commit: null,
                last_session_at: null,
                stage: DEFAULT_STAGE,
            };
        }
        try {
            const raw = readFileSync(this.filepath, "utf-8");
            const data = yamlParse(raw) ?? {};
            return {
                last_session_commit: data.last_session_commit ?? null,
                last_session_at: data.last_session_at ?? null,
                stage: data.stage
                    ? StageSnapshotSchema.parse(data.stage)
                    : DEFAULT_STAGE,
            };
        } catch {
            return {
                last_session_commit: null,
                last_session_at: null,
                stage: DEFAULT_STAGE,
            };
        }
    }

    save(state: StateData): void {
        writeFileSync(this.filepath, yamlStringify(state), "utf-8");
    }

    updateLastGitScan(commit: string): void {
        const state = this.load();
        state.last_session_commit = commit;
        this.save(state);
    }

    updateStage(snapshot: StageSnapshot): void {
        const state = this.load();
        state.stage = snapshot;
        this.save(state);
    }

    loadConfig(configPath: string): Config {
        if (!existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }
        const raw = readFileSync(configPath, "utf-8");
        const data = yamlParse(raw);
        return ConfigSchema.parse(data);
    }
}
