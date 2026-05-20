import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { StateSchema, StageSnapshotSchema, type State, type StageSnapshot, type ActiveSession, REQUIRED_INIT_STEPS, type InitStep } from "../schemas/index.js";
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

    async startSession(params: { id: string; task?: string; files?: string[]; context_loaded?: boolean }): Promise<void> {
        const state = await this.load();
        const now = new Date().toISOString();
        state.active_session = {
            id: params.id,
            started_at: now,
            last_touched_at: now,
            task: params.task ?? null,
            files: params.files ?? null,
            context_loaded: params.context_loaded ?? true,
            plan_called: false,
            observe_called: false,
            signals_count: 0,
            degraded_signals_count: 0,
            observed_candidates_count: 0,
            captured_candidates_count: 0,
            recovered: false,
        };
        await this.save(state);
    }

    async touchSession(updates?: { task?: string; files?: string[] }): Promise<boolean> {
        const state = await this.load();
        if (!state.active_session) return false;
        state.active_session.last_touched_at = new Date().toISOString();
        if (updates?.task !== undefined) state.active_session.task = updates.task;
        if (updates?.files !== undefined) state.active_session.files = updates.files;
        await this.save(state);
        return true;
    }

    async getActiveSession(): Promise<ActiveSession | null> {
        const state = await this.load();
        return state.active_session ?? null;
    }

    async markPlanCalled(): Promise<void> {
        const state = await this.load();
        if (!state.active_session) return;
        state.active_session.plan_called = true;
        state.active_session.last_touched_at = new Date().toISOString();
        await this.save(state);
    }

    async markObserveCalled(): Promise<void> {
        const state = await this.load();
        if (!state.active_session) return;
        state.active_session.observe_called = true;
        state.active_session.last_touched_at = new Date().toISOString();
        await this.save(state);
    }

    async incrementSignalCount(degraded: boolean): Promise<void> {
        const state = await this.load();
        if (!state.active_session) return;
        state.active_session.signals_count += 1;
        if (degraded) state.active_session.degraded_signals_count += 1;
        state.active_session.last_touched_at = new Date().toISOString();
        await this.save(state);
    }

    async recordObserveStats(observed: number, captured: number): Promise<void> {
        const state = await this.load();
        if (!state.active_session) return;
        state.active_session.observed_candidates_count += observed;
        state.active_session.captured_candidates_count += captured;
        state.active_session.signals_count += captured;
        state.active_session.last_touched_at = new Date().toISOString();
        await this.save(state);
    }

    async markSessionRecovered(): Promise<void> {
        const state = await this.load();
        if (!state.active_session) return;
        state.active_session.recovered = true;
        await this.save(state);
    }

    async setSessionCheckpoint(step: string): Promise<void> {
        const state = await this.load();
        if (state.active_session) {
            state.active_session.checkpoint_step = step;
            await this.save(state);
        }
    }

    async clearSession(): Promise<void> {
        const state = await this.load();
        delete state.active_session;
        delete state.session_in_progress;
        await this.save(state);
    }

    async startSessionCheckpoint(step: string): Promise<void> {
        const state = await this.load();
        if (state.active_session) {
            state.active_session.checkpoint_step = step;
            await this.save(state);
            return;
        }
        state.session_in_progress = {
            started_at: new Date().toISOString(),
            step,
        };
        await this.save(state);
    }

    async updateSessionCheckpoint(step: string): Promise<void> {
        const state = await this.load();
        if (state.active_session) {
            state.active_session.checkpoint_step = step;
            await this.save(state);
            return;
        }
        if (state.session_in_progress) {
            state.session_in_progress.step = step;
            await this.save(state);
        }
    }

    async clearSessionCheckpoint(): Promise<void> {
        const state = await this.load();
        delete state.active_session;
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
