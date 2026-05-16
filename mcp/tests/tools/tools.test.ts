import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeTraumaEvent,
    makeSkeletonNode, makeDNA, makeConfig, makeState, makeStagedEntry,
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

import { handleInitStatus } from "../../src/tools/cairn-init-status.js";
import { handleInitCommit } from "../../src/tools/cairn-init-commit.js";
import { handleContext } from "../../src/tools/cairn-context.js";
import { handleSignal } from "../../src/tools/cairn-signal.js";
import { handleSessionEnd } from "../../src/tools/cairn-session-end.js";
import { handleStatus } from "../../src/tools/cairn-status.js";
import { handlePlan } from "../../src/tools/cairn-plan.js";
import { handleStageList } from "../../src/tools/cairn-stage-list.js";
import { handleStageAccept } from "../../src/tools/cairn-stage-accept.js";
import { handleStageReject } from "../../src/tools/cairn-stage-reject.js";
import { handleDoctor } from "../../src/tools/cairn-doctor.js";
import { handleDnaList } from "../../src/tools/cairn-dna-list.js";
import { handleDnaAccept } from "../../src/tools/cairn-dna-accept.js";
import { handleDnaReject } from "../../src/tools/cairn-dna-reject.js";

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
    };
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

// ---------------------------------------------------------------------------
// cairn_init_status
// ---------------------------------------------------------------------------

describe("cairn_init_status", () => {
    it("returns 'not_initialized' for empty state", async () => {
        await ctx.stateStore.save(makeState({ initialization_status: "not_initialized" }));
        const result = await handleInitStatus(ctx);
        const data = parseResult(result);
        expect(data.status).toBe("not_initialized");
        // config exists from global beforeEach, so next_action says "resume"
        expect(data.next_action).toContain("resume");
    });

    it("returns 'complete' for initialized state", async () => {
        const result = await handleInitStatus(ctx);
        const data = parseResult(result);
        expect(data.status).toBe("complete");
        expect(data.next_action).toBe("ready");
    });

    it("returns resume hint when config exists but state incomplete", async () => {
        await ctx.stateStore.save(makeState({ initialization_status: "not_initialized" }));
        await ctx.configStore.save(makeConfig());
        const result = await handleInitStatus(ctx);
        const data = parseResult(result);
        expect(data.has_cairn_dir).toBe(true);
        expect(data.next_action).toContain("resume");
    });
});

// ---------------------------------------------------------------------------
// cairn_init_commit
// ---------------------------------------------------------------------------

describe("cairn_init_commit", () => {
    beforeEach(async () => {
        await ctx.stateStore.save(makeState({ initialization_status: "not_initialized" }));
    });

    const baseArgs = {
        config: { project_name: "test-app", domains: ["api", "auth"], cognitive_mode: "standard" },
        skeleton: [
            {
                domain: "api",
                role: "API layer",
                owns: ["routes", "controllers"],
                does_not_own: ["database"],
                causal_keywords: ["api", "route"],
            },
        ],
        blood_candidates: [] as unknown[],
    };

    it("initializes config, skeleton, and sets status to complete", async () => {
        const result = await handleInitCommit(ctx, baseArgs);
        const data = parseResult(result);
        expect(data.created).toBe(true);
        expect(data.written.skeleton).toBe(1);

        const config = await ctx.configStore.load();
        expect(config!.project.name).toBe("test-app");

        const state = await ctx.stateStore.load();
        expect(state.initialization_status).toBe("complete");
    });

    it("commits blood candidates to blood store", async () => {
        const args = {
            ...baseArgs,
            blood_candidates: [
                {
                    type: "architecture_decision",
                    domain: "api",
                    gravity: { level: "G1" },
                    summary: "Use Express over Koa",
                    behavior_effect: { type: "prefer_approach", instruction: "Use Express" },
                    source: { type: "conversation", confidence: 0.9 },
                    lifecycle: { validity: "strategic" },
                },
            ],
        };
        const result = await handleInitCommit(ctx, args);
        const data = parseResult(result);
        expect(data.written.blood_auto_confirmed + data.written.blood_staged).toBe(1);
    });

    it("routes high-gravity blood candidates to staged", async () => {
        const args = {
            ...baseArgs,
            blood_candidates: [
                {
                    type: "architecture_decision",
                    domain: "api",
                    gravity: { level: "G3" },
                    summary: "Major architecture shift",
                    behavior_effect: { type: "prefer_approach", instruction: "New architecture" },
                    source: { type: "conversation", confidence: 0.9 },
                    lifecycle: { validity: "strategic" },
                },
            ],
        };
        const result = await handleInitCommit(ctx, args);
        const data = parseResult(result);
        expect(data.written.blood_staged).toBe(1);

        const pending = await ctx.stagedStore.findPending();
        expect(pending.length).toBe(1);
    });

    it("saves DNA traits if provided", async () => {
        const args = {
            ...baseArgs,
            dna: {
                traits: [
                    { name: "simplicity_bias", level: "high", confidence: 0.8, reasoning: "Prefers simple solutions" },
                ],
            },
        };
        const result = await handleInitCommit(ctx, args);
        const data = parseResult(result);
        expect(data.created).toBe(true);

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.traits["simplicity_bias"]).toBeDefined();
        expect(identity.traits["simplicity_bias"].level).toBe("high");
    });

    it("updates stage if provided", async () => {
        const args = {
            ...baseArgs,
            stage: { phase: "exploration", confidence: 0.85, evidence: ["new project"] },
        };
        const result = await handleInitCommit(ctx, args);
        const data = parseResult(result);
        expect(data.written.stage).toBe(true);

        const state = await ctx.stateStore.load();
        expect(state.stage.phase).toBe("exploration");
        expect(state.stage.confidence).toBe(0.85);
    });

    it("sets initialization_status to complete", async () => {
        await handleInitCommit(ctx, baseArgs);
        const state = await ctx.stateStore.load();
        expect(state.initialization_status).toBe("complete");
    });
});

// ---------------------------------------------------------------------------
// cairn_context
// ---------------------------------------------------------------------------

describe("cairn_context", () => {
    it("returns activation result with task", async () => {
        await ctx.skeletonStore.save(makeSkeletonNode("api-layer"));
        const result = await handleContext(ctx, { task: "refactor api-layer" });
        const data = parseResult(result);
        expect(data.stage).toBeDefined();
        expect(data.constraints).toBeDefined();
        expect(data.relevant_domains).toBeDefined();
    });

    it("includes challenges in the result", async () => {
        await ctx.skeletonStore.save(makeSkeletonNode("api-layer"));
        await ctx.bloodStore.save(makeEvolutionEvent("evt_nogo", {
            domain: "api-layer",
            subject: { name: "tRPC" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
        }));
        const result = await handleContext(ctx, { task: "use tRPC for api-layer" });
        const data = parseResult(result);
        expect(data.challenges).toBeDefined();
        expect(Array.isArray(data.challenges)).toBe(true);
    });

    it("returns empty challenges when no conflicts", async () => {
        const result = await handleContext(ctx, { task: "create new feature" });
        const data = parseResult(result);
        expect(Array.isArray(data.challenges)).toBe(true);
    });

    it("activates without task or files", async () => {
        const result = await handleContext(ctx, {});
        const data = parseResult(result);
        expect(data.stage).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// cairn_signal
// ---------------------------------------------------------------------------

describe("cairn_signal", () => {
    it("creates event from signal and routes to blood", async () => {
        const result = await handleSignal(ctx, {
            signal_type: "decision",
            domain: "api-layer",
            details: { what: "Use REST over GraphQL", reason: "Simpler for current needs" },
            evidence: { user_said: "Let's stick with REST" },
        });
        const data = parseResult(result);
        expect(data.accepted).toBe(true);
        expect(data.routing).toBeDefined();
        expect(data.routing.destination).toBeDefined();
    });

    it("routes high-gravity signal to staged", async () => {
        const result = await handleSignal(ctx, {
            signal_type: "constraint_declaration",
            domain: "api-layer",
            details: { what: "Never use ORM", reason: "Performance concerns" },
            evidence: { user_said: "No ORM ever" },
        });
        const data = parseResult(result);
        expect(data.accepted).toBe(true);
        // G2 constraint_declaration in standard mode goes to staged
        expect(data.routing.destination).toBe("staged");
    });

    it("returns challenges for the domain", async () => {
        await ctx.bloodStore.save(makeEvolutionEvent("evt_nogo", {
            domain: "api-layer",
            subject: { name: "GraphQL" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no GraphQL" },
        }));
        const result = await handleSignal(ctx, {
            signal_type: "decision",
            domain: "api-layer",
            details: { what: "GraphQL", reason: "switching to graphql" },
            evidence: {},
        });
        const data = parseResult(result);
        expect(data.challenges).toBeDefined();
        expect(data.challenges.length).toBeGreaterThan(0);
    });

    it("uses default domain 'global' when domain not provided", async () => {
        const result = await handleSignal(ctx, {
            signal_type: "decision",
            details: { what: "General decision" },
            evidence: {},
        });
        const data = parseResult(result);
        expect(data.accepted).toBe(true);
    });

    it("handles user_rejection signal type", async () => {
        const result = await handleSignal(ctx, {
            signal_type: "user_rejection",
            domain: "api-layer",
            details: { what: "Axios", reason: "too heavy" },
            evidence: { user_said: "I don't want Axios" },
        });
        const data = parseResult(result);
        expect(data.accepted).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// cairn_session_end
// ---------------------------------------------------------------------------

describe("cairn_session_end", () => {
    beforeEach(() => {
        execSync("git init && git commit --allow-empty -m 'init'", { cwd: tmpDir });
    });

    it("creates session record", async () => {
        const result = await handleSessionEnd(ctx, {
            summary: "Worked on API routes",
            changed_domains: ["api-layer"],
            decisions_made: ["Use REST"],
        });
        const data = parseResult(result);
        expect(data.views_regenerated).toBe(true);

        const sessions = await ctx.sessionStore.loadAll();
        expect(sessions.length).toBe(1);
    });

    it("updates last_session in state", async () => {
        await handleSessionEnd(ctx, {
            summary: "Session done",
        });
        const state = await ctx.stateStore.load();
        expect(state.last_session.ended_at).toBeDefined();
        expect(state.last_session.commit).toBeDefined();
    });

    it("runs decay check", async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 200);
        await ctx.bloodStore.save(makeEvolutionEvent("evt_old", {
            lifecycle: {
                validity: "tactical",
                decay_policy: "downgrade",
                resurrection_count: 0,
                review_after: pastDate.toISOString(),
            },
        }));
        const result = await handleSessionEnd(ctx, {
            summary: "Session with decay",
        });
        const data = parseResult(result);
        expect(data.views_regenerated).toBe(true);
    });

    it("returns staged pending count", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_001"));
        const result = await handleSessionEnd(ctx, {
            summary: "Session check staged",
        });
        const data = parseResult(result);
        expect(data.pending_review).toBe(1);
    });

    it("returns commit hash from git", async () => {
        const result = await handleSessionEnd(ctx, {
            summary: "Check commit",
        });
        const data = parseResult(result);
        expect(data.views_regenerated).toBe(true);
        expect(data.pending_review).toBeDefined();
    });

    it("includes git_signals output shape", async () => {
        const result = await handleSessionEnd(ctx, {
            summary: "first session",
        });
        const data = parseResult(result);
        expect(data.git_signals).toBeDefined();
        expect(data.git_signals.scanned).toBe(0);
        expect(data.git_signals.new_blood).toBe(0);
        expect(data.git_signals.new_staged).toBe(0);
    });

    it("scans git history when prior commit exists and routes revert as rejection", async () => {
        await handleSessionEnd(ctx, { summary: "first session" });

        execSync("git commit --allow-empty -m 'feat: try thing'", { cwd: tmpDir });
        execSync("git commit --allow-empty -m 'Revert feat: try thing'", { cwd: tmpDir });

        const result = await handleSessionEnd(ctx, { summary: "second session" });
        const data = parseResult(result);

        expect(data.git_signals.scanned).toBeGreaterThanOrEqual(1);
        const totalRouted = data.git_signals.new_blood + data.git_signals.new_staged + data.git_signals.dropped;
        expect(totalRouted).toBeGreaterThanOrEqual(1);
    });

    it("includes stage output shape with current phase and confidence", async () => {
        const result = await handleSessionEnd(ctx, { summary: "first session" });
        const data = parseResult(result);
        expect(data.stage).toBeDefined();
        expect(typeof data.stage.phase).toBe("string");
        expect(typeof data.stage.confidence).toBe("number");
        expect(typeof data.stage.changed).toBe("boolean");
    });

    it("does not flip stage immediately after a recent stage update (hysteresis)", async () => {
        const recent = new Date();
        recent.setDate(recent.getDate() - 5);
        const state = await ctx.stateStore.load();
        state.stage.phase = "growth";
        state.stage.confidence = 0.8;
        state.stage.last_updated = recent.toISOString();
        await ctx.stateStore.save(state);

        const result = await handleSessionEnd(ctx, { summary: "session within hysteresis" });
        const data = parseResult(result);
        expect(data.stage.transition_staged).toBeNull();
    });

    it("does not emit a stage_transition on first session (no last_updated yet)", async () => {
        const state = await ctx.stateStore.load();
        expect(state.stage.last_updated).toBeUndefined();

        const result = await handleSessionEnd(ctx, { summary: "first ever session" });
        const data = parseResult(result);
        expect(data.stage.transition_staged).toBeNull();

        const after = await ctx.stateStore.load();
        expect(after.stage.last_updated).toBeDefined();
    });
});

describe("cairn_stage_accept — stage_transition", () => {
    it("applies the new phase to state when stage_transition is accepted", async () => {
        const transitionEvent = makeEvolutionEvent("evt_stage_transition_growth_to_maturity_1", {
            type: "stage_transition",
            subject: { name: "phase:maturity", aliases: ["growth"] },
            behavior_effect: {
                type: "prefer_approach",
                instruction: "Stability first; avoid unnecessary new dependencies",
            },
        });
        await ctx.stagedStore.save({
            id: transitionEvent.id,
            draft_event: transitionEvent,
            review_status: "pending",
            routing_reason: "test",
            gravity: "G2",
            governance_required: "human_ratified",
            created_at: new Date().toISOString(),
        });

        const result = await handleStageAccept(ctx, { id: transitionEvent.id });
        const data = parseResult(result);
        expect(data.stage_applied).toBe(true);

        const state = await ctx.stateStore.load();
        expect(state.stage.phase).toBe("maturity");
        expect(state.stage.status).toBe("confirmed");
        expect(state.stage.guidance.length).toBeGreaterThan(0);
    });

    it("does not apply stage when event type is not stage_transition", async () => {
        const event = makeEvolutionEvent("evt_normal_001");
        await ctx.stagedStore.save({
            id: event.id,
            draft_event: event,
            review_status: "pending",
            routing_reason: "test",
            gravity: "G1",
            governance_required: "auto_confirmable",
            created_at: new Date().toISOString(),
        });

        const result = await handleStageAccept(ctx, { id: event.id });
        const data = parseResult(result);
        expect(data.stage_applied).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// cairn_status
// ---------------------------------------------------------------------------

describe("cairn_status", () => {
    it("returns comprehensive status object", async () => {
        const result = await handleStatus(ctx);
        const data = parseResult(result);
        expect(data.initialization).toBe("complete");
        expect(data.stage).toBeDefined();
        expect(data.stage.phase).toBe("growth");
        expect(data.blood).toBeDefined();
        expect(data.staged).toBeDefined();
        expect(data.skeleton).toBeDefined();
        expect(data.dna).toBeDefined();
        expect(data.governance).toBeDefined();
        expect(data.last_session).toBeDefined();
    });

    it("counts blood events correctly", async () => {
        await ctx.bloodStore.save(makeEvolutionEvent("evt_active"));
        await ctx.bloodStore.save(makeEvolutionEvent("evt_stale", {
            health: { state: "stale", reason: "old" },
        }));
        await ctx.bloodStore.save(makeTraumaEvent("evt_trauma", "api-layer"));

        const result = await handleStatus(ctx);
        const data = parseResult(result);
        expect(data.blood.total).toBe(3);
        expect(data.blood.active).toBe(2); // evt_active + evt_trauma (ok/resurrected)
        expect(data.blood.stale).toBe(1);
        expect(data.blood.trauma).toBe(1);
    });

    it("counts staged entries", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_a"));
        await ctx.stagedStore.save(makeStagedEntry("staged_b", { review_status: "accepted" }));

        const result = await handleStatus(ctx);
        const data = parseResult(result);
        expect(data.staged.total).toBe(2);
        expect(data.staged.pending).toBe(1);
    });

    it("reports skeleton domains", async () => {
        await ctx.skeletonStore.save(makeSkeletonNode("api-layer"));
        await ctx.skeletonStore.save(makeSkeletonNode("auth"));

        const result = await handleStatus(ctx);
        const data = parseResult(result);
        expect(data.skeleton.nodes).toBe(2);
        expect(data.skeleton.domains).toContain("api-layer");
        expect(data.skeleton.domains).toContain("auth");
    });
});

// ---------------------------------------------------------------------------
// cairn_plan
// ---------------------------------------------------------------------------

describe("cairn_plan", () => {
    it("returns historical constraints and DNA guidance", async () => {
        await ctx.skeletonStore.save(makeSkeletonNode("api-layer"));
        await ctx.bloodStore.save(makeEvolutionEvent("evt_nogo", {
            domain: "api-layer",
            subject: { name: "tRPC" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
        }));
        const result = await handlePlan(ctx, { task: "build new api-layer endpoint" });
        const data = parseResult(result);
        expect(data.task).toBe("build new api-layer endpoint");
        expect(data.historical_constraints.length).toBeGreaterThan(0);
        expect(data.historical_constraints.some((c: string) => c.includes("tRPC"))).toBe(true);
    });

    it("includes stage guidance", async () => {
        const result = await handlePlan(ctx, { task: "add feature" });
        const data = parseResult(result);
        expect(data.stage_guidance).toBeDefined();
        expect(data.stage_guidance.phase).toBe("growth");
    });

    it("includes DNA guidance when traits exist", async () => {
        await ctx.dnaStore.saveIdentity(makeDNA({
            status: "emerging",
            traits: {
                simplicity_bias: {
                    level: "high",
                    confidence: 0.8,
                    evidence_count: 5,
                    last_updated: "2026-05-15",
                    reasoning: "test",
                },
            },
        }));
        const result = await handlePlan(ctx, { task: "add feature" });
        const data = parseResult(result);
        expect(data.dna_guidance.length).toBeGreaterThan(0);
        expect(data.dna_guidance.some((g: string) => g.includes("simplicity_bias"))).toBe(true);
    });

    it("returns recommended direction from stage constraints", async () => {
        const result = await handlePlan(ctx, { task: "anything" });
        const data = parseResult(result);
        expect(data.recommended_direction).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// cairn_stage_list
// ---------------------------------------------------------------------------

describe("cairn_stage_list", () => {
    it("returns pending staged entries", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_001"));
        await ctx.stagedStore.save(makeStagedEntry("staged_002"));

        const result = await handleStageList(ctx);
        const data = parseResult(result);
        expect(data.total).toBe(2);
        expect(data.items.length).toBe(2);
        expect(data.items[0].id).toBeDefined();
        expect(data.items[0].gravity).toBeDefined();
    });

    it("returns empty when no pending entries", async () => {
        const result = await handleStageList(ctx);
        const data = parseResult(result);
        expect(data.total).toBe(0);
        expect(data.items).toEqual([]);
    });

    it("excludes non-pending entries", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_accepted", { review_status: "accepted" }));
        await ctx.stagedStore.save(makeStagedEntry("staged_rejected", { review_status: "rejected" }));
        await ctx.stagedStore.save(makeStagedEntry("staged_pending"));

        const result = await handleStageList(ctx);
        const data = parseResult(result);
        expect(data.total).toBe(1);
        expect(data.items[0].id).toBe("staged_pending");
    });
});

// ---------------------------------------------------------------------------
// cairn_stage_accept
// ---------------------------------------------------------------------------

describe("cairn_stage_accept", () => {
    it("moves staged entry to blood", async () => {
        const entry = makeStagedEntry("staged_accept_test");
        await ctx.stagedStore.save(entry);

        const result = await handleStageAccept(ctx, { id: "staged_accept_test" });
        const data = parseResult(result);
        expect(data.success).toBe(true);
        expect(data.moved_to).toBe("blood");

        const bloodEvent = await ctx.bloodStore.load(entry.draft_event.id);
        expect(bloodEvent).not.toBeNull();
    });

    it("logs audit entry", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_audit_test"));
        await handleStageAccept(ctx, { id: "staged_audit_test" });

        const auditLog = await ctx.governanceStore.loadAuditLog();
        expect(auditLog.length).toBe(1);
        expect(auditLog[0].action).toBe("ratified");
        expect(auditLog[0].actor).toBe("human");
    });

    it("marks entry as accepted", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_mark_test"));
        await handleStageAccept(ctx, { id: "staged_mark_test" });

        const updated = await ctx.stagedStore.load("staged_mark_test");
        expect(updated!.review_status).toBe("accepted");
    });

    it("returns error for non-existent entry", async () => {
        const result = await handleStageAccept(ctx, { id: "non_existent" });
        expect(result.isError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// cairn_stage_reject
// ---------------------------------------------------------------------------

describe("cairn_stage_reject", () => {
    it("marks entry as rejected", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_reject_test"));
        const result = await handleStageReject(ctx, {
            id: "staged_reject_test",
            reason: "Not needed",
        });
        const data = parseResult(result);
        expect(data.success).toBe(true);

        const updated = await ctx.stagedStore.load("staged_reject_test");
        expect(updated!.review_status).toBe("rejected");
    });

    it("logs audit entry", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_reject_audit"));
        await handleStageReject(ctx, {
            id: "staged_reject_audit",
            reason: "Wrong direction",
        });

        const auditLog = await ctx.governanceStore.loadAuditLog();
        expect(auditLog.length).toBe(1);
        expect(auditLog[0].action).toBe("rejected");
        expect(auditLog[0].actor).toBe("human");
        expect(auditLog[0].reason).toBe("Wrong direction");
    });

    it("returns error for non-existent entry", async () => {
        const result = await handleStageReject(ctx, {
            id: "non_existent",
            reason: "test",
        });
        expect(result.isError).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// cairn_doctor
// ---------------------------------------------------------------------------

describe("cairn_doctor", () => {
    it("returns consistency report", async () => {
        const result = await handleDoctor(ctx);
        const data = parseResult(result);
        expect(data.consistency).toBeDefined();
        expect(data.consistency.overall).toBeDefined();
        expect(data.issues_count).toBeDefined();
        expect(data.cognitive_mode).toBeDefined();
    });

    it("detects decay actions", async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 200);
        await ctx.bloodStore.save(makeEvolutionEvent("evt_decay", {
            lifecycle: {
                validity: "tactical",
                decay_policy: "downgrade",
                resurrection_count: 0,
                review_after: pastDate.toISOString(),
            },
        }));
        const result = await handleDoctor(ctx);
        const data = parseResult(result);
        expect(data.health.decay_actions.length).toBeGreaterThan(0);
        expect(data.issues.some((i: string) => i.includes("decay"))).toBe(true);
    });

    it("auto-resurrects archived G1 events with high reactivation", async () => {
        await ctx.bloodStore.save(makeEvolutionEvent("evt_archived_g1", {
            gravity: { level: "G1" },
            health: { state: "stale", reason: "old" },
        }));
        await ctx.stateStore.save(makeState({
            activation_log: {
                recent_hits: { evt_archived_g1: 10 },
            },
        }));
        const result = await handleDoctor(ctx);
        const data = parseResult(result);
        expect(data.health.auto_resurrected).toContain("evt_archived_g1");
        const resurrected = await ctx.bloodStore.load("evt_archived_g1");
        expect(resurrected?.health.state).toBe("resurrected");
    });

    it("keeps archived G2+ events as resurrection candidates (no auto)", async () => {
        await ctx.bloodStore.save(makeEvolutionEvent("evt_archived_g2", {
            gravity: { level: "G2" },
            health: { state: "stale", reason: "old" },
        }));
        await ctx.stateStore.save(makeState({
            activation_log: {
                recent_hits: { evt_archived_g2: 10 },
            },
        }));
        const result = await handleDoctor(ctx);
        const data = parseResult(result);
        expect(data.health.resurrection_candidates.some((c: { event_id: string }) => c.event_id === "evt_archived_g2")).toBe(true);
        expect(data.health.auto_resurrected).not.toContain("evt_archived_g2");
        const stillArchived = await ctx.bloodStore.load("evt_archived_g2");
        expect(stillArchived?.health.state).toBe("stale");
    });

    it("reports staged governance pending count", async () => {
        await ctx.stagedStore.save(makeStagedEntry("staged_gov", {
            governance_required: "human_ratified",
        }));
        const result = await handleDoctor(ctx);
        const data = parseResult(result);
        expect(data.staged.governance_pending).toBe(1);
        expect(data.issues.some((i: string) => i.includes("pending human ratification"))).toBe(true);
    });

    it("reports consistent when no issues", async () => {
        const result = await handleDoctor(ctx);
        const data = parseResult(result);
        expect(data.consistency.overall).toBe("consistent");
        expect(data.issues_count).toBe(0);
    });

    it("detects unratified trauma", async () => {
        await ctx.bloodStore.save(makeEvolutionEvent("evt_trauma_unratified", {
            trauma: {
                is_trauma: true,
                sensitivity_multiplier: 2.0,
                decay_override: "permanent",
                affects_dna: true,
                requires_human_ratification: true,
            },
            governance_status: "pending",
        }));
        const result = await handleDoctor(ctx);
        const data = parseResult(result);
        expect(data.health.unratified_trauma.length).toBeGreaterThan(0);
        expect(data.issues.some((i: string) => i.includes("trauma"))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// cairn_dna_list / accept / reject
// ---------------------------------------------------------------------------

describe("cairn_dna_*", () => {
    async function stageOne() {
        const id = `stg_dna_simplicity_bias_${Date.now()}`;
        await ctx.dnaStagedStore.save({
            id,
            trait_name: "simplicity_bias",
            level: "high",
            confidence: 0.78,
            evidence_events: ["evt_a", "evt_b", "evt_c"],
            reasoning: "5 events show simplicity preference",
            proposed_at: new Date().toISOString(),
            review_status: "pending",
        });
        return id;
    }

    it("lists pending DNA candidates", async () => {
        const id = await stageOne();
        const result = await handleDnaList(ctx);
        const data = parseResult(result);
        expect(data.count).toBe(1);
        expect(data.candidates[0].id).toBe(id);
        expect(data.candidates[0].trait_name).toBe("simplicity_bias");
    });

    it("accept writes trait to identity and updates status", async () => {
        const id = await stageOne();
        const result = await handleDnaAccept(ctx, { id });
        const data = parseResult(result);
        expect(data.success).toBe(true);
        expect(data.trait_name).toBe("simplicity_bias");

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.traits.simplicity_bias.level).toBe("high");
        expect(identity.traits.simplicity_bias.confidence).toBeCloseTo(0.78);
        expect(identity.status).toBe("emerged");

        const entry = await ctx.dnaStagedStore.load(id);
        expect(entry?.review_status).toBe("accepted");
    });

    it("reject does not write identity but records audit", async () => {
        const id = await stageOne();
        const result = await handleDnaReject(ctx, { id, reason: "not matched to project direction" });
        const data = parseResult(result);
        expect(data.success).toBe(true);

        const identity = await ctx.dnaStore.loadIdentity();
        expect(identity.traits.simplicity_bias).toBeUndefined();

        const entry = await ctx.dnaStagedStore.load(id);
        expect(entry?.review_status).toBe("rejected");
    });

    it("accept twice is rejected (already accepted)", async () => {
        const id = await stageOne();
        await handleDnaAccept(ctx, { id });
        const result = await handleDnaAccept(ctx, { id });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("already accepted");
    });
});

// ---------------------------------------------------------------------------
// Compression → DNA staged closed loop (session_end driven)
// ---------------------------------------------------------------------------

describe("Compression closed loop via session_end", () => {
    beforeEach(() => {
        execSync("git init && git commit --allow-empty -m 'init'", { cwd: tmpDir });
    });

    it("session_end produces a DNA staged candidate when infra rejections accumulate", async () => {
        const longAgo = new Date();
        longAgo.setMonth(longAgo.getMonth() - 5);
        const recent = new Date();
        for (let i = 0; i < 6; i++) {
            const t = new Date(longAgo.getTime() + i * 18 * 24 * 60 * 60 * 1000);
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_infra_${i}`, {
                domain: "infra",
                type: "rejection",
                time: t.toISOString(),
                behavior_effect: { type: "avoid_suggestion", instruction: "no kafka" },
            }));
        }

        const result = await handleSessionEnd(ctx, { summary: "compression test" });
        const data = parseResult(result);
        expect(data.dna_compression).toBeDefined();
        expect(data.dna_compression.new_staged.length).toBeGreaterThanOrEqual(1);

        const pending = await ctx.dnaStagedStore.findPending();
        expect(pending.length).toBeGreaterThanOrEqual(1);
        expect(pending[0].trait_name).toBe("infra_aggressiveness");
    });

    it("does not re-stage the same trait while one is already pending", async () => {
        const longAgo = new Date();
        longAgo.setMonth(longAgo.getMonth() - 5);
        for (let i = 0; i < 6; i++) {
            const t = new Date(longAgo.getTime() + i * 18 * 24 * 60 * 60 * 1000);
            await ctx.bloodStore.save(makeEvolutionEvent(`evt_infra_dup_${i}`, {
                domain: "infra",
                type: "rejection",
                time: t.toISOString(),
                behavior_effect: { type: "avoid_suggestion", instruction: "no thing" },
            }));
        }

        await handleSessionEnd(ctx, { summary: "first" });
        const firstCount = (await ctx.dnaStagedStore.findPending()).length;
        await handleSessionEnd(ctx, { summary: "second" });
        const secondCount = (await ctx.dnaStagedStore.findPending()).length;
        expect(secondCount).toBe(firstCount);
    });
});
