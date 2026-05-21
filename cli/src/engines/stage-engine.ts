import type { ProjectPhase } from "../constants.js";

export interface StageInput {
    projectAgeMonths: number;
    commitCount30d: number;
    projectAvgCommits30d: number;
    dependencyChangeRate: number;
    newFileRatio: number;
    contributorCount: number;
}

export interface StageResult {
    phase: ProjectPhase;
    confidence: number;
    evidence: Array<{ source: string; signal: string }>;
    guidance: string[];
}

const GUIDANCE: Record<ProjectPhase, string[]> = {
    exploration: ["快速验证优先", "允许临时方案", "不要求架构完美"],
    growth: ["平衡速度与稳定性", "新增依赖需要评估维护成本", "新功能不破坏已有功能"],
    maturity: ["稳定性优先", "大变更需要强论证", "避免不必要的新依赖"],
    maintenance: ["最小变更", "不引入新依赖", "不做结构性改动"],
};

export class StageEngine {
    infer(input: StageInput): StageResult {
        const evidence: Array<{ source: string; signal: string }> = [];
        let confidence = 0.5;
        const commitRatio = input.projectAvgCommits30d > 0
            ? input.commitCount30d / input.projectAvgCommits30d
            : 0;

        if (input.projectAgeMonths < 3 || input.newFileRatio > 0.6) {
            if (input.projectAgeMonths < 3) {
                evidence.push({ source: "project_age", signal: `project age ${input.projectAgeMonths} months < 3` });
                confidence += 0.15;
            }
            if (input.newFileRatio > 0.6) {
                evidence.push({ source: "new_file_ratio", signal: `new file ratio ${input.newFileRatio} > 0.6` });
                confidence += 0.1;
            }
            if (input.projectAgeMonths < 1) confidence += 0.1;
            return {
                phase: "exploration",
                confidence: Math.min(confidence, 1),
                evidence,
                guidance: GUIDANCE.exploration,
            };
        }

        if (commitRatio > 1.2 && input.dependencyChangeRate < 0.15) {
            evidence.push({ source: "commit_ratio", signal: `commit ratio ${commitRatio.toFixed(2)} > 1.2` });
            evidence.push({ source: "dependency_change_rate", signal: `dependency change rate ${input.dependencyChangeRate} < 0.15` });
            confidence += 0.15;
            if (commitRatio > 1.5) confidence += 0.1;
            if (input.contributorCount > 1) {
                evidence.push({ source: "contributors", signal: `${input.contributorCount} contributors` });
                confidence += 0.05;
            }
            return {
                phase: "growth",
                confidence: Math.min(confidence, 1),
                evidence,
                guidance: GUIDANCE.growth,
            };
        }

        if (input.newFileRatio < 0.05 && commitRatio < 0.8) {
            evidence.push({ source: "new_file_ratio", signal: `new file ratio ${input.newFileRatio} < 0.05` });
            evidence.push({ source: "commit_ratio", signal: `commit ratio ${commitRatio.toFixed(2)} < 0.8` });
            confidence += 0.15;
            if (input.dependencyChangeRate < 0.05) {
                evidence.push({ source: "dependency_change_rate", signal: `dependency change rate ${input.dependencyChangeRate} < 0.05` });
                confidence += 0.1;
            }
            return {
                phase: "maturity",
                confidence: Math.min(confidence, 1),
                evidence,
                guidance: GUIDANCE.maturity,
            };
        }

        if (commitRatio < 0.5) {
            evidence.push({ source: "commit_ratio", signal: `commit ratio ${commitRatio.toFixed(2)} < 0.5` });
            confidence += 0.1;
            return {
                phase: "maintenance",
                confidence: Math.min(confidence, 1),
                evidence,
                guidance: GUIDANCE.maintenance,
            };
        }

        evidence.push({ source: "default", signal: "no strong phase signal detected" });
        confidence -= 0.1;
        return {
            phase: "growth",
            confidence: Math.max(confidence, 0),
            evidence,
            guidance: GUIDANCE.growth,
        };
    }
}
