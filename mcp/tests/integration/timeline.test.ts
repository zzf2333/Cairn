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
import type { DNAStagedEntry } from "../../src/schemas/dna-staged.js";
import { handleDoctor } from "../../src/tools/cairn-doctor.js";
import { handleDnaAccept } from "../../src/tools/cairn-dna-accept.js";

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

// ---------------------------------------------------------------------------
// T5: Compression → DNA Emergence Pipeline
// ---------------------------------------------------------------------------

describe("T5: Compression → DNA Emergence Pipeline", () => {
    let tmpDir: string;
    let ctx: CairnContext;

    beforeAll(async () => {
        tmpDir = await createTmpDir();
        ctx = await buildTimelineContext(tmpDir);
    });

    afterAll(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("Step 1: DNA starts as not_yet_emerged", async () => {
        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.status).toBe("not_yet_emerged");
        expect(Object.keys(identity.traits)).toHaveLength(0);
    });

    it("Step 2: accumulate 7 infra rejection events across 4 months", async () => {
        const baseTime = new Date("2026-01-10");
        for (let i = 0; i < 7; i++) {
            const time = new Date(baseTime);
            time.setMonth(time.getMonth() + Math.floor(i / 2));
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_t5_infra_${i}`, {
                domain: "infra",
                type: "rejection",
                time: time.toISOString().split("T")[0],
                gravity: { level: "G2" },
                subject: { name: `infra-tool-${i}`, type: "dependency" },
                behavior_effect: { type: "avoid_suggestion", instruction: `Do not use infra-tool-${i}` },
                source: { type: i % 2 === 0 ? "conversation" : "agent_inferred", confidence: 0.8, verified: false, refs: [] },
            }));
        }

        const active = await ctx.bloodStore.findActive();
        expect(active.filter(e => e.id.startsWith("evt_t5_infra_")).length).toBe(7);
    });

    it("Step 3: CompressionEngine detects infra_aggressiveness candidate", async () => {
        const candidates = await ctx.compressionEngine.detectCandidates(3, 3);
        const infraCandidate = candidates.find(c => c.trait_name === "infra_aggressiveness");

        expect(infraCandidate).toBeDefined();
        expect(infraCandidate!.level).toBe("high");
        expect(infraCandidate!.confidence).toBeGreaterThanOrEqual(0.6);
        expect(infraCandidate!.evidence_events.length).toBe(7);
    });

    it("Step 4: stage the DNA candidate for review", async () => {
        const candidates = await ctx.compressionEngine.detectCandidates(3, 3);
        const infraCandidate = candidates.find(c => c.trait_name === "infra_aggressiveness")!;

        const stagedEntry: DNAStagedEntry = {
            id: "stg_dna_infra_aggressiveness_t5",
            trait_name: infraCandidate.trait_name,
            level: infraCandidate.level,
            confidence: infraCandidate.confidence,
            evidence_events: infraCandidate.evidence_events,
            reasoning: infraCandidate.reasoning,
            proposed_at: new Date().toISOString(),
            review_status: "pending",
        };
        await ctx.dnaStagedStore.save(stagedEntry);

        const pending = await ctx.dnaStagedStore.findPending();
        expect(pending.length).toBe(1);
        expect(pending[0].trait_name).toBe("infra_aggressiveness");
    });

    it("Step 5: accept DNA trait → identity emerges", async () => {
        const result = await handleDnaAccept(ctx, { id: "stg_dna_infra_aggressiveness_t5" });
        const json = JSON.parse(result.content[0].text);

        expect(json.success).toBe(true);
        expect(json.trait_name).toBe("infra_aggressiveness");
        expect(json.dna_status).toBe("emerged");

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.status).toBe("emerged");
        expect(identity.traits["infra_aggressiveness"]).toBeDefined();
        expect(identity.traits["infra_aggressiveness"].level).toBe("high");
    });

    it("Step 6: trait now influences TrustRouter (infra_aggressiveness low only)", async () => {
        // infra_aggressiveness is "high", not "low" — so it does NOT upgrade gravity
        // for new infrastructure. The modulation only applies when level === "low"
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "new-redis-cluster",
            type: "architecture_decision",
            gravity: "G1",
            involves_new_infrastructure: true,
        });

        // high infra_aggressiveness does not modulate (only low does)
        expect(routing.gravity).toBe("G1");
        expect(routing.destination).toBe("blood");
    });

    it("Step 7: ChallengeEngine does NOT emit DNA challenge for high infra_aggressiveness", async () => {
        // DNA challenges only fire when infra_aggressiveness is "low" + involves_new_infrastructure
        const challenges = await ctx.challengeEngine.detectConflicts({
            domain: "api-layer",
            task: "add new infrastructure",
            involves_new_infrastructure: true,
        });

        const dnaChallenge = challenges.find(c => c.conflict_with === "dna:infra_aggressiveness");
        expect(dnaChallenge).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// T6: Trauma × DNA Cross-System Interaction
// ---------------------------------------------------------------------------

describe("T6: Trauma × DNA Cross-System Interaction", () => {
    let tmpDir: string;
    let ctx: CairnContext;

    beforeAll(async () => {
        tmpDir = await createTmpDir();
        ctx = await buildTimelineContext(tmpDir);
    });

    afterAll(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("Step 1: establish DNA simplicity_bias: high", async () => {
        await ctx.dnaStore.saveIdentity(makeDNA({
            status: "emerged",
            traits: {
                simplicity_bias: {
                    level: "high",
                    confidence: 0.9,
                    evidence_count: 10,
                    last_updated: "2026-03",
                    reasoning: "strong simplicity preference",
                    drift_warning_count: 0,
                    last_safety_valve_at: null,
                },
            },
        }));
    });

    it("Step 2: add trauma event in api-layer domain", async () => {
        const event = makeEvolutionEvent("evt_t6_trauma", {
            domain: "api-layer",
            gravity: { level: "G1" },
            subject: { name: "api-layer" },
            trigger: "api-layer outage",
            decision_or_change: "api-layer cascading failure",
        });
        await ctx.bloodStore.save(event);
        await ctx.bloodEngine.markTrauma("evt_t6_trauma");

        const loaded = await ctx.bloodStore.load("evt_t6_trauma");
        expect(loaded!.trauma.is_trauma).toBe(true);
        expect(loaded!.gravity.level).toBe("G2");
    });

    it("Step 3: TrustRouter applies BOTH trauma escalation and DNA modulation", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "new-complex-framework",
            type: "architecture_decision",
            gravity: "G0",
            involves_complex_framework: true,
        });

        // G0 → G1 (trauma) → G2 (trauma sensitivity_multiplier >= 2.0) → G3 (DNA simplicity_bias)
        expect(routing.gravity).toBe("G3");
        expect(routing.destination).toBe("staged");
        expect(routing.governance).toBe("human_ratified");
    });

    it("Step 4: verify escalation order — trauma first, then DNA", async () => {
        // G1 input: trauma → G2 → G3, then DNA would try G3 → G3 (capped)
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "another-complex-thing",
            type: "architecture_decision",
            gravity: "G1",
            involves_complex_framework: true,
        });

        // G1 → G2 (trauma) → G3 (trauma×2) → G3 (DNA, already capped)
        expect(routing.gravity).toBe("G3");
    });

    it("Step 5: enter reevaluation_mode — DNA modulation stops but trauma persists", async () => {
        const identity = await ctx.dnaStore.loadIdentity();
        identity.reevaluation_mode = true;
        await ctx.dnaStore.saveIdentity(identity);

        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "yet-another-framework",
            type: "architecture_decision",
            gravity: "G0",
            involves_complex_framework: true,
        });

        // G0 → G1 (trauma) → G2 (trauma×2), NO DNA modulation
        expect(routing.gravity).toBe("G2");
        expect(routing.governance).toBe("human_ratified");
    });

    it("Step 6: trauma challenge still fires; DNA challenge downgrades to advisory", async () => {
        const challenges = await ctx.challengeEngine.detectConflicts({
            domain: "api-layer",
            task: "change api-layer routing",
            involves_complex_framework: true,
        });

        const traumaChallenge = challenges.find(c => c.trauma === true);
        expect(traumaChallenge).toBeDefined();

        const dnaChallenge = challenges.find(c => c.conflict_with === "dna:simplicity_bias");
        expect(dnaChallenge).toBeDefined();
        expect(dnaChallenge!.level).toBe("suggestion");
        expect(dnaChallenge!.description).toContain("reevaluation");
        expect(dnaChallenge!.description).toContain("advisory");
    });
});

// ---------------------------------------------------------------------------
// T7: DNA Full Lifecycle (emerge → drift → reevaluation → recover → re-modulate)
// ---------------------------------------------------------------------------

describe("T7: DNA Full Lifecycle", () => {
    let tmpDir: string;
    let ctx: CairnContext;

    beforeAll(async () => {
        tmpDir = await createTmpDir();
        ctx = await buildTimelineContext(tmpDir);
    });

    afterAll(async () => {
        await cleanTmpDir(tmpDir);
    });

    it("Step 1: DNA emerges via dna_accept", async () => {
        await ctx.dnaStagedStore.save({
            id: "stg_dna_simplicity_t7",
            trait_name: "simplicity_bias",
            level: "high",
            confidence: 0.8,
            evidence_events: ["e1", "e2", "e3"],
            reasoning: "consistent simplicity preference across 3 events",
            proposed_at: new Date().toISOString(),
            review_status: "pending",
        });

        await handleDnaAccept(ctx, { id: "stg_dna_simplicity_t7" });

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.status).toBe("emerged");
        expect(identity.traits["simplicity_bias"].level).toBe("high");
        expect(identity.traits["simplicity_bias"].confidence).toBe(0.8);
    });

    it("Step 2: trait modulates routing", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "spring-boot",
            type: "architecture_decision",
            gravity: "G1",
            involves_complex_framework: true,
        });
        expect(routing.gravity).toBe("G2");
    });

    it("Step 3: first drift round — 5 contradicting events + safety valve", async () => {
        for (let i = 0; i < 5; i++) {
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_t7_drift1_${i}`, {
                domain: "api-layer",
                type: "architecture_decision",
                gravity: { level: "G2" },
                subject: { name: `complex-system-${i}` },
                behavior_effect: { type: "prefer_approach", instruction: "Adopt event-driven architecture" },
                decision_or_change: "Introduced saga orchestration pattern",
            }));
        }

        const cal = await ctx.calibrationEar.calibrate();
        const drift = cal.signals.filter(s => s.signal_type === "dna_drift_warning");
        expect(drift.length).toBeGreaterThanOrEqual(1);

        const valve = await ctx.calibrationEar.applySafetyValve(drift);
        expect(valve.triggered_traits).toContain("simplicity_bias");
        expect(valve.entered_reevaluation).toBe(false);

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.traits["simplicity_bias"].drift_warning_count).toBe(1);
        expect(identity.traits["simplicity_bias"].confidence).toBeCloseTo(0.72, 2);
    });

    it("Step 4: second drift round → reevaluation_mode triggers", async () => {
        for (let i = 0; i < 5; i++) {
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_t7_drift2_${i}`, {
                domain: "api-layer",
                type: "architecture_decision",
                gravity: { level: "G2" },
                subject: { name: `distributed-system-${i}` },
                behavior_effect: { type: "prefer_approach", instruction: "Deploy Kubernetes operators" },
                decision_or_change: "Added custom CRD-based deployment controller",
            }));
        }

        const cal = await ctx.calibrationEar.calibrate();
        const drift = cal.signals.filter(s => s.signal_type === "dna_drift_warning");
        const valve = await ctx.calibrationEar.applySafetyValve(drift);

        expect(valve.entered_reevaluation).toBe(true);

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.reevaluation_mode).toBe(true);
    });

    it("Step 5: routing no longer modulated", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "webpack-v6",
            type: "architecture_decision",
            gravity: "G1",
            involves_complex_framework: true,
        });
        expect(routing.gravity).toBe("G1");
    });

    it("Step 6: manually exit reevaluation_mode (simulating human decision)", async () => {
        const identity = await ctx.dnaStore.loadIdentity();
        identity.reevaluation_mode = false;
        identity.traits["simplicity_bias"].confidence = 0.75;
        identity.traits["simplicity_bias"].drift_warning_count = 0;
        await ctx.dnaStore.saveIdentity(identity);

        const reloaded = await ctx.dnaStore.loadIdentity();
        expect(reloaded.reevaluation_mode).toBe(false);
    });

    it("Step 7: routing re-engages DNA modulation", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "graphql-federation",
            type: "architecture_decision",
            gravity: "G1",
            involves_complex_framework: true,
        });

        expect(routing.gravity).toBe("G2");
        expect(routing.governance).toBe("human_ratified");
    });

    it("Step 8: activation reflects active trait again", async () => {
        const result = await ctx.activationEngine.activate({ task: "work on api" });

        expect(result.dna.reevaluation_mode).toBeUndefined();
        expect(result.dna.relevant_traits.some(
            t => t.name === "simplicity_bias" && t.level === "high",
        )).toBe(true);
    });
});
