import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GitEar } from "../../src/engines/git-ear.js";
import { mapGitSignalToEvent } from "../../src/engines/git-signal-mapper.js";
import { CompressionEngine } from "../../src/engines/compression-engine.js";
import { BloodStore } from "../../src/stores/blood-store.js";
import { SessionStore } from "../../src/stores/session-store.js";
import { SkeletonStore } from "../../src/stores/skeleton-store.js";

const MEITHEAL_ROOT = "/Users/saonian/Code/OpenSource/Meitheal";
const MEITHEAL_CAIRN = `${MEITHEAL_ROOT}/.cairn`;

describe.skipIf(!existsSync(MEITHEAL_CAIRN))("Meitheal runtime replay acceptance", () => {
    it("does not turn noisy large commits into a 50-item architecture review backlog", { timeout: 15_000 }, async () => {
        const skeletonStore = new SkeletonStore(`${MEITHEAL_CAIRN}/skeleton`);
        const gitEar = new GitEar(MEITHEAL_ROOT, skeletonStore);
        const scan = await gitEar.scan(null);

        const mapped = scan.signals
            .map(signal => ({ signal, event: mapGitSignalToEvent(signal, "2026-06-09T00:00:00Z") }))
            .filter(item => item.event !== null);
        const largeRefactorEvents = mapped.filter(item => item.signal.signal_type === "large_refactor");
        const docsOrConfigLargeRefactors = largeRefactorEvents.filter(item => {
            const files = item.signal.raw_data.files_changed ?? [];
            return files.length > 0 && files.every(file =>
                file.startsWith("docs/")
                || file === "AGENTS.md"
                || file === "CLAUDE.md"
                || file === ".gitignore"
                || file.endsWith("lock.yaml")
                || file.endsWith("lock.json")
            );
        });

        expect(largeRefactorEvents.length).toBeLessThanOrEqual(10);
        expect(docsOrConfigLargeRefactors).toHaveLength(0);
        expect(largeRefactorEvents.every(item => item.event!.evidence?.mapper_version === "git-signal-mapper:v2")).toBe(true);
    });

    it("extracts project-specific DNA candidates from repeated real-world behavior", { timeout: 15_000 }, async () => {
        const compression = new CompressionEngine(
            new BloodStore(`${MEITHEAL_CAIRN}/blood`),
            new SessionStore(`${MEITHEAL_CAIRN}/sessions`),
        );

        const candidates = await compression.detectCandidates(3, 3);
        const projectSpecific = candidates.filter(candidate =>
            !["infra_aggressiveness", "simplicity_bias"].includes(candidate.trait_name),
        );

        expect(projectSpecific.length).toBeGreaterThanOrEqual(2);
        expect(projectSpecific.some(c => c.trait_name === "leader_worker_boundary_sensitivity")).toBe(true);
        expect(projectSpecific.some(c => c.trait_name === "script_based_team_chat_validation")).toBe(true);
        expect(projectSpecific.every(c => c.evidence_events.length >= 3)).toBe(true);
    });
});
