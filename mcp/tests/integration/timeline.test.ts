import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeTraumaEvent,
    makeSkeletonNode, makeDNA, makeConfig, makeState,
    initTestRepo,
} from "../test-helpers.js";
import { buildPaths, ALL_DIRS } from "../../src/paths.js";
import { BloodStore } from "../../src/stores/blood-store.js";
import { SkeletonStore } from "../../src/stores/skeleton-store.js";
import { DnaStore } from "../../src/stores/dna-store.js";
import { DomainStore } from "../../src/stores/domain-store.js";
import { SignalStore } from "../../src/stores/signal-store.js";
import { StagedStore } from "../../src/stores/staged-store.js";
import { DnaStagedStore } from "../../src/stores/dna-staged-store.js";
import { StateStore } from "../../src/stores/state-store.js";
import { ConfigStore } from "../../src/stores/config-store.js";
import { GovernanceStore } from "../../src/stores/governance-store.js";
import { SessionStore } from "../../src/stores/session-store.js";
import { ActivationEngine } from "../../src/engines/activation-engine.js";
import { ChallengeEngine } from "../../src/engines/challenge-engine.js";
import { StageEngine } from "../../src/engines/stage-engine.js";
import { DecayEngine } from "../../src/engines/decay-engine.js";
import { CompressionEngine } from "../../src/engines/compression-engine.js";
import { ResurrectionEngine } from "../../src/engines/resurrection-engine.js";
import { ConsistencyEngine } from "../../src/engines/consistency-engine.js";
import { BloodEngine } from "../../src/engines/blood-engine.js";
import { ViewsEngine } from "../../src/engines/views-engine.js";
import { GovernanceEngine } from "../../src/engines/governance-engine.js";
import { TrustRouter } from "../../src/engines/trust-router.js";
import { GitEar } from "../../src/engines/git-ear.js";
import { CalibrationEar } from "../../src/engines/calibration-ear.js";
import type { CairnContext } from "../../src/context.js";
import { handleDoctor } from "../../src/tools/cairn-doctor.js";

function daysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function buildTimelineContext(tmpDir: string): Promise<CairnContext> {
    const paths = buildPaths(tmpDir);
    for (const dir of ALL_DIRS(paths)) {
        await mkdir(dir, { recursive: true });
    }
    initTestRepo(tmpDir, { stdio: "ignore" });

    const bloodStore = new BloodStore(paths.blood);
    const skeletonStore = new SkeletonStore(paths.skeleton);
    const dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
    const domainStore = new DomainStore(paths.domains);
    const signalStore = new SignalStore(paths.signalsGit, paths.signalsCalibration, paths.signalsConversation);
    const stagedStore = new StagedStore(paths.staged);
    const dnaStagedStore = new DnaStagedStore(paths.dnaStaged);
    const stateStore = new StateStore(paths.state);
    const configStore = new ConfigStore(paths.config);
    const governanceStore = new GovernanceStore(paths.governancePolicy, paths.governanceAudit);
    const sessionStore = new SessionStore(paths.sessions);

    await configStore.save(makeConfig());
    await stateStore.save(makeState());

    const challengeEngine = new ChallengeEngine(bloodStore, skeletonStore, dnaStore);
    const activationEngine = new ActivationEngine(bloodStore, skeletonStore, dnaStore, domainStore, stateStore, challengeEngine);
    const stageEngine = new StageEngine();
    const decayEngine = new DecayEngine(bloodStore);
    const compressionEngine = new CompressionEngine(bloodStore);
    const resurrectionEngine = new ResurrectionEngine(bloodStore, stateStore);
    const consistencyEngine = new ConsistencyEngine(bloodStore, skeletonStore, dnaStore, stateStore);
    const governanceEngine = new GovernanceEngine(governanceStore, configStore);
    const trustRouter = new TrustRouter(bloodStore, dnaStore, governanceEngine);
    const viewsEngine = new ViewsEngine(
        bloodStore, skeletonStore, domainStore, dnaStore, stateStore,
        paths.viewsOutput, paths.viewsStage, paths.viewsDomains,
        dnaStagedStore,
    );
    const bloodEngine = new BloodEngine(bloodStore, domainStore, viewsEngine);
    const gitEar = new GitEar(paths.root, skeletonStore);
    const calibrationEar = new CalibrationEar(paths.root, bloodStore, skeletonStore, domainStore, dnaStore);

    const ctx = {
        paths,
        bloodStore, skeletonStore, dnaStore, domainStore,
        signalStore, stagedStore, dnaStagedStore, stateStore, configStore,
        governanceStore, sessionStore,
        activationEngine, challengeEngine, stageEngine,
        decayEngine, compressionEngine, resurrectionEngine,
        consistencyEngine, bloodEngine, viewsEngine,
        governanceEngine, trustRouter, gitEar, calibrationEar,
    } as CairnContext;

    await skeletonStore.save(makeSkeletonNode("api-layer"));
    await domainStore.ensureDir("api-layer");

    return ctx;
}

// ---------------------------------------------------------------------------
// T4: Archived Resurrection Timeline
// ---------------------------------------------------------------------------

describe("T4: Archived Resurrection Timeline", () => {
    let tmpDir: string;
    let ctx: CairnContext;

    beforeAll(async () => {
        tmpDir = await createTmpDir();
        ctx = await buildTimelineContext(tmpDir);
    });

    afterAll(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("Step 1: blood event created with state=ok", async () => {
        const event = makeEvolutionEvent("evt_t4_001", {
            domain: "api-layer",
            gravity: { level: "G1" },
            subject: { name: "REST pagination" },
            behavior_effect: { type: "avoid_suggestion", instruction: "Do not use cursor pagination" },
            lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
        });
        await ctx.bloodStore.save(event);

        const loaded = await ctx.bloodStore.load("evt_t4_001");
        expect(loaded!.health.state).toBe("ok");
    });

    it("Step 2: DecayEngine detects stale after inactivity", async () => {
        const event = await ctx.bloodStore.load("evt_t4_001");
        event!.updated_at = daysAgo(150);
        await ctx.bloodStore.save(event!);

        const actions = await ctx.decayEngine.checkDecay("standard");
        const action = actions.find(a => a.event_id === "evt_t4_001");
        expect(action).toBeDefined();
        expect(action!.action).toBe("mark_stale");
    });

    it("Step 3: BloodEngine marks stale then archives", async () => {
        await ctx.bloodEngine.markStale("evt_t4_001", "no activation for 150 days");

        let event = await ctx.bloodStore.load("evt_t4_001");
        expect(event!.health.state).toBe("stale");

        await ctx.bloodEngine.archive("evt_t4_001", "aged out");

        event = await ctx.bloodStore.load("evt_t4_001");
        expect(event!.health.state).toBe("archived");
    });

    it("Step 4: activation hits accumulate above threshold", async () => {
        for (let i = 0; i < 5; i++) {
            await ctx.stateStore.recordActivation("evt_t4_001");
        }

        const state = await ctx.stateStore.load();
        expect(state.activation_log.recent_hits["evt_t4_001"]).toBe(5);
    });

    it("Step 5: ResurrectionEngine detects system_validated candidate", async () => {
        const candidates = await ctx.resurrectionEngine.checkResurrection();
        const candidate = candidates.find(c => c.event_id === "evt_t4_001");

        expect(candidate).toBeDefined();
        expect(candidate!.governance).toBe("system_validated");
    });

    it("Step 6: Doctor auto-resurrects G1 archived event", async () => {
        const result = await handleDoctor(ctx);
        const json = JSON.parse(result.content[0].text);

        expect(json.health.auto_resurrected).toContain("evt_t4_001");
    });

    it("Step 7: event is resurrected with incremented count", async () => {
        const event = await ctx.bloodStore.load("evt_t4_001");
        expect(event!.health.state).toBe("resurrected");
        expect(event!.lifecycle.resurrection_count).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// T2: Trauma Persistence Timeline
// ---------------------------------------------------------------------------

describe("T2: Trauma Persistence Timeline", () => {
    let tmpDir: string;
    let ctx: CairnContext;

    beforeAll(async () => {
        tmpDir = await createTmpDir();
        ctx = await buildTimelineContext(tmpDir);
    });

    afterAll(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("Step 1: create event and mark as trauma", async () => {
        const event = makeEvolutionEvent("evt_t2_001", {
            domain: "api-layer",
            gravity: { level: "G1" },
            subject: { name: "api-layer" },
            trigger: "api-layer incident",
            decision_or_change: "api-layer system failure",
        });
        await ctx.bloodStore.save(event);
        await ctx.bloodEngine.markTrauma("evt_t2_001");

        const loaded = await ctx.bloodStore.load("evt_t2_001");
        expect(loaded!.trauma.is_trauma).toBe(true);
        expect(loaded!.trauma.decay_override).toBe("permanent");
        expect(loaded!.trauma.sensitivity_multiplier).toBe(2.0);
        expect(loaded!.gravity.level).toBe("G2");
        expect(loaded!.lifecycle.decay_policy).toBe("permanent");
    });

    it("Step 2: simulate 200 days passing", async () => {
        const event = await ctx.bloodStore.load("evt_t2_001");
        event!.updated_at = daysAgo(200);
        await ctx.bloodStore.save(event!);

        const loaded = await ctx.bloodStore.load("evt_t2_001");
        const daysSince = Math.floor(
            (Date.now() - new Date(loaded!.updated_at).getTime()) / (1000 * 60 * 60 * 24),
        );
        expect(daysSince).toBeGreaterThanOrEqual(199);
    });

    it("Step 3: DecayEngine returns NO actions for trauma event", async () => {
        const actions = await ctx.decayEngine.checkDecay("standard");
        const traumaAction = actions.find(a => a.event_id === "evt_t2_001");
        expect(traumaAction).toBeUndefined();
    });

    it("Step 4: TrustRouter escalates gravity in trauma domain", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "new-api-endpoint",
            type: "architecture_decision",
            gravity: "G1",
        });

        // G1 → G2 (trauma found) → G3 (sensitivity_multiplier >= 2.0)
        expect(routing.gravity).toBe("G3");
        expect(routing.governance).toBe("human_ratified");
    });

    it("Step 5: ChallengeEngine emits trauma challenge", async () => {
        const challenges = await ctx.challengeEngine.detectConflicts({
            domain: "api-layer",
            task: "change api-layer configuration",
        });

        const traumaChallenge = challenges.find(c => c.trauma === true);
        expect(traumaChallenge).toBeDefined();
        expect(traumaChallenge!.conflict_with).toBe("evt_t2_001");
    });
});

// ---------------------------------------------------------------------------
// T3: Accepted Debt Revisit Timeline
// ---------------------------------------------------------------------------

describe("T3: Accepted Debt Revisit Timeline", () => {
    let tmpDir: string;
    let ctx: CairnContext;

    beforeAll(async () => {
        tmpDir = await createTmpDir();
        ctx = await buildTimelineContext(tmpDir);
    });

    afterAll(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("Step 1: create event with accepted_debt and commit", async () => {
        const event = makeEvolutionEvent("evt_t3_001", {
            domain: "api-layer",
            accepted_debt: ["manual-pagination"],
            reasoning: "no time to implement auto-pagination",
            behavior_effect: { type: "prefer_approach", instruction: "Use offset pagination for now" },
        });
        await ctx.bloodEngine.commit(event);

        const loaded = await ctx.bloodStore.load("evt_t3_001");
        expect(loaded).toBeDefined();
    });

    it("Step 2: debt synced to DomainStore", async () => {
        const debt = await ctx.domainStore.loadAcceptedDebt("api-layer");
        const match = debt.debts.find(d => d.what === "manual-pagination");
        expect(match).toBeDefined();
        expect(match!.source_event).toBe("evt_t3_001");
    });

    it("Step 3: create debt_resolution event and commit", async () => {
        const resolution = makeEvolutionEvent("evt_t3_002", {
            domain: "api-layer",
            type: "debt_resolution",
            subject: { name: "manual-pagination" },
            trigger: "traffic exceeded threshold",
            decision_or_change: "implemented cursor-based auto-pagination",
            behavior_effect: { type: "prefer_approach", instruction: "Use cursor pagination" },
        });
        await ctx.bloodEngine.commit(resolution);

        const loaded = await ctx.bloodStore.load("evt_t3_002");
        expect(loaded!.type).toBe("debt_resolution");
    });

    it("Step 4: CalibrationEar detects debt_resolution_candidate", async () => {
        const result = await ctx.calibrationEar.calibrate();
        const debtSignal = result.signals.find(
            s => s.signal_type === "debt_resolution_candidate",
        );

        expect(debtSignal).toBeDefined();
        expect(debtSignal!.description).toContain("manual-pagination");
    });
});

// ---------------------------------------------------------------------------
// T1: DNA Drift Timeline
// ---------------------------------------------------------------------------

describe("T1: DNA Drift Timeline", () => {
    let tmpDir: string;
    let ctx: CairnContext;

    beforeAll(async () => {
        tmpDir = await createTmpDir();
        ctx = await buildTimelineContext(tmpDir);
    });

    afterAll(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("Step 1: DNA identity initialized with simplicity_bias: high", async () => {
        await ctx.dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            reevaluation_mode: false,
            traits: {
                simplicity_bias: {
                    level: "high",
                    confidence: 0.85,
                    evidence_count: 7,
                    last_updated: "2026-03",
                    reasoning: "consistently prefers simple solutions",
                    drift_warning_count: 0,
                    last_safety_valve_at: null,
                },
            },
        }));

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.traits["simplicity_bias"].level).toBe("high");
        expect(identity.traits["simplicity_bias"].confidence).toBe(0.85);
    });

    it("Step 2: TrustRouter confirms DNA modulation is active", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "Next.js-framework",
            type: "architecture_decision",
            gravity: "G1",
            involves_complex_framework: true,
        });

        // simplicity_bias high + complex framework → G1 upgrades to G2
        expect(routing.gravity).toBe("G2");
        expect(routing.governance).toBe("human_ratified");
    });

    it("Step 3: add 5 contradicting high-gravity events", async () => {
        for (let i = 0; i < 5; i++) {
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_t1_contra_${i}`, {
                domain: "api-layer",
                type: "architecture_decision",
                gravity: { level: "G2" },
                subject: { name: `complex-adoption-${i}` },
                behavior_effect: {
                    type: "prefer_approach",
                    instruction: "Adopt distributed event sourcing pipeline",
                },
                decision_or_change: "Introduced CQRS with Kafka message bus",
                reasoning: "needed for horizontal scaling",
            }));
        }

        const all = await ctx.bloodStore.findActive();
        const contradicting = all.filter(e => e.id.startsWith("evt_t1_contra_"));
        expect(contradicting.length).toBe(5);
    });

    it("Step 4: CalibrationEar detects dna_drift_warning", async () => {
        const result = await ctx.calibrationEar.calibrate();
        const driftSignal = result.signals.find(
            s => s.signal_type === "dna_drift_warning" && s.affected_trait === "simplicity_bias",
        );

        expect(driftSignal).toBeDefined();
        expect(driftSignal!.description).toContain("simplicity_bias");
    });

    it("Step 5: SafetyValve reduces confidence — first round", async () => {
        const calibration = await ctx.calibrationEar.calibrate();
        const driftSignals = calibration.signals.filter(
            s => s.signal_type === "dna_drift_warning",
        );

        const valve = await ctx.calibrationEar.applySafetyValve(driftSignals);

        expect(valve.triggered_traits).toContain("simplicity_bias");
        expect(valve.confidence_reduced["simplicity_bias"].from).toBe(0.85);
        expect(valve.confidence_reduced["simplicity_bias"].to).toBeCloseTo(0.765, 3);
        expect(valve.entered_reevaluation).toBe(false);

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.traits["simplicity_bias"].drift_warning_count).toBe(1);
    });

    it("Step 6: add 5 more contradicting events — second round", async () => {
        for (let i = 5; i < 10; i++) {
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_t1_contra_${i}`, {
                domain: "api-layer",
                type: "architecture_decision",
                gravity: { level: "G2" },
                subject: { name: `complex-adoption-${i}` },
                behavior_effect: {
                    type: "prefer_approach",
                    instruction: "Adopt microservices orchestration layer",
                },
                decision_or_change: "Added service mesh with Istio",
                reasoning: "needed for observability across services",
            }));
        }

        const calibration = await ctx.calibrationEar.calibrate();
        const driftSignals = calibration.signals.filter(
            s => s.signal_type === "dna_drift_warning",
        );
        expect(driftSignals.length).toBeGreaterThanOrEqual(1);

        const valve = await ctx.calibrationEar.applySafetyValve(driftSignals);

        // drift_warning_count 1 → 2 (>= 2), confidence 0.765 → 0.6885 (< 0.7)
        expect(valve.entered_reevaluation).toBe(true);
        expect(valve.confidence_reduced["simplicity_bias"].to).toBeCloseTo(0.6885, 3);
    });

    it("Step 7: reevaluation_mode is active, drift_warning_count reset", async () => {
        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.reevaluation_mode).toBe(true);
        expect(identity.traits["simplicity_bias"].drift_warning_count).toBe(0);
    });

    it("Step 8: TrustRouter confirms DNA modulation is disabled", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "Angular-framework",
            type: "architecture_decision",
            gravity: "G1",
            involves_complex_framework: true,
        });

        // reevaluation_mode → no DNA modulation → gravity stays G1
        expect(routing.gravity).toBe("G1");
        expect(routing.destination).toBe("blood");
        expect(routing.governance).toBe("system_validated");
    });

    it("Step 9: ActivationEngine returns paused_traits, not relevant_traits", async () => {
        const result = await ctx.activationEngine.activate({ task: "work on api" });

        expect(result.dna.reevaluation_mode).toBe(true);
        expect(result.dna.relevant_traits).toEqual([]);
        expect(result.dna.paused_traits).toBeDefined();
        expect(result.dna.paused_traits!.some(
            t => t.name === "simplicity_bias" && t.level === "high",
        )).toBe(true);
    });
});
