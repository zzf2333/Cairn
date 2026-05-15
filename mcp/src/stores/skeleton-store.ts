import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { SkeletonNodeSchema, type SkeletonNode } from "../schemas/index.js";

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

export class SkeletonStore {
    constructor(private readonly dir: string) {}

    async ensureDir(): Promise<void> {
        await mkdir(this.dir, { recursive: true });
    }

    async loadAll(): Promise<SkeletonNode[]> {
        return loadAllYaml(this.dir, SkeletonNodeSchema);
    }

    async load(domain: string): Promise<SkeletonNode | null> {
        const raw = await loadYamlFile(join(this.dir, `${domain}.yaml`));
        if (raw === null) return null;
        return SkeletonNodeSchema.parse(raw);
    }

    async save(node: SkeletonNode): Promise<void> {
        await this.ensureDir();
        await saveYamlFile(join(this.dir, `${node.domain}.yaml`), node);
    }

    async remove(domain: string): Promise<void> {
        try {
            await unlink(join(this.dir, `${domain}.yaml`));
        } catch (err: any) {
            if (err.code === "ENOENT") return;
            throw err;
        }
    }

    async findByKeyword(keyword: string): Promise<SkeletonNode[]> {
        const all = await this.loadAll();
        const lower = keyword.toLowerCase();
        return all.filter(n => n.causal_keywords.some(k => k.toLowerCase().includes(lower)));
    }
}
