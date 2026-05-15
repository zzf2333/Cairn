import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { StagedEntrySchema, type StagedEntry } from "../schemas/index.js";

export class StagedStore {
    constructor(private readonly dir: string) {}

    async ensureDir(): Promise<void> {
        await mkdir(this.dir, { recursive: true });
    }

    async loadAll(): Promise<StagedEntry[]> {
        let entries: string[];
        try {
            entries = await readdir(this.dir);
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
            throw err;
        }
        const results: StagedEntry[] = [];
        for (const file of entries.filter(f => f.endsWith(".yaml"))) {
            const raw = await readFile(join(this.dir, file), "utf-8");
            results.push(StagedEntrySchema.parse(yamlParse(raw)));
        }
        return results;
    }

    async load(id: string): Promise<StagedEntry | null> {
        try {
            const raw = await readFile(join(this.dir, `${id}.yaml`), "utf-8");
            return StagedEntrySchema.parse(yamlParse(raw));
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw err;
        }
    }

    async save(entry: StagedEntry): Promise<void> {
        await mkdir(this.dir, { recursive: true });
        await writeFile(
            join(this.dir, `${entry.id}.yaml`),
            yamlStringify(entry),
            "utf-8",
        );
    }

    async remove(id: string): Promise<void> {
        try {
            await unlink(join(this.dir, `${id}.yaml`));
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
            throw err;
        }
    }

    async findPending(): Promise<StagedEntry[]> {
        const all = await this.loadAll();
        return all.filter(e => e.review_status === "pending");
    }

    async count(): Promise<number> {
        try {
            const entries = await readdir(this.dir);
            return entries.filter(f => f.endsWith(".yaml")).length;
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
            throw err;
        }
    }
}
