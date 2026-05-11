import {
    readFileSync,
    writeFileSync,
    readdirSync,
    existsSync,
    unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { StagedEntrySchema, type StagedEntry } from "../schemas/index.js";
import {
    MemoryEntrySchema,
    type MemoryEntry,
    type BehaviorEffect,
} from "../schemas/memory-entry.js";

export class StagedStore {
    constructor(private dir: string) {}

    loadAll(): StagedEntry[] {
        if (!existsSync(this.dir)) return [];
        const files = readdirSync(this.dir).filter((f) => f.endsWith(".yaml"));
        const entries: StagedEntry[] = [];
        for (const file of files) {
            const entry = this.loadFile(join(this.dir, file));
            if (entry) entries.push(entry);
        }
        return entries;
    }

    loadPending(): StagedEntry[] {
        return this.loadAll().filter((e) => e.review_status === "pending");
    }

    save(entry: StagedEntry): void {
        const parsed = StagedEntrySchema.parse(entry);
        const filename = `${parsed.id}.yaml`;
        writeFileSync(
            join(this.dir, filename),
            yamlStringify(parsed),
            "utf-8",
        );
    }

    accept(id: string): MemoryEntry | null {
        const staged = this.loadAll().find((e) => e.id === id);
        if (!staged) return null;

        const now = new Date().toISOString();
        const draft = staged.draft_memory;

        const memory = MemoryEntrySchema.parse({
            id: `mem_${id.replace("staged_", "")}`,
            type: draft.type,
            domain: draft.domain,
            scope: draft.scope,
            status: "active",
            health: { state: "ok", reason: null },
            confidence: { level: "medium" },
            source: {
                kind: "conversation",
                refs: [{ type: "session", id: staged.origin_signal }],
                captured_at: staged.created_at,
            },
            subject: { name: draft.summary.slice(0, 50) },
            summary: draft.summary,
            rejected: draft.rejected,
            chosen: draft.chosen,
            behavior_effect: draft.behavior_effect,
            revisit: draft.revisit ?? { when: [], status: "not_met" },
            relations: { related: [], conflicts: [] },
            created_at: staged.created_at,
            updated_at: now,
        } satisfies MemoryEntry);

        // Update staged status
        staged.review_status = "accepted";
        this.save(staged);

        return memory;
    }

    reject(id: string): boolean {
        const staged = this.loadAll().find((e) => e.id === id);
        if (!staged) return false;
        staged.review_status = "rejected";
        this.save(staged);
        return true;
    }

    remove(id: string): boolean {
        const filepath = join(this.dir, `${id}.yaml`);
        if (existsSync(filepath)) {
            unlinkSync(filepath);
            return true;
        }
        return false;
    }

    private loadFile(filepath: string): StagedEntry | null {
        try {
            const raw = readFileSync(filepath, "utf-8");
            const data = yamlParse(raw);
            return StagedEntrySchema.parse(data);
        } catch {
            return null;
        }
    }
}
