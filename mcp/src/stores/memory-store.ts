import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { MemoryEntrySchema, type MemoryEntry } from "../schemas/index.js";

export class MemoryStore {
    constructor(private dir: string) {}

    loadAll(): MemoryEntry[] {
        if (!existsSync(this.dir)) return [];
        const files = readdirSync(this.dir).filter((f) => f.endsWith(".yaml"));
        const entries: MemoryEntry[] = [];
        for (const file of files) {
            const entry = this.loadFile(join(this.dir, file));
            if (entry) entries.push(entry);
        }
        return entries;
    }

    loadById(id: string): MemoryEntry | null {
        const all = this.loadAll();
        return all.find((e) => e.id === id) ?? null;
    }

    save(entry: MemoryEntry): void {
        const parsed = MemoryEntrySchema.parse(entry);
        const filename = `${parsed.id}.yaml`;
        writeFileSync(
            join(this.dir, filename),
            yamlStringify(parsed),
            "utf-8",
        );
    }

    remove(id: string): boolean {
        const filepath = join(this.dir, `${id}.yaml`);
        if (existsSync(filepath)) {
            unlinkSync(filepath);
            return true;
        }
        return false;
    }

    findByDomain(domain: string): MemoryEntry[] {
        return this.loadAll().filter((e) => e.domain === domain);
    }

    findByType(type: MemoryEntry["type"]): MemoryEntry[] {
        return this.loadAll().filter((e) => e.type === type);
    }

    findActive(): MemoryEntry[] {
        return this.loadAll().filter((e) => e.status === "active");
    }

    findConflicts(): MemoryEntry[] {
        return this.loadAll().filter((e) => e.health.state === "conflicted");
    }

    findDuplicate(
        domain: string,
        subjectName: string,
        type: string,
    ): MemoryEntry | null {
        return (
            this.loadAll().find(
                (e) =>
                    e.domain === domain &&
                    e.subject.name === subjectName &&
                    e.type === type &&
                    e.status === "active",
            ) ?? null
        );
    }

    private loadFile(filepath: string): MemoryEntry | null {
        try {
            const raw = readFileSync(filepath, "utf-8");
            const data = yamlParse(raw);
            return MemoryEntrySchema.parse(data);
        } catch {
            return null;
        }
    }
}
