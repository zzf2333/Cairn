import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeSkeletonNode, makeConfig, makeState,
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
import { handleObserve } from "../../src/tools/cairn-observe.js";

function parseResult(result: { content: Array<{ type: string; text: string }>; isError?: boolean }) {
    return JSON.parse(result.content[0].text);
}

let tmpDir: string;
let ctx: CairnContext;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    const paths = buildPaths(tmpDir);
    for (const dir of ALL_DIRS(paths)) {
        await mkdir(dir, { recursive: true });
    }

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

    ctx = {
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
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("cairn_observe", () => {
    it("routes G1 capture candidate to blood in standard mode", async () => {
        const result = await handleObserve(ctx, {
            summary: "Decided to use REST",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "Use REST over GraphQL", reason: "Simpler for current needs" },
                evidence: { user_said: "Let's use REST" },
                recommendation: "capture",
                recommendation_reason: "significant decision",
            }],
        });
        const data = parseResult(result);
        expect(data.observed).toBe(true);
        expect(data.captured).toBe(1);
        expect(data.skipped).toBe(0);
        expect(data.results[0].action_taken).toBe("blood");
        expect(data.results[0].routing.governance).toBeDefined();
    });

    it("skip candidates are reported but not stored", async () => {
        const result = await handleObserve(ctx, {
            summary: "Fixed a typo",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "Fixed typo in README" },
                evidence: {},
                recommendation: "skip",
                recommendation_reason: "routine fix, not signal-worthy",
            }],
        });
        const data = parseResult(result);
        expect(data.skipped).toBe(1);
        expect(data.captured).toBe(0);
        expect(data.results[0].action_taken).toBe("skipped_by_ai");

        const staged = await ctx.stagedStore.loadAll();
        expect(staged.length).toBe(0);
    });

    it("handles mixed capture and skip candidates", async () => {
        const result = await handleObserve(ctx, {
            summary: "Made architecture decision and fixed formatting",
            candidates: [
                {
                    signal_type: "decision",
                    domain: "api-layer",
                    details: { what: "Use middleware pattern" },
                    evidence: {},
                    recommendation: "capture",
                    recommendation_reason: "architecture decision",
                },
                {
                    signal_type: "decision",
                    details: { what: "Fixed lint errors" },
                    evidence: {},
                    recommendation: "skip",
                    recommendation_reason: "routine formatting",
                },
            ],
        });
        const data = parseResult(result);
        expect(data.total_candidates).toBe(2);
        expect(data.captured).toBe(1);
        expect(data.skipped).toBe(1);
    });

    it("routes G2 constraint to staged with human_ratified", async () => {
        const result = await handleObserve(ctx, {
            summary: "Declared REST constraint",
            candidates: [{
                signal_type: "constraint_declaration",
                domain: "api-layer",
                details: { what: "REST only", reason: "Team mandate" },
                evidence: { user_said: "We mandate REST" },
                recommendation: "capture",
                recommendation_reason: "explicit constraint",
            }],
        });
        const data = parseResult(result);
        expect(data.staged).toBe(1);
        expect(data.results[0].routing.governance).toBe("human_ratified");

        const staged = await ctx.stagedStore.findPending();
        expect(staged.length).toBe(1);
        expect(staged[0].governance_required).toBe("human_ratified");
    });

    it("merges duplicate candidates with existing blood", async () => {
        await ctx.bloodStore.save(makeEvolutionEvent("evt_existing", {
            domain: "api-layer",
            type: "architecture_decision",
            subject: { name: "Use REST over GraphQL" },
        }));

        const result = await handleObserve(ctx, {
            summary: "Re-confirmed REST decision",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "Use REST over GraphQL" },
                evidence: {},
                recommendation: "capture",
                recommendation_reason: "re-confirmed",
            }],
        });
        const data = parseResult(result);
        expect(data.results[0].action_taken).toBe("merged");
    });

    it("returns challenges when capture conflicts with no-go", async () => {
        await ctx.bloodStore.save(makeEvolutionEvent("evt_nogo", {
            domain: "api-layer",
            subject: { name: "GraphQL" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no GraphQL" },
        }));

        const result = await handleObserve(ctx, {
            summary: "Considering GraphQL",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "GraphQL", reason: "reconsidering" },
                evidence: {},
                recommendation: "capture",
                recommendation_reason: "potential direction change",
            }],
        });
        const data = parseResult(result);
        expect(data.results[0].challenges).toBeDefined();
        expect(data.results[0].challenges.length).toBeGreaterThan(0);
    });

    it("handles empty candidates array", async () => {
        const result = await handleObserve(ctx, {
            summary: "No notable decisions this round",
            candidates: [],
        });
        const data = parseResult(result);
        expect(data.observed).toBe(true);
        expect(data.total_candidates).toBe(0);
        expect(data.captured).toBe(0);
        expect(data.skipped).toBe(0);
    });

    it("all-skip batch reports safe to commit", async () => {
        const result = await handleObserve(ctx, {
            summary: "Only routine changes",
            candidates: [
                {
                    signal_type: "decision",
                    details: { what: "Minor refactor" },
                    evidence: {},
                    recommendation: "skip",
                    recommendation_reason: "not signal-worthy",
                },
                {
                    signal_type: "decision",
                    details: { what: "Updated docs" },
                    evidence: {},
                    recommendation: "skip",
                    recommendation_reason: "routine docs update",
                },
            ],
        });
        const data = parseResult(result);
        expect(data.staged).toBe(0);
        expect(data.instruction).toContain("Safe to proceed");
    });
});

describe("cairn_observe session integration", () => {
    it("increments signals_count when candidates are captured", async () => {
        await ctx.stateStore.startSession({ id: "obs_session" });
        await handleObserve(ctx, {
            summary: "Made a decision",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "Use REST" },
                evidence: { user_said: "REST" },
                recommendation: "capture",
                recommendation_reason: "significant",
            }],
        });
        const session = await ctx.stateStore.getActiveSession();
        expect(session!.signals_count).toBe(1);
    });

    it("does not increment signals_count when all skipped", async () => {
        await ctx.stateStore.startSession({ id: "obs_skip_session" });
        await handleObserve(ctx, {
            summary: "Routine changes",
            candidates: [{
                signal_type: "decision",
                details: { what: "Minor fix" },
                evidence: {},
                recommendation: "skip",
                recommendation_reason: "not worth it",
            }],
        });
        const session = await ctx.stateStore.getActiveSession();
        expect(session!.signals_count).toBe(0);
    });

    it("touches active_session last_touched_at on capture", async () => {
        await ctx.stateStore.startSession({ id: "obs_touch_session" });
        const state = await ctx.stateStore.load();
        state.active_session!.last_touched_at = "2020-01-01T00:00:00.000Z";
        await ctx.stateStore.save(state);

        await handleObserve(ctx, {
            summary: "Decision made",
            candidates: [{
                signal_type: "decision",
                domain: "api-layer",
                details: { what: "Use middleware" },
                evidence: {},
                recommendation: "capture",
                recommendation_reason: "architecture",
            }],
        });
        const session = await ctx.stateStore.getActiveSession();
        expect(session!.last_touched_at).not.toBe("2020-01-01T00:00:00.000Z");
    });
});
