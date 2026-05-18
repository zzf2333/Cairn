import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeTraumaEvent,
    makeSkeletonNode, makeDNA, makeState,
} from "../test-helpers.js";
import { buildPaths } from "../../src/paths.js";
import { BloodStore } from "../../src/stores/blood-store.js";
import { SkeletonStore } from "../../src/stores/skeleton-store.js";
import { DnaStore } from "../../src/stores/dna-store.js";
import { DomainStore } from "../../src/stores/domain-store.js";
import { StateStore } from "../../src/stores/state-store.js";
import { ActivationEngine } from "../../src/engines/activation-engine.js";
import { ChallengeEngine } from "../../src/engines/challenge-engine.js";
import { StageEngine } from "../../src/engines/stage-engine.js";
import { DecayEngine } from "../../src/engines/decay-engine.js";
import { CompressionEngine } from "../../src/engines/compression-engine.js";
import { ResurrectionEngine } from "../../src/engines/resurrection-engine.js";
import { ConsistencyEngine } from "../../src/engines/consistency-engine.js";
import { CalibrationEar } from "../../src/engines/calibration-ear.js";
import type { CalibrationSignal } from "../../src/schemas/index.js";

let tmpDir: string;
let paths: ReturnType<typeof buildPaths>;
let bloodStore: BloodStore;
let skeletonStore: SkeletonStore;
let dnaStore: DnaStore;
let domainStore: DomainStore;
let stateStore: StateStore;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    paths = buildPaths(tmpDir);
    await mkdir(paths.cairn, { recursive: true });
    bloodStore = new BloodStore(paths.blood);
    skeletonStore = new SkeletonStore(paths.skeleton);
    dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
    domainStore = new DomainStore(paths.domains);
    stateStore = new StateStore(paths.state);
    await bloodStore.ensureDir();
    await skeletonStore.ensureDir();
    await mkdir(paths.dna, { recursive: true });
    await stateStore.save(makeState());
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("ActivationEngine", () => {
    let engine: ActivationEngine;
    let challengeEngine: ChallengeEngine;
    beforeEach(() => {
        challengeEngine = new ChallengeEngine(bloodStore, skeletonStore, dnaStore);
        engine = new ActivationEngine(bloodStore, skeletonStore, dnaStore, domainStore, stateStore, challengeEngine);
    });

    it("returns empty context when no data exists", async () => {
        const result = await engine.activate({});
        expect(result.constraints.no_go).toEqual([]);
        expect(result.relevant_domains).toEqual([]);
        expect(result.challenges).toEqual([]);
    });

    it("activates skeleton nodes by keyword", async () => {
        await skeletonStore.save(makeSkeletonNode("api-layer", {
            causal_keywords: ["api", "REST", "endpoint"],
        }));
        await skeletonStore.save(makeSkeletonNode("auth", {
            causal_keywords: ["auth", "session", "login"],
        }));

        const result = await engine.activate({ task: "fix the API endpoint" });
        expect(result.meta.skeleton_nodes_activated).toContain("api-layer");
    });

    it("collects no-go constraints from blood events", async () => {
        await skeletonStore.save(makeSkeletonNode("api-layer"));
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            domain: "api-layer",
            subject: { name: "tRPC" },
            behavior_effect: { type: "avoid_suggestion", instruction: "do not use tRPC" },
        }));

        const result = await engine.activate({ task: "work on api" });
        expect(result.constraints.no_go.length).toBeGreaterThanOrEqual(1);
        expect(result.constraints.no_go[0].what).toBe("tRPC");
    });

    it("includes stage advisory", async () => {
        const result = await engine.activate({});
        expect(result.stage.phase).toBe("growth");
    });

    it("populates challenges from ChallengeEngine", async () => {
        await skeletonStore.save(makeSkeletonNode("api-layer", {
            causal_keywords: ["api", "REST"],
        }));
        await bloodStore.save(makeEvolutionEvent("evt_nogo", {
            domain: "api-layer",
            gravity: { level: "G2" },
            subject: { name: "tRPC" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
        }));

        const result = await engine.activate({ task: "migrate api to tRPC" });
        expect(result.challenges.length).toBeGreaterThanOrEqual(1);
        expect(result.challenges[0].conflict_with).toBe("evt_nogo");
    });

    it("surfaces archived high-hit events as reactivating no-go", async () => {
        await skeletonStore.save(makeSkeletonNode("api-layer", {
            causal_keywords: ["api"],
        }));
        await bloodStore.save(makeEvolutionEvent("evt_archived", {
            domain: "api-layer",
            gravity: { level: "G2" },
            subject: { name: "GraphQL" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no GraphQL" },
            health: { state: "stale", reason: "old" },
        }));
        await stateStore.save(makeState({
            activation_log: { recent_hits: { evt_archived: 10 } },
        }));

        const result = await engine.activate({ task: "work on api" });
        const archived = result.constraints.no_go.find(n => n.source_event === "evt_archived");
        expect(archived).toBeDefined();
        expect(archived!.archived).toBe(true);
        expect(archived!.reason.toLowerCase()).toContain("archived");
    });
});

describe("ChallengeEngine", () => {
    let engine: ChallengeEngine;
    beforeEach(() => {
        engine = new ChallengeEngine(bloodStore, skeletonStore, dnaStore);
    });

    it("returns no challenges when no data exists", async () => {
        const challenges = await engine.detectConflicts({});
        expect(challenges).toEqual([]);
    });

    it("detects no-go conflict", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            subject: { name: "tRPC" },
            gravity: { level: "G2" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
        }));

        const challenges = await engine.detectConflicts({
            subject_name: "tRPC",
        });
        expect(challenges.length).toBeGreaterThanOrEqual(1);
        expect(challenges[0].level).toBe("reflective_challenge");
    });

    it("detects trauma conflict", async () => {
        await bloodStore.save(makeTraumaEvent("evt_trauma", "auth"));

        const challenges = await engine.detectConflicts({
            domain: "auth",
            task: "change auth system",
        });
        const traumaChallenge = challenges.find(c => c.trauma);
        expect(traumaChallenge).toBeDefined();
    });

    it("detects DNA simplicity conflict", async () => {
        await dnaStore.saveIdentity(makeDNA({
            traits: {
                simplicity_bias: {
                    level: "high",
                    confidence: 0.85,
                    evidence_count: 7,
                    last_updated: "2026-03",
                    reasoning: "prefers simple",
                    drift_warning_count: 0,
                    last_safety_valve_at: null,
                },
            },
            status: "emerged",
        }));

        const challenges = await engine.detectConflicts({
            involves_complex_framework: true,
        });
        expect(challenges.length).toBeGreaterThanOrEqual(1);
    });

    it("downgrades archived no-go to a softer challenge", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_stale", {
            subject: { name: "tRPC" },
            gravity: { level: "G2" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
            health: { state: "stale", reason: "old" },
        }));
        const challenges = await engine.detectConflicts({ subject_name: "tRPC" });
        const stale = challenges.find(c => c.conflict_with === "evt_stale");
        expect(stale).toBeDefined();
        expect(stale!.level).toBe("suggestion");
        expect(stale!.archived).toBe(true);
    });

    it("matches no-go via subject aliases", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_alias", {
            subject: { name: "MongoDB", aliases: ["document store", "nosql"] },
            gravity: { level: "G2" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no document stores" },
        }));
        const challenges = await engine.detectConflicts({ task: "add a document store" });
        const found = challenges.find(c => c.conflict_with === "evt_alias");
        expect(found).toBeDefined();
    });

    it("matches no-go via rejected_paths", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_path", {
            subject: { name: "Kafka", aliases: [] },
            rejected_paths: [{ path: "event bus", reason: "operational cost" }],
            gravity: { level: "G2" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no event bus" },
        }));
        const challenges = await engine.detectConflicts({ task: "introduce an event bus" });
        const found = challenges.find(c => c.conflict_with === "evt_path");
        expect(found).toBeDefined();
    });

    it("skips archived G1 no-go (would downgrade to nothing)", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_stale_g1", {
            subject: { name: "tRPC" },
            gravity: { level: "G1" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
            health: { state: "stale", reason: "old" },
        }));
        const challenges = await engine.detectConflicts({ subject_name: "tRPC" });
        expect(challenges.find(c => c.conflict_with === "evt_stale_g1")).toBeUndefined();
    });
});

describe("StageEngine", () => {
    const engine = new StageEngine();

    it("infers exploration for young projects", () => {
        const result = engine.infer({
            projectAgeMonths: 1,
            commitCount30d: 50,
            projectAvgCommits30d: 50,
            dependencyChangeRate: 0.3,
            newFileRatio: 0.7,
            contributorCount: 2,
        });
        expect(result.phase).toBe("exploration");
    });

    it("infers growth for active stable projects", () => {
        const result = engine.infer({
            projectAgeMonths: 6,
            commitCount30d: 60,
            projectAvgCommits30d: 40,
            dependencyChangeRate: 0.1,
            newFileRatio: 0.3,
            contributorCount: 3,
        });
        expect(result.phase).toBe("growth");
    });

    it("infers maturity for low-change projects", () => {
        const result = engine.infer({
            projectAgeMonths: 18,
            commitCount30d: 15,
            projectAvgCommits30d: 25,
            dependencyChangeRate: 0.02,
            newFileRatio: 0.02,
            contributorCount: 4,
        });
        expect(result.phase).toBe("maturity");
    });

    it("includes guidance per phase", () => {
        const result = engine.infer({
            projectAgeMonths: 1,
            commitCount30d: 50,
            projectAvgCommits30d: 50,
            dependencyChangeRate: 0.3,
            newFileRatio: 0.7,
            contributorCount: 2,
        });
        expect(result.guidance.length).toBeGreaterThan(0);
    });
});

describe("DecayEngine", () => {
    let engine: DecayEngine;
    beforeEach(() => {
        engine = new DecayEngine(bloodStore);
    });

    it("returns no actions for fresh events", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            lifecycle: {
                validity: "tactical",
                review_after: "2027-01",
                decay_policy: "downgrade",
                resurrection_count: 0,
            },
        }));
        const actions = await engine.checkDecay("standard");
        expect(actions).toEqual([]);
    });

    it("marks stale events with expired review_after", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            lifecycle: {
                validity: "tactical",
                review_after: "2020-01",
                decay_policy: "downgrade",
                resurrection_count: 0,
            },
        }));
        const actions = await engine.checkDecay("standard");
        expect(actions.length).toBeGreaterThanOrEqual(1);
        expect(actions[0].action).toBe("downgrade");
    });

    it("skips trauma events with permanent decay override", async () => {
        await bloodStore.save(makeTraumaEvent("evt_trauma", "auth"));
        const actions = await engine.checkDecay("standard");
        const traumaAction = actions.find(a => a.event_id === "evt_trauma");
        expect(traumaAction).toBeUndefined();
    });
});

describe("CompressionEngine", () => {
    let engine: CompressionEngine;
    beforeEach(() => {
        engine = new CompressionEngine(bloodStore);
    });

    it("returns no candidates with few events", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001"));
        const candidates = await engine.detectCandidates(3, 3);
        expect(candidates).toEqual([]);
    });

    it("returns no candidates for generic group not matching known traits", async () => {
        for (let i = 0; i < 5; i++) {
            await bloodStore.save(makeEvolutionEvent(`evt_${i}`, {
                domain: "api-layer",
                type: "rejection",
                time: `2026-0${i + 1}-15`,
            }));
        }
        const candidates = await engine.detectCandidates(3, 3);
        expect(candidates).toEqual([]);
    });

    it("detects infra_aggressiveness from infra rejections", async () => {
        for (let i = 0; i < 5; i++) {
            await bloodStore.save(makeEvolutionEvent(`evt_${i}`, {
                domain: "infra",
                type: "rejection",
                time: `2026-0${i + 1}-15`,
                behavior_effect: { type: "avoid_suggestion", instruction: "no kafka" },
            }));
        }
        const candidates = await engine.detectCandidates(3, 3);
        expect(candidates.length).toBeGreaterThanOrEqual(1);
        expect(candidates[0].trait_name).toBe("infra_aggressiveness");
    });

    it("detects simplicity_bias from simplicity-keyword reasoning", async () => {
        for (let i = 0; i < 4; i++) {
            await bloodStore.save(makeEvolutionEvent(`evt_${i}`, {
                domain: "architecture",
                type: "architecture_decision",
                time: `2026-0${i + 1}-15`,
                reasoning: "prefer simple solution, avoid complexity",
            }));
        }
        const candidates = await engine.detectCandidates(3, 3);
        expect(candidates.length).toBeGreaterThanOrEqual(1);
        expect(candidates[0].trait_name).toBe("simplicity_bias");
    });
});

describe("ResurrectionEngine", () => {
    let engine: ResurrectionEngine;
    beforeEach(() => {
        engine = new ResurrectionEngine(bloodStore, stateStore);
    });

    it("returns no candidates when no archived events", async () => {
        const candidates = await engine.checkResurrection();
        expect(candidates).toEqual([]);
    });

    it("detects resurrection candidate", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_archived", {
            health: { state: "stale", reason: "old" },
        }));
        const state = makeState({
            activation_log: { recent_hits: { evt_archived: 10 } },
        });
        await stateStore.save(state);

        const candidates = await engine.checkResurrection(5);
        expect(candidates.length).toBeGreaterThanOrEqual(1);
    });
});

describe("ConsistencyEngine", () => {
    let engine: ConsistencyEngine;
    beforeEach(() => {
        engine = new ConsistencyEngine(bloodStore, skeletonStore, dnaStore, stateStore);
    });

    it("returns consistent when no data exists", async () => {
        const report = await engine.runAll();
        expect(report.overall).toBe("consistent");
    });

    it("detects contradictory constraints", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            domain: "api",
            subject: { name: "Redis" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no Redis" },
        }));
        await bloodStore.save(makeEvolutionEvent("evt_002", {
            domain: "api",
            subject: { name: "Redis" },
            behavior_effect: { type: "prefer_approach", instruction: "use Redis" },
        }));

        const result = await engine.checkConstraintConsistency();
        expect(result.passed).toBe(false);
        expect(result.violations.length).toBeGreaterThanOrEqual(1);
    });

    it("detects blood domain without skeleton node", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_orphan", {
            domain: "orphan-domain",
        }));
        const result = await engine.checkSkeletonReality();
        expect(result.passed).toBe(false);
        expect(result.violations[0].rule).toBe("skeleton_reality");
        expect(result.violations[0].description).toContain("orphan-domain");
    });

    it("passes skeleton reality when domains match", async () => {
        await skeletonStore.save(makeSkeletonNode("api-layer"));
        await bloodStore.save(makeEvolutionEvent("evt_001", { domain: "api-layer" }));
        const result = await engine.checkSkeletonReality();
        expect(result.passed).toBe(true);
    });

    it("detects archived high-activation events", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_archived", {
            health: { state: "stale", reason: "old" },
        }));
        await stateStore.save(makeState({
            activation_log: { recent_hits: { evt_archived: 10 } },
        }));

        const result = await engine.checkArchivedReactivation();
        expect(result.passed).toBe(false);
    });

    it("does not flag simplicity-supporting architecture decisions as drift", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                simplicity_bias: { level: "high", confidence: 0.8, evidence_count: 5, last_updated: "2026-05", reasoning: "test", drift_warning_count: 0 },
            },
        }));
        for (let i = 0; i < 5; i++) {
            await bloodStore.save(makeEvolutionEvent(`evt_simple_${i}`, {
                type: "architecture_decision",
                gravity: { level: "G2" },
                behavior_effect: { type: "prefer_approach", instruction: "Keep it simple and minimal" },
                decision_or_change: "Chose lightweight approach over complex alternative",
                rejected_paths: [{ path: "Complex framework", reason: "Over-engineered for this scope" }],
            }));
        }
        const result = await engine.checkDNAConsistency();
        expect(result.passed).toBe(true);
    });

    it("does not flag avoid_suggestion events as contradicting simplicity_bias", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                simplicity_bias: { level: "high", confidence: 0.8, evidence_count: 5, last_updated: "2026-05", reasoning: "test", drift_warning_count: 0 },
            },
        }));
        for (let i = 0; i < 5; i++) {
            await bloodStore.save(makeEvolutionEvent(`evt_avoid_${i}`, {
                type: "architecture_decision",
                gravity: { level: "G2" },
                behavior_effect: { type: "avoid_suggestion", instruction: "Do not use this complex pattern" },
                decision_or_change: "Rejected heavy framework adoption",
            }));
        }
        const result = await engine.checkDNAConsistency();
        expect(result.passed).toBe(true);
    });

    it("flags truly complexity-introducing decisions as drift", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                simplicity_bias: { level: "high", confidence: 0.8, evidence_count: 5, last_updated: "2026-05", reasoning: "test", drift_warning_count: 0 },
            },
        }));
        for (let i = 0; i < 5; i++) {
            await bloodStore.save(makeEvolutionEvent(`evt_complex_${i}`, {
                type: "architecture_decision",
                gravity: { level: "G2" },
                behavior_effect: { type: "prefer_approach", instruction: "Adopt distributed event sourcing pipeline" },
                decision_or_change: "Introduced CQRS with Kafka message bus",
                rejected_paths: [],
            }));
        }
        const result = await engine.checkDNAConsistency();
        expect(result.passed).toBe(false);
        expect(result.violations[0].rule).toBe("dna_event_consistency");
    });
});

describe("CalibrationEar — safety valve", () => {
    let ear: CalibrationEar;
    beforeEach(() => {
        ear = new CalibrationEar(tmpDir, bloodStore, skeletonStore, domainStore, dnaStore);
    });

    function makeDriftSignal(trait: string): CalibrationSignal {
        return {
            id: `sig_test_drift_${trait}`,
            signal_type: "dna_drift_warning",
            affected_trait: trait,
            description: `DNA trait "${trait}" drift`,
            evidence: { expected: "x", actual: "y", source: "blood" },
            inferred_gravity: "G1",
            confidence: 0.65,
            captured_at: "2026-05-16T10:00:00Z",
        };
    }

    it("no-op when no drift signals", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                simplicity_bias: {
                    level: "high", confidence: 0.9, evidence_count: 5,
                    last_updated: "2026-03", reasoning: "x",
                    drift_warning_count: 0, last_safety_valve_at: null,
                },
            },
        }));
        const result = await ear.applySafetyValve([]);
        expect(result.triggered_traits).toEqual([]);
        expect(result.entered_reevaluation).toBe(false);
    });

    it("reduces confidence by 10% on a single warning for high trait", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                simplicity_bias: {
                    level: "high", confidence: 0.9, evidence_count: 5,
                    last_updated: "2026-03", reasoning: "x",
                    drift_warning_count: 0, last_safety_valve_at: null,
                },
            },
        }));
        const result = await ear.applySafetyValve([makeDriftSignal("simplicity_bias")]);
        expect(result.triggered_traits).toEqual(["simplicity_bias"]);
        expect(result.confidence_reduced["simplicity_bias"].from).toBeCloseTo(0.9);
        expect(result.confidence_reduced["simplicity_bias"].to).toBeCloseTo(0.81);
        expect(result.entered_reevaluation).toBe(false);
        const identity = await dnaStore.loadIdentity();
        expect(identity.traits.simplicity_bias.drift_warning_count).toBe(1);
        expect(identity.traits.simplicity_bias.confidence).toBeCloseTo(0.81);
    });

    it("enters reevaluation when count >= 2 and confidence drops below 0.7", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                simplicity_bias: {
                    level: "high", confidence: 0.75, evidence_count: 5,
                    last_updated: "2026-03", reasoning: "x",
                    drift_warning_count: 1, last_safety_valve_at: null,
                },
            },
        }));
        const result = await ear.applySafetyValve([makeDriftSignal("simplicity_bias")]);
        expect(result.entered_reevaluation).toBe(true);
        expect(result.signals.length).toBe(1);
        expect(result.signals[0].signal_type).toBe("dna_safety_valve_triggered");
        const identity = await dnaStore.loadIdentity();
        expect(identity.reevaluation_mode).toBe(true);
        expect(identity.traits.simplicity_bias.drift_warning_count).toBe(0);
    });

    it("ignores medium-level traits", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                infra_aggressiveness: {
                    level: "medium", confidence: 0.7, evidence_count: 3,
                    last_updated: "2026-03", reasoning: "x",
                    drift_warning_count: 0, last_safety_valve_at: null,
                },
            },
        }));
        const result = await ear.applySafetyValve([makeDriftSignal("infra_aggressiveness")]);
        expect(result.triggered_traits).toEqual([]);
    });

    it("does not double-trigger when already in reevaluation_mode", async () => {
        await dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            reevaluation_mode: true,
            traits: {
                simplicity_bias: {
                    level: "high", confidence: 0.5, evidence_count: 5,
                    last_updated: "2026-03", reasoning: "x",
                    drift_warning_count: 2, last_safety_valve_at: null,
                },
            },
        }));
        const result = await ear.applySafetyValve([makeDriftSignal("simplicity_bias")]);
        expect(result.entered_reevaluation).toBe(false);
        expect(result.signals.length).toBe(0);
    });
});
