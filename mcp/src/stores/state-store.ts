import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { StateSchema, StageSnapshotSchema, type State, type StageSnapshot } from "../schemas/index.js";

export class StateStore {
    constructor(private readonly filePath: string) {}

    async load(): Promise<State> {
        try {
            const content = await readFile(this.filePath, "utf-8");
            return StateSchema.parse(yamlParse(content));
        } catch (err: any) {
            if (err.code === "ENOENT") return StateSchema.parse({});
            throw err;
        }
    }

    async save(state: State): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, yamlStringify(state), "utf-8");
    }

    async updateLastSession(commit: string | null, endedAt: string): Promise<void> {
        const state = await this.load();
        state.last_session.commit = commit;
        state.last_session.ended_at = endedAt;
        await this.save(state);
    }

    async updateStage(stage: StageSnapshot): Promise<void> {
        const state = await this.load();
        state.stage = StageSnapshotSchema.parse(stage);
        await this.save(state);
    }

    async recordActivation(eventId: string): Promise<void> {
        const state = await this.load();
        const hits = state.activation_log.recent_hits;
        hits[eventId] = (hits[eventId] ?? 0) + 1;
        await this.save(state);
    }
}
