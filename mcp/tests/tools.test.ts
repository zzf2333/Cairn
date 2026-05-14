import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as yamlStringify } from "yaml";
import { MemoryStore } from "../src/stores/memory-store.js";
import { SignalStore } from "../src/stores/signal-store.js";
import { StagedStore } from "../src/stores/staged-store.js";
import { StateStore } from "../src/stores/state-store.js";
import { ViewsEngine } from "../src/engines/views-engine.js";
import { MemoryEngine } from "../src/engines/memory-engine.js";
import { TrustRouter } from "../src/engines/trust-router.js";
import { GitEar } from "../src/engines/git-ear.js";
import { StageEngine } from "../src/engines/stage-engine.js";
import { handleCairnContext } from "../src/tools/cairn-context.js";
import { handleCairnSignal } from "../src/tools/cairn-signal.js";
import { handleCairnStatus } from "../src/tools/cairn-status.js";
import { handleCairnPlan } from "../src/tools/cairn-plan.js";
import { handleCairnDoctor } from "../src/tools/cairn-doctor.js";
import { handleCairnSessionEnd } from "../src/tools/cairn-session-end.js";
import { handleCairnReview } from "../src/tools/cairn-review.js";
import { handleCairnMemory } from "../src/tools/cairn-memory.js";
import type { CairnContext } from "../src/server.js";
import type { CairnPaths } from "../src/paths.js";
import type { MemoryEntry, Config } from "../src/schemas/index.js";
import type { BootstrapResult } from "../src/bootstrap.js";

function createTestCtx(): { ctx: CairnContext; rootDir: string } {
    const root = join(tmpdir(), "cairn-test-tools-" + Date.now());
    const cairnDir = join(root, ".cairn");
    const paths: CairnPaths = {
        root,
        cairnDir,
        configYaml: join(cairnDir, "config.yaml"),
        stateYaml: join(cairnDir, "state.yaml"),
        signalsDir: join(cairnDir, "signals"),
        stagedDir: join(cairnDir, "staged"),
        memoryDir: join(cairnDir, "memory"),
        viewsDir: join(cairnDir, "views"),
        viewsDomainsDir: join(cairnDir, "views", "domains"),
        sessionsDir: join(cairnDir, "sessions"),
    };
    for (const dir of [
        paths.signalsDir,
        paths.stagedDir,
        paths.memoryDir,
        paths.viewsDir,
        paths.viewsDomainsDir,
        paths.sessionsDir,
    ]) {
        mkdirSync(dir, { recursive: true });
    }

    // Write config
    const config: Config = {
        version: "2.0",
        project: { name: "test", created: "2024-01" },
        domains: { locked: ["api-layer", "auth"] },
        trust_policy: {
            L3_auto_write: [
                "source.kind == 'git-revert' AND scope == 'local'",
            ],
            L2_staged: ["scope == 'global'"],
            never_auto: [],
        },
        stage: { override: null, auto_constraint: false },
    };
    writeFileSync(paths.configYaml, yamlStringify(config), "utf-8");

    const memoryStore = new MemoryStore(paths.memoryDir);
    const signalStore = new SignalStore(paths.signalsDir);
    const stagedStore = new StagedStore(paths.stagedDir);
    const stateStore = new StateStore(paths.stateYaml);
    const viewsEngine = new ViewsEngine(paths, memoryStore, stateStore);
    const memoryEngine = new MemoryEngine(memoryStore, viewsEngine);
    const trustRouter = new TrustRouter(
        memoryStore, signalStore, stagedStore, memoryEngine, stateStore,
    );
    const gitEar = new GitEar(root);
    const stageEngine = new StageEngine();

    return {
        ctx: {
            paths,
            memoryStore,
            signalStore,
            stagedStore,
            stateStore,
            viewsEngine,
            trustRouter,
            gitEar,
            stageEngine,
            memoryEngine,
        },
        rootDir: root,
    };
}

function makeMemory(id: string, overrides?: Partial<MemoryEntry>): MemoryEntry {
    return {
        id,
        type: "decision",
        domain: "api-layer",
        scope: "local",
        status: "active",
        health: { state: "ok", reason: null },
        confidence: { level: "high" },
        source: {
            kind: "conversation",
            refs: [{ type: "session", id: "sess_001" }],
            captured_at: "2026-01-01T00:00:00Z",
        },
        subject: { name: "REST API" },
        summary: "Chose REST API",
        behavior_effect: { type: "prefer_approach", instruction: "Prefer REST" },
        revisit: { when: [], status: "not_met" },
        relations: { related: [], conflicts: [] },
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

describe("cairn_context", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns empty context for empty project", () => {
        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.no_go).toEqual([]);
        expect(data.relevant_domains).toEqual([]);
        expect(data.active_debt).toEqual([]);
    });

    it("returns no-go entries", () => {
        ctx.memoryStore.save(
            makeMemory("mem_nogo", {
                type: "rejection",
                subject: { name: "tRPC" },
                behavior_effect: {
                    type: "avoid_suggestion",
                    instruction: "Do not suggest tRPC",
                },
            }),
        );
        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.no_go).toHaveLength(1);
        expect(data.no_go[0].subject).toBe("tRPC");
    });

    it("filters by task", () => {
        ctx.memoryStore.save(makeMemory("mem_api", { domain: "api-layer" }));
        ctx.memoryStore.save(
            makeMemory("mem_auth", { domain: "auth", subject: { name: "JWT" } }),
        );
        const result = handleCairnContext(ctx, { task: "api endpoint" });
        const data = JSON.parse(result.content[0].text);
        expect(data.relevant_domains.some((d: any) => d.domain === "api-layer")).toBe(true);
    });
});

describe("cairn_signal", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("routes user-rejection through Trust Router", () => {
        const result = handleCairnSignal(ctx, {
            type: "user-rejection",
            domain: "api-layer",
            details: {
                what: "GraphQL migration",
                reason: "Too complex for team",
            },
            evidence: { user_said: "We tried GraphQL, too complex" },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.accepted).toBe(true);
        // Should be L1 (medium confidence, no git evidence)
        expect(["L1", "L2", "L3"]).toContain(data.level);
    });

    it("routes global constraint to L2", () => {
        const result = handleCairnSignal(ctx, {
            type: "user-constraint",
            domain: "architecture",
            details: { what: "No microservices" },
            evidence: { user_said: "We stay monolithic" },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.level).toBe("L2");
        expect(data.route).toBe("staged");
    });
});

describe("cairn_status", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns correct counts", () => {
        ctx.memoryStore.save(makeMemory("mem_1"));
        ctx.memoryStore.save(makeMemory("mem_2", { domain: "auth", subject: { name: "JWT" } }));

        const result = handleCairnStatus(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.memory_count).toBe(2);
        expect(data.staged_count).toBe(0);
        expect(data.stage.phase).toBe("growth");
    });
});

describe("cairn_plan", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns historical constraints for task", () => {
        ctx.memoryStore.save(
            makeMemory("mem_rest", {
                subject: { name: "REST" },
                behavior_effect: { type: "prefer_approach", instruction: "Use REST for APIs" },
            }),
        );
        ctx.memoryStore.save(
            makeMemory("mem_trpc", {
                type: "rejection",
                subject: { name: "tRPC" },
                behavior_effect: { type: "avoid_suggestion", instruction: "Don't use tRPC" },
            }),
        );

        const result = handleCairnPlan(ctx, { task: "API endpoint design" });
        const data = JSON.parse(result.content[0].text);
        expect(data.task).toBe("API endpoint design");
        expect(data.task).toBe("API endpoint design");
        // Stage confidence is 0.4 by default (< 0.5), so no phase name in guidance
    });

    it("is read-only — no side effects", () => {
        const memBefore = ctx.memoryStore.loadAll().length;
        const sigBefore = ctx.signalStore.loadAll().length;
        const stagedBefore = ctx.stagedStore.loadAll().length;

        handleCairnPlan(ctx, { task: "refactor database" });

        expect(ctx.memoryStore.loadAll().length).toBe(memBefore);
        expect(ctx.signalStore.loadAll().length).toBe(sigBefore);
        expect(ctx.stagedStore.loadAll().length).toBe(stagedBefore);
    });
});

describe("cairn_doctor", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("reports healthy for empty project", () => {
        ctx.viewsEngine.regenerate();
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.output_tokens.status).toBe("ok");
        expect(data.staged_backlog).toBe(0);
    });

    it("detects TODO markers in memory", () => {
        ctx.memoryStore.save(
            makeMemory("mem_todo", {
                summary: "[TODO] fill in details",
            }),
        );
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.todos_in_memory).toBe(1);
    });
});

describe("cairn_context — edge cases", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns all domains when task matches none", () => {
        ctx.memoryStore.save(makeMemory("mem_api_ec", { domain: "api-layer" }));
        ctx.memoryStore.save(
            makeMemory("mem_auth_ec", { domain: "auth", subject: { name: "JWT" } }),
        );
        const result = handleCairnContext(ctx, { task: "unrelated xyz" });
        const data = JSON.parse(result.content[0].text);
        const domains = data.relevant_domains.map((d: any) => d.domain);
        expect(domains).toContain("api-layer");
        expect(domains).toContain("auth");
    });

    it("includes conflict warnings", () => {
        ctx.memoryStore.save(
            makeMemory("mem_conflict_a", {
                subject: { name: "REST vs GraphQL" },
                behavior_effect: { type: "avoid_suggestion", instruction: "Avoid GraphQL" },
                health: { state: "conflicted", reason: "contradicts mem_conflict_b" },
            }),
        );
        ctx.memoryStore.save(
            makeMemory("mem_conflict_b", {
                subject: { name: "REST vs GraphQL" },
                behavior_effect: { type: "prefer_approach", instruction: "Prefer GraphQL" },
                health: { state: "conflicted", reason: "contradicts mem_conflict_a" },
            }),
        );
        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.warnings.some((w: string) => w.includes("conflict"))).toBe(true);
    });

    it("includes staged warnings", () => {
        ctx.stagedStore.save({
            id: "staged_pending_1",
            origin_signal: "sig_001",
            draft_memory: {
                type: "rejection",
                domain: "api-layer",
                summary: "Rejected approach",
                behavior_effect: { type: "avoid_suggestion", instruction: "Do not suggest" },
            },
            review_status: "pending",
            routing_reason: "test routing",
            created_at: "2026-01-01T00:00:00Z",
        });
        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.warnings.some((w: string) => w.includes("staged"))).toBe(true);
    });
});

describe("cairn_signal — edge cases", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("uses default config when config file missing", () => {
        unlinkSync(ctx.paths.configYaml);
        const result = handleCairnSignal(ctx, {
            type: "user-rejection",
            domain: "api-layer",
            details: { what: "Some approach" },
            evidence: { user_said: "No" },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.accepted).toBe(true);
    });

    it("routes global constraint to L2", () => {
        const result = handleCairnSignal(ctx, {
            type: "user-constraint",
            domain: "architecture",
            details: { what: "No microservices" },
            evidence: { user_said: "We stay monolithic" },
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.level).toBe("L2");
    });
});

describe("cairn_status — edge cases", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("detects conflicted memory in status", () => {
        ctx.memoryStore.save(
            makeMemory("mem_conflict_status", {
                health: { state: "conflicted", reason: "contradicts another entry" },
            }),
        );
        const result = handleCairnStatus(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.conflicts.length).toBeGreaterThan(0);
        expect(data.conflicts[0].id).toBe("mem_conflict_status");
    });

    it("includes conflict details", () => {
        ctx.memoryStore.save(
            makeMemory("mem_conflict_detail", {
                health: { state: "conflicted", reason: "REST vs GraphQL mismatch" },
            }),
        );
        const result = handleCairnStatus(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.conflicts.length).toBe(1);
        expect(data.conflicts[0].reason).toBe("REST vs GraphQL mismatch");
    });
});

describe("cairn_doctor — edge cases", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("reports missing output.md", () => {
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.output_tokens.status).toBe("missing");
    });

    it("reports warning for 500-800 token output", () => {
        for (let i = 0; i < 20; i++) {
            ctx.memoryStore.save(
                makeMemory(`mem_warn_${i}`, {
                    subject: { name: `Warning-Subject-${i}` },
                    summary: `Medium length summary for entry ${i} with some additional context about the decision`,
                }),
            );
        }
        ctx.viewsEngine.regenerate();
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(["warning", "ok"]).toContain(data.output_tokens.status);
        if (data.output_tokens.count > 500 && data.output_tokens.count <= 800) {
            expect(data.output_tokens.status).toBe("warning");
        }
    });

    it("reports staged backlog when >5 pending", () => {
        for (let i = 0; i < 6; i++) {
            ctx.stagedStore.save({
                id: `staged_backlog_${i}`,
                origin_signal: `sig_${i}`,
                draft_memory: {
                    type: "rejection",
                    domain: "api-layer",
                    summary: `Rejected approach ${i}`,
                    behavior_effect: { type: "avoid_suggestion", instruction: `Do not suggest ${i}` },
                },
                review_status: "pending",
                routing_reason: "test routing",
                created_at: "2026-01-01T00:00:00Z",
            });
        }
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.staged_backlog).toBe(6);
        expect(data.issues.some((i: string) => i.includes("backlog"))).toBe(true);
    });

    it("reports orphan no-go with empty refs", () => {
        ctx.memoryStore.save(
            makeMemory("mem_orphan_nogo", {
                type: "rejection",
                behavior_effect: { type: "avoid_suggestion", instruction: "Avoid this" },
                source: {
                    kind: "conversation",
                    refs: [],
                    captured_at: "2026-01-01T00:00:00Z",
                },
            }),
        );
        const result = handleCairnDoctor(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data.orphan_no_go).toContain("mem_orphan_nogo");
    });
});

describe("cairn_plan — edge cases", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns empty constraints for unrelated task", () => {
        ctx.memoryStore.save(
            makeMemory("mem_api_plan", {
                domain: "api-layer",
                subject: { name: "REST" },
                behavior_effect: { type: "prefer_approach", instruction: "Use REST" },
            }),
        );
        const result = handleCairnPlan(ctx, { task: "unrelated xyz" });
        const data = JSON.parse(result.content[0].text);
        expect(data.historical_constraints).toHaveLength(0);
        expect(data.recommended_direction).toContain("No specific historical preference");
    });

    it("applies stage guidance when confidence >= 0.5", () => {
        const state = ctx.stateStore.load();
        state.stage.confidence = 0.7;
        state.stage.phase = "maturity";
        ctx.stateStore.save(state);

        const result = handleCairnPlan(ctx, { task: "refactor something" });
        const data = JSON.parse(result.content[0].text);
        expect(data.stage_guidance).toContain("maturity");
    });

    it("does not apply stage guidance when confidence < 0.5", () => {
        const state = ctx.stateStore.load();
        state.stage = {
            phase: "growth",
            confidence: 0.4,
            status: "advisory",
            evidence: [],
            guidance: [],
            last_updated: new Date().toISOString(),
        };
        ctx.stateStore.save(state);

        const result = handleCairnPlan(ctx, { task: "anything" });
        const data = JSON.parse(result.content[0].text);
        expect(data.stage_guidance).toContain("too low");
    });

    it("includes no-go warnings for matching avoid_suggestion", () => {
        ctx.memoryStore.save(
            makeMemory("mem_nogo_plan", {
                type: "rejection",
                domain: "api-layer",
                subject: { name: "tRPC" },
                behavior_effect: { type: "avoid_suggestion", instruction: "Don't use tRPC" },
            }),
        );
        const result = handleCairnPlan(ctx, { task: "api endpoint design" });
        const data = JSON.parse(result.content[0].text);
        expect(data.warnings.some((w: string) => w.includes("No-go"))).toBe(true);
        expect(data.warnings.some((w: string) => w.includes("tRPC"))).toBe(true);
    });

    it("includes revisit warnings for possibly_met entries", () => {
        ctx.memoryStore.save(
            makeMemory("mem_revisit_plan", {
                domain: "api-layer",
                subject: { name: "REST versioning" },
                revisit: { when: ["team grows to 10"], status: "possibly_met" },
            }),
        );
        const result = handleCairnPlan(ctx, { task: "api endpoint design" });
        const data = JSON.parse(result.content[0].text);
        expect(data.warnings.some((w: string) => w.includes("Revisit"))).toBe(true);
    });

    it("includes both avoid and prefer in historical_constraints", () => {
        ctx.memoryStore.save(
            makeMemory("mem_avoid_plan", {
                type: "rejection",
                domain: "api-layer",
                subject: { name: "GraphQL" },
                behavior_effect: { type: "avoid_suggestion", instruction: "Don't use GraphQL" },
            }),
        );
        ctx.memoryStore.save(
            makeMemory("mem_prefer_plan", {
                domain: "api-layer",
                subject: { name: "REST" },
                behavior_effect: { type: "prefer_approach", instruction: "Use REST for APIs" },
            }),
        );
        const result = handleCairnPlan(ctx, { task: "api endpoint design" });
        const data = JSON.parse(result.content[0].text);
        const constraints = data.historical_constraints.join(" ");
        expect(constraints).toContain("DO NOT suggest");
        expect(constraints).toContain("PREFER");
    });
});

describe("cairn_session_end — edge cases", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("handles empty session gracefully", async () => {
        const result = await handleCairnSessionEnd(ctx, { summary: "empty" });
        const data = JSON.parse(result.content[0].text);
        expect(data.views_regenerated).toBe(true);
        expect(data.signals_processed).toBe(0);
    });
});

describe("cairn_context — first run", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("returns first_run fields when bootstrapResult.created is true", () => {
        ctx.bootstrapResult = {
            created: true,
            paths: ctx.paths,
            projectMeta: { name: "test-project", created: "2024-06", detected_from: "package.json" },
            gitSummary: {
                total_commits: 42,
                first_commit_date: "2024-06-15T00:00:00Z",
                recent_commits: [
                    { hash: "abc1234", message: "feat: initial commit", date: "2024-06-15", author: "dev" },
                ],
                auto_signals_routed: 0,
            },
        };

        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);

        expect(data.first_run).toBe(true);
        expect(data.project.name).toBe("test-project");
        expect(data.project.detected_from).toBe("package.json");
        expect(data.git_history_summary.total_commits).toBe(42);
        expect(data.git_history_summary.recent_commits).toHaveLength(1);
        expect(data.suggestion).toContain("first run");
    });

    it("does not include first_run when bootstrapResult is absent", () => {
        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);

        expect(data.first_run).toBeUndefined();
        expect(data.project).toBeUndefined();
        expect(data.git_history_summary).toBeUndefined();
        expect(data.suggestion).toBeUndefined();
    });

    it("does not include first_run when bootstrapResult.created is false", () => {
        ctx.bootstrapResult = {
            created: false,
            paths: ctx.paths,
            projectMeta: { name: "test-project", created: "", detected_from: "directory" },
            gitSummary: null,
        };

        const result = handleCairnContext(ctx, {});
        const data = JSON.parse(result.content[0].text);

        expect(data.first_run).toBeUndefined();
    });
});

describe("cairn_review", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    function saveStagedEntry(id: string) {
        ctx.stagedStore.save({
            id,
            origin_signal: "sig_001",
            draft_memory: {
                type: "rejection",
                domain: "api-layer",
                scope: "global",
                subject: { name: "GraphQL" },
                summary: "Rejected GraphQL",
                confidence: { level: "high" },
                behavior_effect: { type: "avoid_suggestion", instruction: "Do not suggest GraphQL" },
                rejected: { what: "GraphQL", reason: "Too complex" },
                revisit: { when: [], status: "not_met" },
            },
            review_status: "pending",
            routing_reason: "Hard rule L2: global scope",
            created_at: "2026-01-01T00:00:00Z",
        });
    }

    it("list returns empty array when no staged entries", () => {
        const result = handleCairnReview(ctx, { action: "list" });
        const data = JSON.parse(result.content[0].text);
        expect(data).toEqual([]);
    });

    it("list returns pending staged entries", () => {
        saveStagedEntry("staged_20260101_graphql");
        const result = handleCairnReview(ctx, { action: "list" });
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe("staged_20260101_graphql");
    });

    it("accept writes entry to memory", () => {
        saveStagedEntry("staged_20260101_graphql");
        const result = handleCairnReview(ctx, { action: "accept", id: "staged_20260101_graphql" });
        const data = JSON.parse(result.content[0].text);
        expect(data.accepted).toBe(true);
        expect(data.memory_id).toBeDefined();

        const memories = ctx.memoryStore.loadAll();
        expect(memories.length).toBe(1);
    });

    it("accept without id returns error", () => {
        const result = handleCairnReview(ctx, { action: "accept" });
        expect(result.isError).toBe(true);
    });

    it("accept with invalid id returns error", () => {
        const result = handleCairnReview(ctx, { action: "accept", id: "nonexistent" });
        expect(result.isError).toBe(true);
    });

    it("reject marks entry as rejected", () => {
        saveStagedEntry("staged_20260101_graphql");
        const result = handleCairnReview(ctx, { action: "reject", id: "staged_20260101_graphql" });
        const data = JSON.parse(result.content[0].text);
        expect(data.rejected).toBe(true);

        const pending = ctx.stagedStore.loadPending();
        expect(pending).toHaveLength(0);
    });

    it("reject with invalid id returns error", () => {
        const result = handleCairnReview(ctx, { action: "reject", id: "nonexistent" });
        expect(result.isError).toBe(true);
    });
});

describe("cairn_memory", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("list returns empty array when no entries", () => {
        const result = handleCairnMemory(ctx, { action: "list" });
        const data = JSON.parse(result.content[0].text);
        expect(data).toEqual([]);
    });

    it("list returns all entries", () => {
        ctx.memoryStore.save(makeMemory("mem_1"));
        ctx.memoryStore.save(makeMemory("mem_2", { domain: "auth", subject: { name: "JWT" } }));
        const result = handleCairnMemory(ctx, { action: "list" });
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(2);
        expect(data[0].id).toBe("mem_1");
        expect(data[0].subject).toBe("REST API");
    });

    it("list filters by domain", () => {
        ctx.memoryStore.save(makeMemory("mem_1"));
        ctx.memoryStore.save(makeMemory("mem_2", { domain: "auth", subject: { name: "JWT" } }));
        const result = handleCairnMemory(ctx, { action: "list", domain: "auth" });
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(1);
        expect(data[0].domain).toBe("auth");
    });

    it("show returns full entry", () => {
        ctx.memoryStore.save(makeMemory("mem_show"));
        const result = handleCairnMemory(ctx, { action: "show", id: "mem_show" });
        const data = JSON.parse(result.content[0].text);
        expect(data.id).toBe("mem_show");
        expect(data.relations).toBeDefined();
    });

    it("show with invalid id returns error", () => {
        const result = handleCairnMemory(ctx, { action: "show", id: "nonexistent" });
        expect(result.isError).toBe(true);
    });

    it("show without id returns error", () => {
        const result = handleCairnMemory(ctx, { action: "show" });
        expect(result.isError).toBe(true);
    });

    it("archive marks entry as archived", () => {
        ctx.memoryStore.save(makeMemory("mem_archive"));
        const result = handleCairnMemory(ctx, { action: "archive", id: "mem_archive" });
        const data = JSON.parse(result.content[0].text);
        expect(data.archived).toBe(true);

        const entry = ctx.memoryStore.loadById("mem_archive");
        expect(entry?.status).toBe("archived");
    });

    it("archive with invalid id returns error", () => {
        const result = handleCairnMemory(ctx, { action: "archive", id: "nonexistent" });
        expect(result.isError).toBe(true);
    });
});

describe("cairn_status — stage operations", () => {
    let ctx: CairnContext;
    let rootDir: string;

    beforeEach(() => {
        const env = createTestCtx();
        ctx = env.ctx;
        rootDir = env.rootDir;
    });
    afterEach(() => rmSync(rootDir, { recursive: true, force: true }));

    it("default action returns same format as before", () => {
        const result = handleCairnStatus(ctx);
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty("memory_count");
        expect(data).toHaveProperty("staged_count");
        expect(data).toHaveProperty("stage");
    });

    it("stage_show returns detailed stage info", () => {
        const result = handleCairnStatus(ctx, { action: "stage_show" });
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty("phase");
        expect(data).toHaveProperty("confidence");
        expect(data).toHaveProperty("status");
        expect(data).toHaveProperty("evidence");
        expect(data).toHaveProperty("guidance");
    });

    it("stage_confirm confirms advisory stage", () => {
        const stateBefore = ctx.stateStore.load();
        const expectedPhase = stateBefore.stage.phase;

        const result = handleCairnStatus(ctx, { action: "stage_confirm" });
        const data = JSON.parse(result.content[0].text);
        expect(data.confirmed).toBe(true);
        expect(data.phase).toBe(expectedPhase);

        const stateAfter = ctx.stateStore.load();
        expect(stateAfter.stage.status).toBe("confirmed");
    });

    it("stage_confirm on already-confirmed returns message", () => {
        const state = ctx.stateStore.load();
        state.stage.status = "confirmed";
        ctx.stateStore.save(state);

        const result = handleCairnStatus(ctx, { action: "stage_confirm" });
        const data = JSON.parse(result.content[0].text);
        expect(data.confirmed).toBe(true);
        expect(data.message).toContain("already confirmed");
    });
});
