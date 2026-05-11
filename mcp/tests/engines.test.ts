import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../src/stores/memory-store.js";
import { SignalStore } from "../src/stores/signal-store.js";
import { StagedStore } from "../src/stores/staged-store.js";
import { StateStore } from "../src/stores/state-store.js";
import { ViewsEngine } from "../src/engines/views-engine.js";
import { MemoryEngine } from "../src/engines/memory-engine.js";
import { TrustRouter } from "../src/engines/trust-router.js";
import { StageEngine } from "../src/engines/stage-engine.js";
import type { MemoryEntry, Signal, Config } from "../src/schemas/index.js";
import type { CairnPaths } from "../src/paths.js";

function createTestEnv() {
    const root = join(tmpdir(), "cairn-test-engines-" + Date.now());
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

    const memoryStore = new MemoryStore(paths.memoryDir);
    const signalStore = new SignalStore(paths.signalsDir);
    const stagedStore = new StagedStore(paths.stagedDir);
    const stateStore = new StateStore(paths.stateYaml);
    const viewsEngine = new ViewsEngine(paths, memoryStore, stateStore);
    const memoryEngine = new MemoryEngine(memoryStore, viewsEngine);
    const trustRouter = new TrustRouter(
        memoryStore, signalStore, stagedStore, memoryEngine, stateStore,
    );

    return { root, paths, memoryStore, signalStore, stagedStore, stateStore, viewsEngine, memoryEngine, trustRouter };
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

const defaultConfig: Config = {
    version: "2.0",
    project: { name: "test", created: "2024-01" },
    domains: { locked: ["api-layer", "auth"] },
    trust_policy: {
        L3_auto_write: [
            "source.kind == 'git-revert' AND scope == 'local'",
            "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'",
        ],
        L2_staged: [
            "scope == 'global'",
            "type == 'transition' AND affects_output == true",
        ],
        never_auto: [],
    },
    stage: { override: null, auto_constraint: false },
};

describe("ViewsEngine", () => {
    let env: ReturnType<typeof createTestEnv>;

    beforeEach(() => { env = createTestEnv(); });
    afterEach(() => rmSync(env.root, { recursive: true, force: true }));

    it("generates output.md with no-go entries", () => {
        env.memoryStore.save(makeMemory("mem_nogo", {
            type: "rejection",
            subject: { name: "tRPC" },
            behavior_effect: { type: "avoid_suggestion", instruction: "Do not suggest tRPC" },
        }));
        env.viewsEngine.regenerate();

        const outputPath = join(env.paths.viewsDir, "output.md");
        expect(existsSync(outputPath)).toBe(true);
        const content = readFileSync(outputPath, "utf-8");
        expect(content).toContain("tRPC");
        expect(content).toContain("no-go");
    });

    it("generates domain views", () => {
        env.memoryStore.save(makeMemory("mem_api"));
        env.viewsEngine.regenerate();

        const domainPath = join(env.paths.viewsDomainsDir, "api-layer.md");
        expect(existsSync(domainPath)).toBe(true);
        const content = readFileSync(domainPath, "utf-8");
        expect(content).toContain("api-layer");
        expect(content).toContain("REST API");
    });

    it("generates stage.md", () => {
        env.viewsEngine.regenerate();
        const stagePath = join(env.paths.viewsDir, "stage.md");
        expect(existsSync(stagePath)).toBe(true);
        const content = readFileSync(stagePath, "utf-8");
        expect(content).toContain("growth");
    });
});

describe("MemoryEngine", () => {
    let env: ReturnType<typeof createTestEnv>;

    beforeEach(() => { env = createTestEnv(); });
    afterEach(() => rmSync(env.root, { recursive: true, force: true }));

    it("writes memory and regenerates views", () => {
        const entry = makeMemory("mem_write_test");
        env.memoryEngine.write(entry);

        expect(env.memoryStore.loadById("mem_write_test")).not.toBeNull();
        expect(existsSync(join(env.paths.viewsDir, "output.md"))).toBe(true);
    });

    it("merges duplicate entries", () => {
        const entry1 = makeMemory("mem_dup1", { subject: { name: "REST" } });
        const entry2 = makeMemory("mem_dup2", {
            subject: { name: "REST" },
            source: {
                kind: "conversation",
                refs: [{ type: "session", id: "sess_002" }],
                captured_at: "2026-02-01T00:00:00Z",
            },
        });

        env.memoryEngine.write(entry1);
        env.memoryEngine.write(entry2);

        // Should merge into first entry, not create second
        const all = env.memoryStore.loadAll();
        expect(all).toHaveLength(1);
        expect(all[0].source.refs).toHaveLength(2);
    });

    it("detects conflicts", () => {
        const avoid = makeMemory("mem_avoid", {
            domain: "testing",
            type: "rejection",
            subject: { name: "Jest" },
            behavior_effect: { type: "avoid_suggestion", instruction: "avoid Jest" },
        });
        const prefer = makeMemory("mem_prefer", {
            domain: "testing",
            type: "decision",
            subject: { name: "Jest" },
            behavior_effect: { type: "prefer_approach", instruction: "prefer Jest" },
        });

        env.memoryEngine.write(avoid);
        env.memoryEngine.write(prefer);

        const conflicts = env.memoryStore.findConflicts();
        expect(conflicts.length).toBeGreaterThan(0);
    });

    it("archives a memory entry", () => {
        env.memoryStore.save(makeMemory("mem_archive"));
        const result = env.memoryEngine.archive("mem_archive");
        expect(result).toBe(true);
        const entry = env.memoryStore.loadById("mem_archive");
        expect(entry!.status).toBe("archived");
    });
});

describe("TrustRouter", () => {
    let env: ReturnType<typeof createTestEnv>;

    beforeEach(() => { env = createTestEnv(); });
    afterEach(() => rmSync(env.root, { recursive: true, force: true }));

    it("routes global scope to L2", () => {
        const signal: Signal = {
            id: "sig_global",
            source_ear: "conversation",
            signal_type: "user-constraint",
            raw_data: { what: "No microservices", scope: "global", subject: "microservices" },
            inferred: { probable_domain: "architecture", confidence: "high" },
            captured_at: "2026-01-01T00:00:00Z",
        };
        const result = env.trustRouter.route(signal, defaultConfig);
        expect(result.level).toBe("L2");
        expect(result.route).toBe("staged");
    });

    it("routes stage-signal to L2 (hard rule)", () => {
        const signal: Signal = {
            id: "sig_stage",
            source_ear: "git",
            signal_type: "stage-signal",
            raw_data: { subject: "frequency" },
            inferred: { confidence: "medium" },
            captured_at: "2026-01-01T00:00:00Z",
        };
        const result = env.trustRouter.route(signal, defaultConfig);
        expect(result.level).toBe("L2");
    });

    it("routes git-revert with local scope to L3", () => {
        const signal: Signal = {
            id: "sig_revert",
            source_ear: "git",
            signal_type: "revert",
            raw_data: { what: "Reverted tRPC", scope: "local", subject: "tRPC-revert" },
            inferred: {
                probable_type: "rejection",
                probable_domain: "api-layer",
                confidence: "high",
            },
            captured_at: "2026-01-01T00:00:00Z",
        };
        const result = env.trustRouter.route(signal, defaultConfig);
        expect(result.level).toBe("L3");
        expect(result.route).toBe("memory");
    });

    it("drops low confidence signals", () => {
        const signal: Signal = {
            id: "sig_low",
            source_ear: "conversation",
            signal_type: "historical-reference",
            raw_data: { what: "Something vague", subject: "vague" },
            inferred: { confidence: "low" },
            captured_at: "2026-01-01T00:00:00Z",
        };
        const result = env.trustRouter.route(signal, defaultConfig);
        expect(result.level).toBe("L0");
        expect(result.route).toBe("dropped");
    });

    it("saves medium confidence to L1", () => {
        const signal: Signal = {
            id: "sig_medium",
            source_ear: "conversation",
            signal_type: "decision",
            raw_data: { what: "Chose Prisma", subject: "Prisma-unique" },
            inferred: { probable_domain: "database", confidence: "medium" },
            captured_at: "2026-01-01T00:00:00Z",
        };
        const result = env.trustRouter.route(signal, defaultConfig);
        expect(result.level).toBe("L1");
        expect(result.route).toBe("signals");
    });

    it("L2 overrides L3 for global scope", () => {
        const signal: Signal = {
            id: "sig_global_revert",
            source_ear: "git",
            signal_type: "revert",
            raw_data: { what: "Reverted global thing", scope: "global", subject: "global-revert-unique" },
            inferred: {
                probable_type: "rejection",
                probable_domain: "architecture",
                confidence: "high",
            },
            captured_at: "2026-01-01T00:00:00Z",
        };
        const result = env.trustRouter.route(signal, defaultConfig);
        // Should be L2 because global scope, even though revert would normally be L3
        expect(result.level).toBe("L2");
        expect(result.route).toBe("staged");
    });

    it("merges duplicate into existing memory", () => {
        // Pre-existing memory
        env.memoryStore.save(makeMemory("mem_existing", {
            subject: { name: "REST API" },
            domain: "api-layer",
            type: "decision",
        }));

        const signal: Signal = {
            id: "sig_dup",
            source_ear: "conversation",
            signal_type: "decision",
            raw_data: { what: "REST API", subject: "REST API" },
            inferred: { probable_type: "decision", probable_domain: "api-layer", confidence: "high" },
            captured_at: "2026-02-01T00:00:00Z",
        };

        const result = env.trustRouter.route(signal, defaultConfig);
        expect(result.level).toBe("L0");
        expect(result.reason).toContain("Merged");
    });
});

describe("StageEngine", () => {
    const engine = new StageEngine();

    it("infers exploration for young project with high dep changes", () => {
        const result = engine.inferStage({
            projectAgeMonths: 3,
            commitTrend: 1.5,
            dependencyChangeRate: 0.5,
            newFileRatio: 0.6,
        });
        expect(result.phase).toBe("exploration");
        expect(result.confidence).toBe(0.6);
        expect(result.status).toBe("advisory");
    });

    it("infers growth for active project with stable deps", () => {
        const result = engine.inferStage({
            projectAgeMonths: 12,
            commitTrend: 1.5,
            dependencyChangeRate: 0.1,
            newFileRatio: 0.3,
        });
        expect(result.phase).toBe("growth");
        expect(result.confidence).toBe(0.65);
    });

    it("infers maturity for old stable project", () => {
        const result = engine.inferStage({
            projectAgeMonths: 24,
            commitTrend: 0.8,
            dependencyChangeRate: 0.05,
            newFileRatio: 0.1,
        });
        expect(result.phase).toBe("maturity");
    });

    it("infers maintenance for old low-activity project", () => {
        const result = engine.inferStage({
            projectAgeMonths: 30,
            commitTrend: 0.3,
            dependencyChangeRate: 0.02,
            newFileRatio: 0.05,
        });
        expect(result.phase).toBe("maintenance");
    });

    it("defaults to growth with low confidence", () => {
        const result = engine.inferStage({
            projectAgeMonths: 10,
            commitTrend: 1.0,
            dependencyChangeRate: 0.2,
            newFileRatio: 0.3,
        });
        expect(result.phase).toBe("growth");
        expect(result.confidence).toBe(0.4);
    });
});
