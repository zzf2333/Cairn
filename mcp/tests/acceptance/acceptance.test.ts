import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createTmpDir, cleanTmpDir, makeEvolutionEvent, makeTraumaEvent, makeSkeletonNode, makeConfig, makeState, makeStagedEntry } from "../test-helpers.js";
import { buildPaths } from "../../src/paths.js";
import { ALL_DIRS } from "../../src/paths.js";
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
import { bootstrapEmpty } from "../../src/bootstrap.js";
import { handleInitCommit } from "../../src/tools/cairn-init-commit.js";
import { handleSignal } from "../../src/tools/cairn-signal.js";
import { handleDoctor } from "../../src/tools/cairn-doctor.js";
import { handleStageAccept } from "../../src/tools/cairn-stage-accept.js";
import { handleStageReject } from "../../src/tools/cairn-stage-reject.js";

let tmpDir: string;
let paths: ReturnType<typeof buildPaths>;
let ctx: CairnContext;

function buildContext(p: ReturnType<typeof buildPaths>): CairnContext {
    const bloodStore = new BloodStore(p.blood);
    const skeletonStore = new SkeletonStore(p.skeleton);
    const dnaStore = new DnaStore(p.dnaIdentity, p.dnaImprint);
    const domainStore = new DomainStore(p.domains);
    const signalStore = new SignalStore(p.signalsGit, p.signalsCalibration, p.signalsConversation);
    const stagedStore = new StagedStore(p.staged);
    const stateStore = new StateStore(p.state);
    const configStore = new ConfigStore(p.config);
    const governanceStore = new GovernanceStore(p.governancePolicy, p.governanceAudit);
    const sessionStore = new SessionStore(p.sessions);
    const challengeEngine = new ChallengeEngine(bloodStore, skeletonStore, dnaStore);
    const activationEngine = new ActivationEngine(bloodStore, skeletonStore, dnaStore, domainStore, stateStore, challengeEngine);
    const stageEngine = new StageEngine();
    const decayEngine = new DecayEngine(bloodStore);
    const compressionEngine = new CompressionEngine(bloodStore);
    const resurrectionEngine = new ResurrectionEngine(bloodStore, stateStore);
    const consistencyEngine = new ConsistencyEngine(bloodStore, skeletonStore, dnaStore, stateStore);
    const governanceEngine = new GovernanceEngine(governanceStore, configStore);
    const trustRouter = new TrustRouter(bloodStore, dnaStore, governanceEngine);
    const viewsEngine = new ViewsEngine(bloodStore, skeletonStore, domainStore, dnaStore, stateStore, p.viewsOutput, p.viewsStage, p.viewsDomains);
    const bloodEngine = new BloodEngine(bloodStore, domainStore, viewsEngine);
    const gitEar = new GitEar(p.root, skeletonStore);
    const calibrationEar = new CalibrationEar(p.root, bloodStore, skeletonStore, domainStore, dnaStore);

    return {
        paths: p,
        bloodStore, skeletonStore, dnaStore, domainStore, signalStore, stagedStore, stateStore, configStore, governanceStore, sessionStore,
        activationEngine, challengeEngine, stageEngine, decayEngine, compressionEngine, resurrectionEngine, consistencyEngine, bloodEngine, viewsEngine, governanceEngine, trustRouter, gitEar, calibrationEar,
    };
}

beforeEach(async () => {
    tmpDir = await createTmpDir();
    paths = buildPaths(tmpDir);
    for (const dir of ALL_DIRS(paths)) {
        await mkdir(dir, { recursive: true });
    }
    execSync("git init && git commit --allow-empty -m 'init'", { cwd: tmpDir, stdio: "ignore" });
    await new ConfigStore(paths.config).save(makeConfig());
    await new StateStore(paths.state).save(makeState());
    ctx = buildContext(paths);
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("Acceptance: Architecture Success Criteria", () => {

    describe("Criterion 1: Users never hand-write cognition", () => {
        it("cairn_init_commit produces blood events from AI-generated candidates", async () => {
            const result = await handleInitCommit(ctx, {
                config: { project_name: "test", domains: ["api"], cognitive_mode: "standard" },
                skeleton: [{ domain: "api", role: "API layer", owns: ["endpoints"], does_not_own: ["db"], causal_keywords: ["api", "rest"] }],
                blood_candidates: [{
                    type: "architecture_decision",
                    domain: "api",
                    gravity: { level: "G1" },
                    summary: "Use Express for HTTP",
                    behavior_effect: { type: "prefer_approach", instruction: "Use Express" },
                    source: { type: "conversation", confidence: 0.9 },
                    lifecycle: { validity: "strategic" },
                }],
            });
            const json = JSON.parse(result.content[0].text);
            expect(json.created).toBe(true);
            expect(json.written.blood_auto_confirmed + json.written.blood_staged).toBeGreaterThan(0);
        });

        it("cairn_signal captures user decisions automatically", async () => {
            const result = await handleSignal(ctx, {
                signal_type: "decision",
                domain: "api",
                details: { what: "Use GraphQL instead of REST", reason: "Better for mobile clients" },
                evidence: { user_said: "Let's go with GraphQL" },
            });
            const json = JSON.parse(result.content[0].text);
            expect(json.accepted).toBe(true);
        });
    });

    describe("Criterion 2: AI suggestion quality improvement — no-go prevents repeat mistakes", () => {
        it("activation returns no-go constraints that block previously rejected paths", async () => {
            const evt = makeEvolutionEvent("evt_nogo", {
                domain: "api-layer",
                behavior_effect: { type: "avoid_suggestion", instruction: "Do not use tRPC" },
                subject: { name: "tRPC" },
            });
            await ctx.bloodStore.save(evt);
            await ctx.skeletonStore.save(makeSkeletonNode("api-layer"));
            await ctx.domainStore.ensureDir("api-layer");
            await ctx.bloodEngine.commit(evt);

            const activation = await ctx.activationEngine.activate({ task: "add new api endpoint" });
            const noGo = activation.constraints.no_go;
            expect(noGo.length).toBeGreaterThanOrEqual(1);
            expect(noGo.some(c => c.what.includes("tRPC") || c.reason.includes("tRPC"))).toBe(true);
        });
    });

    describe("Criterion 3: Cognition doesn't rot — consistency engine detects violations", () => {
        it("consistency engine detects contradictory constraints (avoid + prefer same subject)", async () => {
            await ctx.bloodStore.save(makeEvolutionEvent("evt_avoid", {
                domain: "api-layer",
                behavior_effect: { type: "avoid_suggestion", instruction: "avoid axios" },
                subject: { name: "axios" },
            }));
            await ctx.bloodStore.save(makeEvolutionEvent("evt_prefer", {
                id: "evt_prefer",
                domain: "api-layer",
                behavior_effect: { type: "prefer_approach", instruction: "use axios" },
                subject: { name: "axios" },
            }));

            const report = await ctx.consistencyEngine.runAll();
            expect(report.constraint_consistency.passed).toBe(false);
            expect(report.overall).toBe("violations");
        });
    });

    describe("Criterion 4: Portable cognition — .cairn/ is self-contained", () => {
        it("bootstrapEmpty creates complete .cairn directory structure", async () => {
            const freshTmp = await createTmpDir();
            await bootstrapEmpty(freshTmp);
            const freshPaths = buildPaths(freshTmp);

            const configExists = await new ConfigStore(freshPaths.config).exists();
            expect(configExists).toBe(true);

            const dirs = ALL_DIRS(freshPaths);
            for (const dir of dirs) {
                const entries = await readdir(dir).catch(() => null);
                expect(entries).not.toBeNull();
            }

            await cleanTmpDir(freshTmp);
        });

        it("all cognition state lives under .cairn/ with YAML files", async () => {
            await ctx.bloodStore.save(makeEvolutionEvent("evt_port"));
            await ctx.skeletonStore.save(makeSkeletonNode("api-layer"));

            const bloodFiles = await readdir(paths.blood);
            expect(bloodFiles.some(f => f.endsWith(".yaml"))).toBe(true);
            const skeletonFiles = await readdir(paths.skeleton);
            expect(skeletonFiles.some(f => f.endsWith(".yaml"))).toBe(true);
        });
    });

    describe("Criterion 5: Clear governance boundaries — high-gravity changes require human confirmation", () => {
        it("G3 events route to staged requiring human_ratified", async () => {
            const routing = await ctx.trustRouter.route({
                domain: "api",
                subject_name: "major-migration",
                type: "architecture_decision",
                gravity: "G3",
            });
            expect(routing.destination).toBe("staged");
            expect(routing.governance).toBe("human_ratified");
        });

        it("stage_accept logs audit and stage_reject logs audit", async () => {
            const staged = makeStagedEntry("stg_gov1", { governance_required: "human_ratified" });
            await ctx.stagedStore.save(staged);
            await handleStageAccept(ctx, { id: "stg_gov1" });

            const staged2 = makeStagedEntry("stg_gov2", { governance_required: "human_ratified" });
            await ctx.stagedStore.save(staged2);
            await handleStageReject(ctx, { id: "stg_gov2", reason: "not needed" });

            const audit = await ctx.governanceStore.loadAuditLog();
            expect(audit.length).toBe(2);
            expect(audit[0].action).toBe("ratified");
            expect(audit[1].action).toBe("rejected");
        });
    });

    describe("Criterion 6: Cognitive thermodynamics — six processes run continuously", () => {
        it("doctor runs decay, resurrection, and consistency in one call", async () => {
            const result = await handleDoctor(ctx);
            const json = JSON.parse(result.content[0].text);

            expect(json).toHaveProperty("consistency");
            expect(json).toHaveProperty("health");
            expect(json.health).toHaveProperty("decay_actions");
            expect(json.health).toHaveProperty("resurrection_candidates");
            expect(json).toHaveProperty("cognitive_mode");
        });

        it("session_end triggers decay check automatically", async () => {
            const oldEvent = makeEvolutionEvent("evt_old", {
                lifecycle: { validity: "tactical", decay_policy: "expire", review_after: "2020-01-01", resurrection_count: 0 },
            });
            await ctx.bloodStore.save(oldEvent);

            const { handleSessionEnd } = await import("../../src/tools/cairn-session-end.js");
            const result = await handleSessionEnd(ctx, {
                summary: "test session",
                changed_domains: [],
                decisions_made: [],
                unresolved: [],
            });
            const json = JSON.parse(result.content[0].text);
            expect(json.views_regenerated).toBe(true);
        });
    });

    describe("Criterion 7: Consistency is verifiable — cairn_doctor detects all 5 rules", () => {
        it("consistency engine covers all 5 rules", async () => {
            const report = await ctx.consistencyEngine.runAll();
            expect(report).toHaveProperty("dna_event_consistency");
            expect(report).toHaveProperty("no_go_support");
            expect(report).toHaveProperty("skeleton_reality");
            expect(report).toHaveProperty("archived_reactivation");
            expect(report).toHaveProperty("constraint_consistency");
            expect(report).toHaveProperty("overall");
        });

        it("detects stale no-go as violation", async () => {
            await ctx.bloodStore.save(makeEvolutionEvent("evt_stale_nogo", {
                behavior_effect: { type: "avoid_suggestion", instruction: "no X" },
                health: { state: "stale", reason: "old" },
            }));
            const report = await ctx.consistencyEngine.runAll();
            expect(report.no_go_support.passed).toBe(false);
        });
    });

    describe("Criterion 8: Trauma memory is effective — permanent sensitivity", () => {
        it("trauma events never decay", async () => {
            const trauma = makeTraumaEvent("evt_trauma1", "auth");
            await ctx.bloodStore.save(trauma);

            const decayActions = await ctx.decayEngine.checkDecay("standard");
            const traumaDecayed = decayActions.find(a => a.event_id === "evt_trauma1");
            expect(traumaDecayed).toBeUndefined();
        });

        it("trauma permanently increases domain challenge sensitivity", async () => {
            const trauma = makeTraumaEvent("evt_trauma2", "auth");
            await ctx.bloodStore.save(trauma);

            const challenges = await ctx.challengeEngine.detectConflicts({
                task: "change auth config",
                domain: "auth",
            });
            const traumaChallenge = challenges.find(c => c.trauma === true);
            expect(traumaChallenge).toBeDefined();
        });

        it("markTrauma upgrades gravity and sets permanent decay override", async () => {
            await ctx.bloodStore.save(makeEvolutionEvent("evt_pre_trauma", {
                gravity: { level: "G1" },
            }));
            const result = await ctx.bloodEngine.markTrauma("evt_pre_trauma");
            expect(result.trauma.is_trauma).toBe(true);
            expect(result.trauma.decay_override).toBe("permanent");
            expect(result.gravity.level).toBe("G2");
        });
    });

    describe("Criterion 9: Cognitive energy matching — cognitive_mode scales governance", () => {
        it("lightweight mode has higher gravity threshold for approval", async () => {
            await ctx.configStore.save(makeConfig({ cognitive_mode: "lightweight" }));
            const perm = await ctx.governanceEngine.checkPermission("G2", false, false, false, false);
            expect(["agent_proposed", "system_validated"]).toContain(perm);
        });

        it("institutional mode requires human_ratified for lower gravity", async () => {
            await ctx.configStore.save(makeConfig({ cognitive_mode: "institutional" }));
            const perm = await ctx.governanceEngine.checkPermission("G1", false, false, false, false);
            expect(perm).toBe("human_ratified");
        });

        it("standard mode requires human_ratified for G2+", async () => {
            await ctx.configStore.save(makeConfig({ cognitive_mode: "standard" }));
            const perm = await ctx.governanceEngine.checkPermission("G2", false, false, false, false);
            expect(perm).toBe("human_ratified");
        });
    });
});
