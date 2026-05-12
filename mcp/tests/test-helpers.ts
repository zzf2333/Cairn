import { mkdirSync, writeFileSync } from "node:fs";
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
import type { CairnContext } from "../src/server.js";
import type { CairnPaths } from "../src/paths.js";
import type { MemoryEntry, Config, StagedEntry } from "../src/schemas/index.js";
import type { Signal } from "../src/schemas/signal.js";

export function makeMemory(id: string, overrides?: Partial<MemoryEntry>): MemoryEntry {
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

export function makeSignal(id: string, overrides?: Partial<Signal>): Signal {
    return {
        id,
        source_ear: "conversation",
        signal_type: "decision",
        raw_data: { what: "test", subject: "test-subject" },
        inferred: { probable_domain: "api-layer", confidence: "medium" },
        captured_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

export function makeStagedEntry(id: string, overrides?: Partial<StagedEntry>): StagedEntry {
    return {
        id,
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
        ...overrides,
    };
}

export const defaultConfig: Config = {
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

export function createTestPaths(prefix: string): { root: string; paths: CairnPaths } {
    const root = join(tmpdir(), `cairn-test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
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
    return { root, paths };
}

export interface CreateTestEnvOptions {
    configOverrides?: Partial<Config>;
    mockGitEar?: GitEar;
}

export function createTestEnv(options?: CreateTestEnvOptions): { ctx: CairnContext; root: string } {
    const { root, paths } = createTestPaths("env");
    for (const dir of [
        paths.signalsDir, paths.stagedDir, paths.memoryDir,
        paths.viewsDir, paths.viewsDomainsDir, paths.sessionsDir,
    ]) {
        mkdirSync(dir, { recursive: true });
    }

    const config: Config = { ...defaultConfig, ...options?.configOverrides };
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
    const gitEar = options?.mockGitEar ?? new GitEar(root);
    const stageEngine = new StageEngine();

    const ctx: CairnContext = {
        paths, memoryStore, signalStore, stagedStore, stateStore,
        viewsEngine, trustRouter, gitEar, stageEngine, memoryEngine,
    };

    return { ctx, root };
}

export function createMockGitEar(signals: Signal[] = [], head: string | null = "abc123") {
    return {
        scanSinceLastSession: async () => signals,
        getHeadCommit: async () => head,
    } as unknown as GitEar;
}
