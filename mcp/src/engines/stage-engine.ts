import type { Signal, StageSnapshot, StagePhase } from "../schemas/index.js";

interface StageSignals {
    projectAgeMonths: number;
    commitTrend: number;
    dependencyChangeRate: number;
    newFileRatio: number;
}

const PHASE_GUIDANCE: Record<StagePhase, string[]> = {
    exploration: [
        "快速验证，允许引入新依赖",
        "方向可以大幅调整",
        "关注验证速度而非代码质量",
    ],
    growth: [
        "平衡速度与稳定性",
        "新增依赖需要评估维护成本",
        "核心架构决策需要记录",
    ],
    maturity: [
        "新依赖需要强论证",
        "大重构需要明确收益",
        "稳定性优先于新特性",
    ],
    maintenance: [
        "只做必要的修复和安全更新",
        "避免大范围改动",
        "文档维护优先",
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
