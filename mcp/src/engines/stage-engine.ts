import type { Signal, StageSnapshot, StagePhase } from "../schemas/index.js";

interface StageSignals {
    projectAgeMonths: number;
    commitTrend: number;
    dependencyChangeRate: number;
    newFileRatio: number;
}

const PHASE_GUIDANCE: Record<StagePhase, string[]> = {
    exploration: [
        "New dependencies OK, experiments OK",
        "Direction can shift significantly",
        "Prioritize validation speed over code quality",
    ],
    growth: [
        "Balance speed and stability",
        "New dependencies need maintenance cost assessment",
        "Core architecture decisions should be recorded",
    ],
    maturity: [
        "New dependencies need strong justification",
        "Large refactors need clear benefits",
        "Stability first, features second",
    ],
    maintenance: [
        "Conservative changes only — necessary fixes and security updates",
        "Avoid large-scale changes",
        "Documentation maintenance is a priority",
    ],
};

export class StageEngine {
    inferStage(signals: StageSignals): StageSnapshot {
        const { projectAgeMonths, commitTrend, dependencyChangeRate, newFileRatio } =
            signals;
        const now = new Date().toISOString();

        let phase: StagePhase;
        let confidence: number;
        const evidence: StageSnapshot["evidence"] = [];

        if (projectAgeMonths < 3) {
            phase = "exploration";
            confidence = dependencyChangeRate > 0.2 ? 0.65 : 0.55;
            evidence.push(
                { source: "git", signal: `Young project: ${projectAgeMonths} months (< 3)` },
            );
            if (dependencyChangeRate > 0.2) {
                evidence.push(
                    { source: "git", signal: `High dependency churn: ${dependencyChangeRate} (> 0.2)` },
                );
            }
            return {
                phase,
                confidence,
                status: "advisory",
                evidence,
                guidance: PHASE_GUIDANCE[phase],
                last_updated: now,
            };
        }

        if (projectAgeMonths < 6 && dependencyChangeRate > 0.3) {
            phase = "exploration";
            confidence = 0.6;
            evidence.push(
                { source: "git", signal: `Project age: ${projectAgeMonths} months (< 6)` },
                { source: "git", signal: `Dependency change rate: ${dependencyChangeRate} (> 0.3)` },
            );
        } else if (commitTrend > 1.2 && dependencyChangeRate < 0.15) {
            phase = "growth";
            confidence = 0.65;
            evidence.push(
                { source: "git", signal: `Commit trend: ${commitTrend} (> 1.2)` },
                { source: "git", signal: `Dependency change rate: ${dependencyChangeRate} (< 0.15)` },
            );
        } else if (commitTrend < 0.5 && projectAgeMonths > 24) {
            phase = "maintenance";
            confidence = 0.55;
            evidence.push(
                { source: "git", signal: `Commit trend: ${commitTrend} (< 0.5)` },
                { source: "git", signal: `Project age: ${projectAgeMonths} months (> 24)` },
            );
        } else if (newFileRatio < 0.15 && projectAgeMonths > 18) {
            phase = "maturity";
            confidence = 0.6;
            evidence.push(
                { source: "git", signal: `New file ratio: ${newFileRatio} (< 0.15)` },
                { source: "git", signal: `Project age: ${projectAgeMonths} months (> 18)` },
            );
        } else {
            phase = "growth";
            confidence = 0.4;
            evidence.push({
                source: "git",
                signal: "Default conservative estimate",
            });
        }

        return {
            phase,
            confidence,
            status: "advisory",
            evidence,
            guidance: PHASE_GUIDANCE[phase],
            last_updated: now,
        };
    }

    extractSignalsFromGitData(gitSignals: Signal[]): StageSignals {
        let projectAgeMonths = 12;
        let commitTrend = 1.0;
        let dependencyChangeRate = 0.1;
        let newFileRatio = 0.3;

        for (const signal of gitSignals) {
            if (signal.signal_type !== "stage-signal") continue;
            const raw = signal.raw_data as Record<string, unknown>;

            if (raw["project_age_months"] !== undefined) {
                projectAgeMonths = raw["project_age_months"] as number;
            }
            if (raw["trend"] !== undefined) {
                commitTrend = raw["trend"] as number;
            }
        }

        const depSignals = gitSignals.filter(
            (s) =>
                s.signal_type === "dependency-removed" ||
                s.signal_type === "dependency-replaced",
        );
        if (gitSignals.length > 0) {
            dependencyChangeRate = depSignals.length / Math.max(1, gitSignals.length);
        }

        const refactorSignals = gitSignals.filter(
            (s) => s.signal_type === "large-refactor",
        );
        if (refactorSignals.length > 0) {
            const raw = refactorSignals[0].raw_data as Record<string, unknown>;
            const filesChanged = (raw["files_changed"] as number) ?? 0;
            newFileRatio = Math.min(1, filesChanged / 100);
        }

        return { projectAgeMonths, commitTrend, dependencyChangeRate, newFileRatio };
    }
}
