import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { SessionRecordSchema, type SessionRecord } from "../schemas/index.js";

export class SessionStore {
    constructor(private readonly dir: string) {}

    async ensureDir(): Promise<void> {
        await mkdir(this.dir, { recursive: true });
    }

    async save(record: SessionRecord): Promise<void> {
        await this.ensureDir();
        await writeFile(join(this.dir, `${record.id}.yaml`), yamlStringify(record), "utf-8");
    }

    async load(id: string): Promise<SessionRecord | null> {
        try {
            const content = await readFile(join(this.dir, `${id}.yaml`), "utf-8");
            return SessionRecordSchema.parse(yamlParse(content));
        } catch (err: any) {
            if (err.code === "ENOENT") return null;
            throw err;
        }
    }

    async loadAll(): Promise<SessionRecord[]> {
        let entries: string[];
        try {
            entries = await readdir(this.dir);
        } catch (err: any) {
            if (err.code === "ENOENT") return [];
            throw err;
        }
        const results: SessionRecord[] = [];
        for (const entry of entries) {
            if (!entry.endsWith(".yaml")) continue;
            try {
                const content = await readFile(join(this.dir, entry), "utf-8");
                results.push(SessionRecordSchema.parse(yamlParse(content)));
            } catch {
                continue;
            }
        }
        return results;
    }

    async loadRecent(count: number): Promise<SessionRecord[]> {
        const all = await this.loadAll();
        all.sort((a, b) => b.started_at.localeCompare(a.started_at));
        return all.slice(0, count);
    }
}
