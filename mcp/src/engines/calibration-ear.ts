import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CalibrationSignal } from "../schemas/index.js";
import type { BloodStore, SkeletonStore, DomainStore } from "../stores/index.js";

export interface CalibrationResult {
    signals: CalibrationSignal[];
}

export class CalibrationEar {
    constructor(
        private readonly projectRoot: string,
        private readonly bloodStore: BloodStore,
        private readonly skeletonStore: SkeletonStore,
        private readonly domainStore: DomainStore,
    ) {}

    async calibrate(): Promise<CalibrationResult> {
        const signals: CalibrationSignal[] = [];
        let index = 0;

        const conflictSignals = await this.checkNoGoConflicts(index);
        signals.push(...conflictSignals);
        index += conflictSignals.length;

        const driftSignals = await this.checkSkeletonDrift(index);
        signals.push(...driftSignals);

        return { signals };
    }

    private async checkNoGoConflicts(startIndex: number): Promise<CalibrationSignal[]> {
        const signals: CalibrationSignal[] = [];
        const now = new Date().toISOString();

        const allEvents = await this.bloodStore.loadAll();
        const noGoEvents = allEvents.filter(e => e.behavior_effect.type === "avoid_suggestion");

        if (noGoEvents.length === 0) return signals;

        let packageJson: Record<string, unknown>;
        try {
            const raw = await readFile(join(this.projectRoot, "package.json"), "utf-8");
            packageJson = JSON.parse(raw);
        } catch {
            return signals;
        }

        const deps = {
            ...(packageJson.dependencies as Record<string, string> | undefined ?? {}),
            ...(packageJson.devDependencies as Record<string, string> | undefined ?? {}),
        };
        const depNames = new Set(Object.keys(deps));

        let index = startIndex;
        for (const event of noGoEvents) {
            if (depNames.has(event.subject.name)) {
                signals.push({
                    id: `sig_cal_${Date.now()}_calibration_conflict_${index++}`,
                    signal_type: "calibration_conflict",
                    domain: event.domain,
                    description: `No-go subject "${event.subject.name}" is present in project dependencies`,
                    evidence: {
                        expected: `"${event.subject.name}" should not be used (no-go)`,
                        actual: `"${event.subject.name}" found in package.json dependencies`,
                        source: "package.json",
                    },
                    inferred_gravity: "G2",
                    confidence: 0.9,
                    captured_at: now,
                });
            }
        }

        return signals;
    }

    private async checkSkeletonDrift(_startIndex: number): Promise<CalibrationSignal[]> {
        return [];
    }
}
