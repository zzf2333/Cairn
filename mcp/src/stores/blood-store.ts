import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { EvolutionEventSchema, type EvolutionEvent } from "../schemas/index.js";

function safePath(dir: string, filename: string): string {
    const resolved = resolve(dir, filename);
    if (!resolved.startsWith(resolve(dir))) {
        throw new Error(`Path traversal detected: ${filename}`);
    }
    return resolved;
}

async function loadYamlFile(path: string): Promise<unknown | null> {
    try {
        const content = await readFile(path, "utf-8");
        return yamlParse(content);
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

async function saveYamlFile(path: string, data: unknown): Promise<void> {
    await writeFile(path, yamlStringify(data), "utf-8");
}

async function loadAllYaml<T>(dir: string, schema: { parse: (data: unknown) => T }): Promise<T[]> {
    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch (err: any) {
        if (err.code === "ENOENT") return [];
        throw err;
    }
    const results: T[] = [];
    for (const entry of entries) {
        if (!entry.endsWith(".yaml")) continue;
        const raw = await loadYamlFile(join(dir, entry));
        if (raw !== null) {
            results.push(schema.parse(raw));
        }
    }
    return results;
}

export class BloodStore {
    constructor(private readonly dir: string) {}

    async ensureDir(): Promise<void> {
        await mkdir(this.dir, { recursive: true });
    }

    async loadAll(): Promise<EvolutionEvent[]> {
        return loadAllYaml(this.dir, EvolutionEventSchema);
    }

    async load(id: string): Promise<EvolutionEvent | null> {
        const raw = await loadYamlFile(safePath(this.dir, `${id}.yaml`));
        if (raw === null) return null;
        return EvolutionEventSchema.parse(raw);
    }

    async save(event: EvolutionEvent): Promise<void> {
        await this.ensureDir();
        await saveYamlFile(safePath(this.dir, `${event.id}.yaml`), event);
    }

    async remove(id: string): Promise<void> {
        try {
            await unlink(safePath(this.dir, `${id}.yaml`));
        } catch (err: any) {
            if (err.code === "ENOENT") return;
            throw err;
        }
    }

    async findByDomain(domain: string): Promise<EvolutionEvent[]> {
        const all = await this.loadAll();
        return all.filter(e => e.domain === domain);
    }

    async findByType(type: string): Promise<EvolutionEvent[]> {
        const all = await this.loadAll();
        return all.filter(e => e.type === type);
    }

    async findActive(): Promise<EvolutionEvent[]> {
        const all = await this.loadAll();
        return all.filter(e => e.health.state === "ok" || e.health.state === "resurrected");
    }

    async findArchived(): Promise<EvolutionEvent[]> {
        const all = await this.loadAll();
        return all.filter(e => e.health.state === "stale");
    }

    async findTrauma(domain?: string): Promise<EvolutionEvent[]> {
        const all = await this.loadAll();
        return all.filter(e => e.trauma.is_trauma && (domain === undefined || e.domain === domain));
    }

    async findDuplicate(domain: string, subjectName: string, type: string): Promise<EvolutionEvent | null> {
        const all = await this.loadAll();
        return all.find(e => e.domain === domain && e.subject.name === subjectName && e.type === type) ?? null;
    }
}
