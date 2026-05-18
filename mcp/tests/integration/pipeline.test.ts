import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeTraumaEvent,
    makeSkeletonNode, makeConfig, makeState,
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

import { handleSignal } from "../../src/tools/cairn-signal.js";
import { handleSessionEnd } from "../../src/tools/cairn-session-end.js";
import { handleStageAccept } from "../../src/tools/cairn-stage-accept.js";

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

// ---------------------------------------------------------------------------
// Pipeline test 1: signal → staged → accept → blood → views
// ---------------------------------------------------------------------------

describe("Signal to views pipeline", () => {
    it("user_rejection flows through staged → accept → blood → views output", async () => {
        const signalResult = await handleSignal(ctx, {
            signal_type: "user_rejection",
            domain: "api-layer",
            details: { what: "GraphQL", reason: "Too complex for our use case" },
            evidence: { user_said: "No GraphQL" },
        });
        const signalData = parseResult(signalResult);
        expect(signalData.accepted).toBe(true);
        expect(signalData.routing.destination).toBe("staged");

        const staged = await ctx.stagedStore.loadAll();
        expect(staged.length).toBe(1);
        const entry = staged[0];
        expect(entry.draft_event.subject.name).toBe("GraphQL");
        expect(entry.draft_event.behavior_effect.type).toBe("avoid_suggestion");

        const acceptResult = await handleStageAccept(ctx, { id: entry.id });
        const acceptData = parseResult(acceptResult);
        expect(acceptData.success).toBe(true);
        expect(acceptData.moved_to).toBe("blood");

        const bloodEvents = await ctx.bloodStore.findActive();
        const graphqlEvent = bloodEvents.find(e => e.subject.name === "GraphQL");
        expect(graphqlEvent).toBeDefined();
        expect(graphqlEvent!.governance_status).toBe("ratified");
        expect(graphqlEvent!.behavior_effect.type).toBe("avoid_suggestion");

        const rejected = await ctx.domainStore.loadRejectedPaths("api-layer");
        expect(rejected.paths.some(p => p.path === "GraphQL")).toBe(true);

        const output = await readFile(ctx.paths.viewsOutput, "utf-8");
        expect(output).toContain("## No-Go");
        expect(output).toContain("GraphQL");

        const stagedAfter = await ctx.stagedStore.loadAll();
        expect(stagedAfter.length).toBe(0);

        const audit = await ctx.governanceStore.loadAuditLog();
        expect(audit.some(a => a.action === "ratified")).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Pipeline test 2: constraint_declaration → human_ratified → constraints capillary
// ---------------------------------------------------------------------------

describe("Constraint governance pipeline", () => {
    it("G2 constraint flows through human_ratified staging to constraints capillary", async () => {
        const signalResult = await handleSignal(ctx, {
            signal_type: "constraint_declaration",
            domain: "api-layer",
            details: { what: "REST only", reason: "Team mandate for consistency" },
            evidence: { user_said: "We mandate REST" },
        });
        const signalData = parseResult(signalResult);
        expect(signalData.accepted).toBe(true);
        expect(signalData.routing.destination).toBe("staged");
        expect(signalData.routing.governance).toBe("human_ratified");

        const staged = await ctx.stagedStore.findPending();
        expect(staged.length).toBe(1);
        expect(staged[0].governance_required).toBe("human_ratified");

        await handleStageAccept(ctx, { id: staged[0].id });

        const constraints = await ctx.domainStore.loadConstraints("api-layer");
        expect(constraints.constraints.some(c => c.what === "REST only")).toBe(true);

        const output = await readFile(ctx.paths.viewsOutput, "utf-8");
        expect(output).toContain("## Constraints");
        expect(output).toContain("REST only");
    });
});

// ---------------------------------------------------------------------------
// Pipeline test 3: multi-session compression → DNA staged candidates
// ---------------------------------------------------------------------------

describe("Compression to DNA pipeline", () => {
    beforeEach(() => {
        initTestRepo(tmpDir, { stdio: "ignore" });
    });

    it("accumulated infra rejections produce DNA candidate via session_end", async () => {
        await ctx.skeletonStore.save(makeSkeletonNode("infra"));
        await ctx.domainStore.ensureDir("infra");

        const longAgo = new Date();
        longAgo.setMonth(longAgo.getMonth() - 5);
        for (let i = 0; i < 6; i++) {
            const t = new Date(longAgo.getTime() + i * 18 * 24 * 60 * 60 * 1000);
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_infra_${i}`, {
                domain: "infra",
                type: "rejection",
                time: t.toISOString(),
                behavior_effect: { type: "avoid_suggestion", instruction: "no kafka" },
            }));
        }

        const result = await handleSessionEnd(ctx, { summary: "compression test session" });
        const data = parseResult(result);
        expect(data.dna_compression).toBeDefined();
        expect(data.dna_compression.new_staged.length).toBeGreaterThanOrEqual(1);

        const pending = await ctx.dnaStagedStore.findPending();
        expect(pending.length).toBeGreaterThanOrEqual(1);
        expect(pending.some(p => p.trait_name === "infra_aggressiveness")).toBe(true);

        const output = await readFile(ctx.paths.viewsOutput, "utf-8");
        expect(output).toContain("DNA Candidates");
        expect(output).toContain("infra_aggressiveness");
    });

    it("does not re-stage the same trait on subsequent session_end", async () => {
        const longAgo = new Date();
        longAgo.setMonth(longAgo.getMonth() - 5);
        for (let i = 0; i < 6; i++) {
            const t = new Date(longAgo.getTime() + i * 18 * 24 * 60 * 60 * 1000);
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_infra_idem_${i}`, {
                domain: "infra",
                type: "rejection",
                time: t.toISOString(),
                behavior_effect: { type: "avoid_suggestion", instruction: "no thing" },
            }));
        }

        await handleSessionEnd(ctx, { summary: "first session" });
        const firstCount = (await ctx.dnaStagedStore.findPending()).length;

        await handleSessionEnd(ctx, { summary: "second session" });
        const secondCount = (await ctx.dnaStagedStore.findPending()).length;
        expect(secondCount).toBe(firstCount);
    });
});

// ---------------------------------------------------------------------------
// Pipeline test 4: trauma lifecycle (gravity upgrade + challenge + decay immunity)
// ---------------------------------------------------------------------------

describe("Trauma lifecycle pipeline", () => {
    it("trauma event upgrades routing gravity and produces trauma challenges", async () => {
        await ctx.bloodStore.save(makeTraumaEvent("evt_trauma_auth", "api-layer"));

        const signalResult = await handleSignal(ctx, {
            signal_type: "decision",
            domain: "api-layer",
            details: { what: "api-layer", reason: "changing auth approach" },
            evidence: { user_said: "Let's change auth" },
        });
        const data = parseResult(signalResult);

        expect(data.routing.level).toBe("G3");
        expect(data.routing.destination).toBe("staged");
        expect(data.routing.governance).toBe("human_ratified");

        expect(data.challenges.length).toBeGreaterThan(0);
        const traumaChallenge = data.challenges.find(
            (c: { level: string; trauma?: boolean }) => c.trauma === true,
        );
        expect(traumaChallenge).toBeDefined();
    });

    it("trauma events are immune to decay", async () => {
        await ctx.bloodStore.save(makeTraumaEvent("evt_trauma_nodecay", "api-layer"));

        const actions = await ctx.decayEngine.checkDecay("standard");
        const traumaAction = actions.find(a => a.event_id === "evt_trauma_nodecay");
        expect(traumaAction).toBeUndefined();
    });
});
