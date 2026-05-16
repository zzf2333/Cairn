import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { CalibrationSignal } from "../schemas/index.js";
import type { BloodStore, SkeletonStore, DomainStore, DnaStore } from "../stores/index.js";

export interface CalibrationResult {
    signals: CalibrationSignal[];
}

export interface SafetyValveResult {
    triggered_traits: string[];
    confidence_reduced: Record<string, { from: number; to: number }>;
    entered_reevaluation: boolean;
    signals: CalibrationSignal[];
}

export class CalibrationEar {
    constructor(
        private readonly projectRoot: string,
        private readonly bloodStore: BloodStore,
        private readonly skeletonStore: SkeletonStore,
        private readonly domainStore: DomainStore,
        private readonly dnaStore: DnaStore,
    ) {}

    async calibrate(): Promise<CalibrationResult> {
        const signals: CalibrationSignal[] = [];
        let index = 0;

        const conflictSignals = await this.checkNoGoConflicts(index);
        signals.push(...conflictSignals);
        index += conflictSignals.length;

        const driftSignals = await this.checkSkeletonDrift(index);
        signals.push(...driftSignals);
        index += driftSignals.length;

        const debtSignals = await this.checkDebtResolution(index);
        signals.push(...debtSignals);
        index += debtSignals.length;

        const dnaDriftSignals = await this.checkDnaDrift(index);
        signals.push(...dnaDriftSignals);

        return { signals };
    }

    async applySafetyValve(calibrationSignals: CalibrationSignal[]): Promise<SafetyValveResult> {
        const result: SafetyValveResult = {
            triggered_traits: [],
            confidence_reduced: {},
            entered_reevaluation: false,
            signals: [],
        };

        const driftWarnings = calibrationSignals.filter(
            s => s.signal_type === "dna_drift_warning" && s.affected_trait,
        );
        if (driftWarnings.length === 0) return result;

        const affectedTraits = new Set<string>();
        for (const w of driftWarnings) {
            if (w.affected_trait) affectedTraits.add(w.affected_trait);
        }

        const identity = await this.dnaStore.loadIdentity();
        const now = new Date().toISOString();
        let modified = false;
        let signalIndex = 0;

        for (const traitName of affectedTraits) {
            const trait = identity.traits[traitName];
            if (!trait) continue;
            if (trait.level !== "high") continue;

            const fromConfidence = trait.confidence;
            const toConfidence = Math.max(0, fromConfidence * 0.9);

            trait.drift_warning_count = (trait.drift_warning_count ?? 0) + 1;
            trait.confidence = toConfidence;
            trait.last_safety_valve_at = now;
            modified = true;

            result.triggered_traits.push(traitName);
            result.confidence_reduced[traitName] = { from: fromConfidence, to: toConfidence };

            if (
                trait.drift_warning_count >= 2
                && toConfidence < 0.7
                && !identity.reevaluation_mode
            ) {
                identity.reevaluation_mode = true;
                result.entered_reevaluation = true;
                trait.drift_warning_count = 0;

                result.signals.push({
                    id: `sig_cal_${Date.now()}_dna_safety_valve_triggered_${signalIndex++}`,
                    signal_type: "dna_safety_valve_triggered",
                    affected_trait: traitName,
                    description: `Safety valve auto-triggered for trait "${traitName}"; DNA entered reevaluation_mode`,
                    evidence: {
                        expected: "DNA trait stability above 0.7 confidence",
                        actual: `Trait "${traitName}" dropped to ${toConfidence.toFixed(2)} after ${trait.drift_warning_count + 1}+ drift warnings`,
                        source: "calibration",
                    },
                    inferred_gravity: "G2",
                    confidence: 0.95,
                    captured_at: now,
                });
            }
        }

        if (modified) {
            await this.dnaStore.saveIdentity(identity);
        }

        return result;
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

    private async checkSkeletonDrift(startIndex: number): Promise<CalibrationSignal[]> {
        const signals: CalibrationSignal[] = [];
        const now = new Date().toISOString();
        const allNodes = await this.skeletonStore.loadAll();
        if (allNodes.length === 0) return signals;

        const sourceDirs = ["src", "lib", "app", "packages", "modules"];
        const existingNames = new Set<string>();

        for (const dir of sourceDirs) {
            try {
                const entries = await readdir(join(this.projectRoot, dir), { withFileTypes: true });
                for (const entry of entries) {
                    existingNames.add(entry.name.toLowerCase());
                }
            } catch {
                // directory doesn't exist
            }
        }

        if (existingNames.size === 0) return signals;

        let index = startIndex;
        for (const node of allNodes) {
            const domainLower = node.domain.toLowerCase();
            const hasMatch = existingNames.has(domainLower)
                || node.causal_keywords.some(kw => existingNames.has(kw.toLowerCase()));

            if (!hasMatch && node.stability === "stable") {
                signals.push({
                    id: `sig_cal_${Date.now()}_skeleton_drift_${index++}`,
                    signal_type: "skeleton_drift",
                    domain: node.domain,
                    description: `Skeleton node "${node.domain}" has no matching source directory or module`,
                    evidence: {
                        expected: `Source directory or module matching "${node.domain}" or its keywords`,
                        actual: "No matching directory found in source roots",
                        source: "filesystem",
                    },
                    inferred_gravity: "G1",
                    confidence: 0.6,
                    captured_at: now,
                });
            }
        }

        return signals;
    }

    private async checkDebtResolution(startIndex: number): Promise<CalibrationSignal[]> {
        const signals: CalibrationSignal[] = [];
        const now = new Date().toISOString();

        const domains = await this.domainStore.listDomains();
        const allEvents = await this.bloodStore.loadAll();
        const resolutionSubjects = new Set(
            allEvents
                .filter(e => e.type === "debt_resolution")
                .map(e => e.subject.name.toLowerCase()),
        );

        let index = startIndex;
        for (const domain of domains) {
            const debt = await this.domainStore.loadAcceptedDebt(domain);
            for (const d of debt.debts) {
                if (resolutionSubjects.has(d.what.toLowerCase())) {
                    signals.push({
                        id: `sig_cal_${Date.now()}_debt_resolution_candidate_${index++}`,
                        signal_type: "debt_resolution_candidate",
                        domain,
                        description: `Accepted debt "${d.what}" may have been resolved — a debt_resolution event exists`,
                        evidence: {
                            expected: `Debt "${d.what}" is tracked as accepted`,
                            actual: `A debt_resolution blood event references "${d.what}"`,
                            source: "blood",
                        },
                        inferred_gravity: "G1",
                        confidence: 0.7,
                        captured_at: now,
                    });
                }
            }
        }

        return signals;
    }

    private async checkDnaDrift(startIndex: number): Promise<CalibrationSignal[]> {
        const signals: CalibrationSignal[] = [];
        const now = new Date().toISOString();

        const identity = await this.dnaStore.loadIdentity();
        if (identity.status === "not_yet_emerged") return signals;

        const allEvents = await this.bloodStore.loadAll();
        const recentHighGravity = allEvents.filter(e =>
            (e.gravity.level === "G2" || e.gravity.level === "G3")
            && (e.health.state === "ok" || e.health.state === "resurrected"),
        );

        let index = startIndex;
        for (const [traitName, trait] of Object.entries(identity.traits)) {
            if (trait.level !== "high") continue;

            const contradicting = recentHighGravity.filter(e => {
                if (traitName === "simplicity_bias") {
                    return e.type === "transition" || e.type === "architecture_decision";
                }
                if (traitName === "infra_aggressiveness") {
                    return e.type === "transition" && e.subject.type === "dependency";
                }
                const eventText = [e.subject.name, e.decision_or_change, e.trigger]
                    .join(" ").toLowerCase();
                const traitWords = traitName.split("_").filter(w => w.length > 3);
                return traitWords.some(word => eventText.includes(word));
            });

            if (contradicting.length > 3) {
                signals.push({
                    id: `sig_cal_${Date.now()}_dna_drift_warning_${index++}`,
                    signal_type: "dna_drift_warning",
                    affected_trait: traitName,
                    description: `DNA trait "${traitName}" (${trait.level}) contradicted by ${contradicting.length} recent high-gravity events`,
                    evidence: {
                        expected: `Behavior consistent with ${traitName}: ${trait.level}`,
                        actual: `${contradicting.length} recent events suggest a different tendency`,
                        source: "blood",
                    },
                    inferred_gravity: "G1",
                    confidence: 0.65,
                    captured_at: now,
                });
            }
        }

        return signals;
    }
}
