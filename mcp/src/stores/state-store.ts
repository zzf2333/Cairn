import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { StateSchema, StageSnapshotSchema, type State, type StageSnapshot, REQUIRED_INIT_STEPS, type InitStep } from "../schemas/index.js";
import { atomicWriteFile } from "../utils/atomic-write.js";

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
        await atomicWriteFile(this.filePath, yamlStringify(state));
    }

    async setCairnVersion(version: string): Promise<void> {
        const state = await this.load();
        state.cairn_version = version;
        await this.save(state);
    }

    async startSessionCheckpoint(step: string): Promise<void> {
        const state = await this.load();
        state.session_in_progress = {
            started_at: new Date().toISOString(),
            step,
        };
        await this.save(state);
    }

    async updateSessionCheckpoint(step: string): Promise<void> {
        const state = await this.load();
        if (state.session_in_progress) {
            state.session_in_progress.step = step;
            await this.save(state);
        }
    }

    async clearSessionCheckpoint(): Promise<void> {
        const state = await this.load();
        delete state.session_in_progress;
        await this.save(state);
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

    async recordActivationBatch(eventIds: string[]): Promise<void> {
        if (eventIds.length === 0) return;
        const state = await this.load();
        const hits = state.activation_log.recent_hits;
        for (const id of eventIds) {
            hits[id] = (hits[id] ?? 0) + 1;
        }
        await this.save(state);
    }

    async clearActivationLog(): Promise<void> {
        const state = await this.load();
        state.activation_log.recent_hits = {};
        await this.save(state);
    }

    async markInitStep(step: InitStep): Promise<void> {
        const state = await this.load();
        if (!state.init_progress) {
            state.init_progress = {
                completed_steps: [],
                started_at: new Date().toISOString(),
            };
        }
        if (!state.init_progress.completed_steps.includes(step)) {
            state.init_progress.completed_steps.push(step);
        }
        const allDone = REQUIRED_INIT_STEPS.every(
            s => state.init_progress!.completed_steps.includes(s),
        );
        state.initialization_status = allDone ? "complete" : "partial";
        await this.save(state);
    }

    async getInitProgress(): Promise<{ completed_steps: InitStep[]; started_at?: string } | undefined> {
        const state = await this.load();
        return state.init_progress;
    }
}
