import { readdir, readFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { atomicWriteFile } from "../utils/atomic-write.js";
import {
    GitSignalSchema,
    CalibrationSignalSchema,
    ConversationSignalSchema,
    ProcessedSignalRecordSchema,
    type GitSignal,
    type CalibrationSignal,
    type ConversationSignal,
    type ProcessedSignalRecord,
} from "../schemas/index.js";

export class SignalStore {
    constructor(
        private readonly gitDir: string,
        private readonly calibrationDir: string,
        private readonly conversationDir: string,
        private readonly processedDir: string,
    ) {}

    async ensureDirs(): Promise<void> {
        await Promise.all([
            mkdir(this.gitDir, { recursive: true }),
            mkdir(this.calibrationDir, { recursive: true }),
            mkdir(this.conversationDir, { recursive: true }),
            mkdir(this.processedDir, { recursive: true }),
        ]);
    }

    async saveGitSignal(signal: GitSignal): Promise<void> {
        await mkdir(this.gitDir, { recursive: true });
        await atomicWriteFile(
            join(this.gitDir, `${signal.id}.yaml`),
            yamlStringify(signal),
        );
    }

    async saveCalibrationSignal(signal: CalibrationSignal): Promise<void> {
        await mkdir(this.calibrationDir, { recursive: true });
        await atomicWriteFile(
            join(this.calibrationDir, `${signal.id}.yaml`),
            yamlStringify(signal),
        );
    }

    async saveConversationSignal(signal: ConversationSignal): Promise<void> {
        await mkdir(this.conversationDir, { recursive: true });
        await atomicWriteFile(
            join(this.conversationDir, `${signal.id}.yaml`),
            yamlStringify(signal),
        );
    }

    async saveProcessedSignal(record: ProcessedSignalRecord): Promise<void> {
        const month = record.processed_at.slice(0, 7);
        const dir = join(this.processedDir, month);
        await mkdir(dir, { recursive: true });
        await atomicWriteFile(
            join(dir, `${record.id}.yaml`),
            yamlStringify(ProcessedSignalRecordSchema.parse(record)),
        );
    }

    async loadAllGitSignals(): Promise<GitSignal[]> {
        return this.loadAllFromDir(this.gitDir, GitSignalSchema);
    }

    async loadAllCalibrationSignals(): Promise<CalibrationSignal[]> {
        return this.loadAllFromDir(this.calibrationDir, CalibrationSignalSchema);
    }

    async loadAllConversationSignals(): Promise<ConversationSignal[]> {
        return this.loadAllFromDir(this.conversationDir, ConversationSignalSchema);
    }

    async loadAllProcessedSignals(): Promise<ProcessedSignalRecord[]> {
        let months: string[];
        try {
            months = await readdir(this.processedDir);
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
            throw err;
        }

        const records: ProcessedSignalRecord[] = [];
        for (const month of months) {
            records.push(...await this.loadAllFromDir(join(this.processedDir, month), ProcessedSignalRecordSchema));
        }
        return records;
    }

    async clearProcessed(ids: string[]): Promise<void> {
        const idSet = new Set(ids);
        const dirs = [this.gitDir, this.calibrationDir, this.conversationDir];
        await Promise.all(
            dirs.map(async (dir) => {
                let entries: string[];
                try {
                    entries = await readdir(dir);
                } catch (err: unknown) {
                    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
                    throw err;
                }
                await Promise.all(
                    entries
                        .filter(f => f.endsWith(".yaml"))
                        .filter(f => idSet.has(f.replace(/\.yaml$/, "")))
                        .map(f => unlink(join(dir, f))),
                );
            }),
        );
    }

    private async loadAllFromDir<T>(dir: string, schema: { parse: (v: unknown) => T }): Promise<T[]> {
        let entries: string[];
        try {
            entries = await readdir(dir);
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
            throw err;
        }
        const results: T[] = [];
        for (const file of entries.filter(f => f.endsWith(".yaml"))) {
            const raw = await readFile(join(dir, file), "utf-8");
            results.push(schema.parse(yamlParse(raw)));
        }
        return results;
    }
}
