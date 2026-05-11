import type { MemoryStore } from "../stores/memory-store.js";
import type { ViewsEngine } from "./views-engine.js";
import type { MemoryEntry } from "../schemas/index.js";

export class MemoryEngine {
    constructor(
        private memoryStore: MemoryStore,
        private viewsEngine: ViewsEngine,
    ) {}

    write(entry: MemoryEntry): void {
        // Duplicate check
        const existing = this.memoryStore.findDuplicate(
            entry.domain,
            entry.subject.name,
            entry.type,
        );

        if (existing) {
            // Merge source refs
            const mergedRefs = [
                ...existing.source.refs,
                ...entry.source.refs,
            ];
            existing.source.refs = mergedRefs;
            existing.updated_at = new Date().toISOString();
            this.memoryStore.save(existing);
        } else {
            // Conflict detection
            this.detectConflicts(entry);
            this.memoryStore.save(entry);
        }

        this.viewsEngine.regenerate();
    }

    archive(id: string): boolean {
        const entry = this.memoryStore.loadById(id);
        if (!entry) return false;
        entry.status = "archived";
        entry.updated_at = new Date().toISOString();
        this.memoryStore.save(entry);
        this.viewsEngine.regenerate();
        return true;
    }

    private detectConflicts(newEntry: MemoryEntry): void {
        const domainEntries = this.memoryStore.findByDomain(newEntry.domain);
        for (const existing of domainEntries) {
            if (existing.status !== "active") continue;

            const hasConflict =
                (existing.behavior_effect.type === "avoid_suggestion" &&
                    newEntry.behavior_effect.type === "prefer_approach" &&
                    existing.subject.name === newEntry.subject.name) ||
                (existing.behavior_effect.type === "prefer_approach" &&
                    newEntry.behavior_effect.type === "avoid_suggestion" &&
                    existing.subject.name === newEntry.subject.name);

            if (hasConflict) {
                existing.health = {
                    state: "conflicted",
                    reason: `Conflicts with ${newEntry.id}: behavior_effect contradiction`,
                };
                existing.relations.conflicts.push(newEntry.id);
                this.memoryStore.save(existing);

                newEntry.health = {
                    state: "conflicted",
                    reason: `Conflicts with ${existing.id}: behavior_effect contradiction`,
                };
                newEntry.relations.conflicts.push(existing.id);
            }
        }
    }
}
