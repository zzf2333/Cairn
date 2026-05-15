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
    beforeEach(() => {
        engine = new ActivationEngine(bloodStore, skeletonStore, dnaStore, domainStore, stateStore);
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
                },
            },
            status: "emerged",
        }));

        const challenges = await engine.detectConflicts({
            involves_complex_framework: true,
        });
        expect(challenges.length).toBeGreaterThanOrEqual(1);
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
        expect(actions[0].action).toBe("mark_stale");
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

    it("detects candidates when threshold met", async () => {
        for (let i = 0; i < 5; i++) {
            await bloodStore.save(makeEvolutionEvent(`evt_${i}`, {
                domain: "api-layer",
                type: "rejection",
                time: `2026-0${i + 1}-15`,
            }));
        }
        const candidates = await engine.detectCandidates(3, 3);
        expect(candidates.length).toBeGreaterThanOrEqual(1);
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
});
