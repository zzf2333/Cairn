import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeStagedEntry, makeConfig, makeState,
} from "../test-helpers.js";
import { buildPaths } from "../../src/paths.js";
import { BloodStore } from "../../src/stores/blood-store.js";
import { SkeletonStore } from "../../src/stores/skeleton-store.js";
import { DnaStore } from "../../src/stores/dna-store.js";
import { DomainStore } from "../../src/stores/domain-store.js";
import { SignalStore } from "../../src/stores/signal-store.js";
import { StagedStore } from "../../src/stores/staged-store.js";
import { StateStore } from "../../src/stores/state-store.js";
import { ConfigStore } from "../../src/stores/config-store.js";
import { GovernanceStore } from "../../src/stores/governance-store.js";
import { SessionStore } from "../../src/stores/session-store.js";
import { GovernanceEngine } from "../../src/engines/governance-engine.js";
import { TrustRouter } from "../../src/engines/trust-router.js";
import { BloodEngine } from "../../src/engines/blood-engine.js";
import { ViewsEngine } from "../../src/engines/views-engine.js";
import { ActivationEngine } from "../../src/engines/activation-engine.js";
import { ChallengeEngine } from "../../src/engines/challenge-engine.js";
import { ConsistencyEngine } from "../../src/engines/consistency-engine.js";
import { DecayEngine } from "../../src/engines/decay-engine.js";
import { ResurrectionEngine } from "../../src/engines/resurrection-engine.js";
import { type CairnContext } from "../../src/context.js";
import { handleStageList } from "../../src/tools/cairn-stage-list.js";
import { handleStageAccept } from "../../src/tools/cairn-stage-accept.js";
import { handleStageReject } from "../../src/tools/cairn-stage-reject.js";

let tmpDir: string;
let paths: ReturnType<typeof buildPaths>;
let ctx: CairnContext;

function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
    return JSON.parse(result.content[0].text);
}

beforeEach(async () => {
    tmpDir = await createTmpDir();
    paths = buildPaths(tmpDir);
    for (const dir of [paths.cairn, paths.blood, paths.skeleton, paths.dna,
        paths.domains, paths.staged, paths.signals, paths.signalsGit,
        paths.signalsCalibration, paths.signalsConversation,
        paths.governance, paths.views, paths.viewsDomains, paths.sessions]) {
        await mkdir(dir, { recursive: true });
    }

    const bloodStore = new BloodStore(paths.blood);
    const skeletonStore = new SkeletonStore(paths.skeleton);
    const dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
    const domainStore = new DomainStore(paths.domains);
    const signalStore = new SignalStore(paths.signalsGit, paths.signalsCalibration, paths.signalsConversation);
    const stagedStore = new StagedStore(paths.staged);
    const stateStore = new StateStore(paths.state);
    const configStore = new ConfigStore(paths.config);
    const governanceStore = new GovernanceStore(paths.governancePolicy, paths.governanceAudit);
    const sessionStore = new SessionStore(paths.sessions);

    await configStore.save(makeConfig());
    await stateStore.save(makeState());

    const governanceEngine = new GovernanceEngine(governanceStore, configStore);
    const trustRouter = new TrustRouter(bloodStore, dnaStore, governanceEngine);
    const viewsEngine = new ViewsEngine(
        bloodStore, skeletonStore, domainStore, dnaStore, stateStore,
        paths.viewsOutput, paths.viewsStage, paths.viewsDomains,
    );
    const bloodEngine = new BloodEngine(bloodStore, domainStore, viewsEngine);
    const activationEngine = new ActivationEngine(bloodStore, skeletonStore, dnaStore, domainStore, stateStore);
    const challengeEngine = new ChallengeEngine(bloodStore, skeletonStore, dnaStore);
    const consistencyEngine = new ConsistencyEngine(bloodStore, skeletonStore, dnaStore, stateStore);
    const decayEngine = new DecayEngine(bloodStore);
    const resurrectionEngine = new ResurrectionEngine(bloodStore, stateStore);
    const { StageEngine } = await import("../../src/engines/stage-engine.js");
    const stageEngine = new StageEngine();
    const { CompressionEngine } = await import("../../src/engines/compression-engine.js");
    const compressionEngine = new CompressionEngine(bloodStore);
    const { GitEar } = await import("../../src/engines/git-ear.js");
    const gitEar = new GitEar(paths.root, skeletonStore);
    const { CalibrationEar } = await import("../../src/engines/calibration-ear.js");
    const calibrationEar = new CalibrationEar(paths.root, bloodStore, skeletonStore, domainStore);

    ctx = {
        paths,
        bloodStore, skeletonStore, dnaStore, domainStore,
        signalStore, stagedStore, stateStore, configStore,
        governanceStore, sessionStore,
        activationEngine, challengeEngine, stageEngine,
        decayEngine, compressionEngine, resurrectionEngine,
        consistencyEngine, bloodEngine, viewsEngine,
        governanceEngine, trustRouter, gitEar, calibrationEar,
    };
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("Governance flow integration", () => {
    it("staged entry appears in stage_list", async () => {
        const entry = makeStagedEntry("staged_gov_001", {
            gravity: "G2",
            governance_required: "human_ratified",
        });
        await ctx.stagedStore.save(entry);

        const listResult = parseResult(await handleStageList(ctx)) as {
            items: Array<{ id: string; gravity: string }>;
            total: number;
        };

        expect(listResult.total).toBe(1);
        expect(listResult.items[0].id).toBe("staged_gov_001");
        expect(listResult.items[0].gravity).toBe("G2");
    });

    it("stage_accept moves entry to blood and logs audit", async () => {
        await ctx.domainStore.ensureDir("api-layer");

        const entry = makeStagedEntry("staged_gov_002", {
            gravity: "G2",
            governance_required: "human_ratified",
        });
        await ctx.stagedStore.save(entry);

        const acceptResult = parseResult(await handleStageAccept(ctx, { id: "staged_gov_002" })) as {
            success: boolean;
            moved_to: string;
            governance_logged: boolean;
        };

        expect(acceptResult.success).toBe(true);
        expect(acceptResult.moved_to).toBe("blood");
        expect(acceptResult.governance_logged).toBe(true);

        const bloodEvent = await ctx.bloodStore.load(entry.draft_event.id);
        expect(bloodEvent).not.toBeNull();

        const updatedEntry = await ctx.stagedStore.load("staged_gov_002");
        expect(updatedEntry!.review_status).toBe("accepted");

        const auditLog = await ctx.governanceStore.loadAuditLog();
        expect(auditLog.length).toBeGreaterThanOrEqual(1);
        const ratifyEntry = auditLog.find(a => a.action === "ratified");
        expect(ratifyEntry).toBeDefined();
        expect(ratifyEntry!.target).toBe(entry.draft_event.id);
    });

    it("stage_reject marks entry rejected and logs audit", async () => {
        const entry = makeStagedEntry("staged_gov_003", {
            gravity: "G2",
            governance_required: "human_ratified",
        });
        await ctx.stagedStore.save(entry);

        const rejectResult = parseResult(await handleStageReject(ctx, {
            id: "staged_gov_003",
            reason: "not needed",
        })) as {
            success: boolean;
            governance_logged: boolean;
        };

        expect(rejectResult.success).toBe(true);
        expect(rejectResult.governance_logged).toBe(true);

        const updatedEntry = await ctx.stagedStore.load("staged_gov_003");
        expect(updatedEntry!.review_status).toBe("rejected");

        const bloodEvent = await ctx.bloodStore.load(entry.draft_event.id);
        expect(bloodEvent).toBeNull();

        const auditLog = await ctx.governanceStore.loadAuditLog();
        const rejectEntry = auditLog.find(a => a.action === "rejected");
        expect(rejectEntry).toBeDefined();
        expect(rejectEntry!.reason).toBe("not needed");
    });

    it("governance audit trail has all entries after accept + reject", async () => {
        await ctx.domainStore.ensureDir("api-layer");

        const entry1 = makeStagedEntry("staged_gov_004", {
            gravity: "G2",
            governance_required: "human_ratified",
        });
        const entry2 = makeStagedEntry("staged_gov_005", {
            gravity: "G2",
            governance_required: "human_ratified",
        });
        await ctx.stagedStore.save(entry1);
        await ctx.stagedStore.save(entry2);

        await handleStageAccept(ctx, { id: "staged_gov_004" });
        await handleStageReject(ctx, { id: "staged_gov_005", reason: "not applicable" });

        const auditLog = await ctx.governanceStore.loadAuditLog();
        expect(auditLog.length).toBe(2);

        const actions = auditLog.map(a => a.action);
        expect(actions).toContain("ratified");
        expect(actions).toContain("rejected");
    });

    it("high-gravity signal routes to staged", async () => {
        const routing = await ctx.trustRouter.route({
            domain: "api-layer",
            subject_name: "major-arch-change",
            type: "architecture_decision",
            gravity: "G3",
        });

        expect(routing.destination).toBe("staged");
        expect(routing.governance).toBe("human_ratified");
    });
});
