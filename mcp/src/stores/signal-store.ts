import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { SignalSchema, type Signal } from "../schemas/index.js";

export class SignalStore {
    constructor(private dir: string) {}

    loadAll(): Signal[] {
        if (!existsSync(this.dir)) return [];
        const files = readdirSync(this.dir).filter((f) => f.endsWith(".yaml"));
        const entries: Signal[] = [];
        for (const file of files) {
            const entry = this.loadFile(join(this.dir, file));
            if (entry) entries.push(entry);
        }
        return entries;
    }

    save(signal: Signal): void {
        const parsed = SignalSchema.parse(signal);
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

    findByDomain(domain: string): Signal[] {
        return this.loadAll().filter(
            (s) => s.inferred.probable_domain === domain,
        );
    }

    countByDomainAndSubject(domain: string, subject: string): number {
        return this.loadAll().filter(
            (s) =>
                s.inferred.probable_domain === domain &&
                (s.raw_data as Record<string, unknown>)["subject"] === subject,
        ).length;
    }

    private loadFile(filepath: string): Signal | null {
        try {
            const raw = readFileSync(filepath, "utf-8");
            const data = yamlParse(raw);
            return SignalSchema.parse(data);
        } catch {
            return null;
        }
    }
}
