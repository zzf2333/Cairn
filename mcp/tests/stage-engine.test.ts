import { describe, it, expect } from "vitest";
import { StageEngine } from "../src/engines/stage-engine.js";
import { makeSignal } from "./test-helpers.js";

describe("extractSignalsFromGitData", () => {
    const engine = new StageEngine();

    it("extracts project age and commit trend from stage-signal", () => {
        const signals = [
            makeSignal("sig_stage", {
                signal_type: "stage-signal",
                raw_data: { project_age_months: 18, trend: 1.3 },
            }),
        ];

        const result = engine.extractSignalsFromGitData(signals);

        expect(result.projectAgeMonths).toBe(18);
        expect(result.commitTrend).toBe(1.3);
    });

    it("calculates dependency change rate", () => {
        const signals = [
            makeSignal("sig_dep1", { signal_type: "dependency-removed" }),
            makeSignal("sig_dep2", { signal_type: "dependency-replaced" }),
            makeSignal("sig_normal1", { signal_type: "decision" }),
            makeSignal("sig_normal2", { signal_type: "decision" }),
            makeSignal("sig_normal3", { signal_type: "decision" }),
        ];

        const result = engine.extractSignalsFromGitData(signals);

        expect(result.dependencyChangeRate).toBe(2 / 5);
    });

    it("calculates newFileRatio from large-refactor", () => {
        const signals = [
            makeSignal("sig_refactor", {
                signal_type: "large-refactor",
                raw_data: { files_changed: 50, subject: "refactor" },
            }),
        ];

        const result = engine.extractSignalsFromGitData(signals);

        expect(result.newFileRatio).toBe(0.5);
    });

    it("returns defaults for empty signal array", () => {
        const result = engine.extractSignalsFromGitData([]);

        expect(result.projectAgeMonths).toBe(12);
        expect(result.commitTrend).toBe(1.0);
        expect(result.dependencyChangeRate).toBe(0.1);
        expect(result.newFileRatio).toBe(0.3);
    });

    it("handles mixed signal types", () => {
        const signals = [
            makeSignal("sig_s", {
                signal_type: "stage-signal",
                raw_data: { project_age_months: 6, trend: 2.0 },
            }),
            makeSignal("sig_d", { signal_type: "dependency-removed" }),
            makeSignal("sig_r", {
                signal_type: "large-refactor",
                raw_data: { files_changed: 30, subject: "cleanup" },
            }),
            makeSignal("sig_n", { signal_type: "decision" }),
        ];

        const result = engine.extractSignalsFromGitData(signals);

        expect(result.projectAgeMonths).toBe(6);
        expect(result.commitTrend).toBe(2.0);
        expect(result.dependencyChangeRate).toBe(1 / 4);
        expect(result.newFileRatio).toBe(0.3);
    });
});

describe("inferStage — boundary conditions", () => {
    const engine = new StageEngine();

    it("age=5 but depRate=0.2 does NOT trigger exploration", () => {
        const result = engine.inferStage({
            projectAgeMonths: 5,
            commitTrend: 1.0,
            dependencyChangeRate: 0.2,
            newFileRatio: 0.3,
        });

        expect(result.phase).not.toBe("exploration");
    });

    it("commitTrend=1.2 exactly does NOT match > 1.2", () => {
        const result = engine.inferStage({
            projectAgeMonths: 12,
            commitTrend: 1.2,
            dependencyChangeRate: 0.1,
            newFileRatio: 0.3,
        });

        // Falls to default branch (growth with 0.4), not the growth branch (0.65)
        expect(result.confidence).toBe(0.4);
        expect(result.evidence).toHaveLength(1);
        expect(result.evidence[0].signal).toContain("Default");
    });
});
