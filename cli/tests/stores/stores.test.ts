import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeTraumaEvent,
    makeSkeletonNode, makeDNA, makeConfig, makeState, makeStagedEntry,
} from "../test-helpers.js";
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
import { buildPaths } from "../../src/paths.js";

let tmpDir: string;
let paths: ReturnType<typeof buildPaths>;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    paths = buildPaths(tmpDir);
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("BloodStore", () => {
    let store: BloodStore;
    beforeEach(async () => {
        store = new BloodStore(paths.blood);
        await store.ensureDir();
    });

    it("saves and loads an event", async () => {
        const evt = makeEvolutionEvent("evt_001");
        await store.save(evt);
        const loaded = await store.load("evt_001");
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe("evt_001");
    });

    it("returns null for missing event", async () => {
        const result = await store.load("nonexistent");
        expect(result).toBeNull();
    });

    it("loads all events", async () => {
        await store.save(makeEvolutionEvent("evt_001"));
        await store.save(makeEvolutionEvent("evt_002"));
        const all = await store.loadAll();
        expect(all).toHaveLength(2);
    });

    it("finds by domain", async () => {
        await store.save(makeEvolutionEvent("evt_001", { domain: "auth" }));
        await store.save(makeEvolutionEvent("evt_002", { domain: "api" }));
        const auth = await store.findByDomain("auth");
        expect(auth).toHaveLength(1);
        expect(auth[0].domain).toBe("auth");
    });

    it("finds active events", async () => {
        await store.save(makeEvolutionEvent("evt_001", { health: { state: "ok", reason: null } }));
        await store.save(makeEvolutionEvent("evt_002", { health: { state: "stale", reason: "old" } }));
        const active = await store.findActive();
        expect(active).toHaveLength(1);
    });

    it("finds trauma events", async () => {
        await store.save(makeEvolutionEvent("evt_001"));
        await store.save(makeTraumaEvent("evt_002", "auth"));
        const traumas = await store.findTrauma();
        expect(traumas).toHaveLength(1);
        expect(traumas[0].trauma.is_trauma).toBe(true);
    });

    it("finds trauma events by domain", async () => {
        await store.save(makeTraumaEvent("evt_001", "auth"));
        await store.save(makeTraumaEvent("evt_002", "api"));
        const authTraumas = await store.findTrauma("auth");
        expect(authTraumas).toHaveLength(1);
    });

    it("finds duplicate", async () => {
        await store.save(makeEvolutionEvent("evt_001", {
            domain: "api",
            subject: { name: "Redis" },
            type: "architecture_decision",
        }));
        const dup = await store.findDuplicate("api", "Redis", "architecture_decision");
        expect(dup).not.toBeNull();
        const nodup = await store.findDuplicate("api", "Postgres", "architecture_decision");
        expect(nodup).toBeNull();
    });

    it("removes an event", async () => {
        await store.save(makeEvolutionEvent("evt_001"));
        await store.remove("evt_001");
        const result = await store.load("evt_001");
        expect(result).toBeNull();
    });
});

describe("SkeletonStore", () => {
    let store: SkeletonStore;
    beforeEach(async () => {
        store = new SkeletonStore(paths.skeleton);
        await store.ensureDir();
    });

    it("saves and loads a node", async () => {
        const node = makeSkeletonNode("api-layer");
        await store.save(node);
        const loaded = await store.load("api-layer");
        expect(loaded).not.toBeNull();
        expect(loaded!.domain).toBe("api-layer");
    });

    it("finds by keyword", async () => {
        await store.save(makeSkeletonNode("api-layer", { causal_keywords: ["api", "REST"] }));
        await store.save(makeSkeletonNode("auth", { causal_keywords: ["auth", "session"] }));
        const results = await store.findByKeyword("api");
        expect(results).toHaveLength(1);
        expect(results[0].domain).toBe("api-layer");
    });
});

describe("DnaStore", () => {
    let store: DnaStore;
    beforeEach(async () => {
        await mkdir(paths.dna, { recursive: true });
        store = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
    });

    it("returns default identity when file missing", async () => {
        const identity = await store.loadIdentity();
        expect(identity.status).toBe("not_yet_emerged");
        expect(identity.traits).toEqual({});
    });

    it("saves and loads identity", async () => {
        const dna = makeDNA({ status: "emerged" });
        await store.saveIdentity(dna);
        const loaded = await store.loadIdentity();
        expect(loaded.status).toBe("emerged");
    });

    it("returns null for missing imprint", async () => {
        const imprint = await store.loadImprint();
        expect(imprint).toBeNull();
    });
});

describe("DomainStore", () => {
    let store: DomainStore;
    beforeEach(async () => {
        store = new DomainStore(paths.domains);
    });

    it("creates domain directory and loads empty constraints", async () => {
        await store.ensureDir("auth");
        const constraints = await store.loadConstraints("auth");
        expect(constraints.constraints).toEqual([]);
    });

    it("saves and loads constraints", async () => {
        await store.ensureDir("auth");
        await store.saveConstraints({
            domain: "auth",
            constraints: [{ what: "no-JWT", reason: "too complex", source_event: "evt_001", gravity: "G2" }],
        });
        const loaded = await store.loadConstraints("auth");
        expect(loaded.constraints).toHaveLength(1);
    });

    it("lists domains", async () => {
        await store.ensureDir("auth");
        await store.ensureDir("api");
        const domains = await store.listDomains();
        expect(domains.sort()).toEqual(["api", "auth"]);
    });
});

describe("SignalStore", () => {
    let store: SignalStore;
    beforeEach(async () => {
        store = new SignalStore(paths.signalsGit, paths.signalsCalibration, paths.signalsConversation, paths.signalsProcessed);
        await store.ensureDirs();
    });

    it("saves and loads git signals", async () => {
        await store.saveGitSignal({
            id: "sig_git_001",
            signal_type: "revert",
            raw_data: {},
            inferred_gravity: "G2",
            confidence: 0.9,
            captured_at: "2026-05-15T10:00:00Z",
        });
        const signals = await store.loadAllGitSignals();
        expect(signals).toHaveLength(1);
        expect(signals[0].signal_type).toBe("revert");
    });

    it("clears processed signals", async () => {
        await store.saveGitSignal({
            id: "sig_git_001",
            signal_type: "revert",
            raw_data: {},
            inferred_gravity: "G2",
            confidence: 0.9,
            captured_at: "2026-05-15T10:00:00Z",
        });
        await store.clearProcessed(["sig_git_001"]);
        const signals = await store.loadAllGitSignals();
        expect(signals).toHaveLength(0);
    });

    it("archives processed signal records by month", async () => {
        await store.saveProcessedSignal({
            id: "proc_git_staged_sig_git_001",
            source: "git",
            signal_id: "sig_git_001",
            processed_at: "2026-05-15T10:00:00Z",
            outcome: "staged",
            event_id: "evt_git_001",
            reason: "test route",
            signal: {
                id: "sig_git_001",
                signal_type: "revert",
            },
        });

        const records = await store.loadAllProcessedSignals();
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
            id: "proc_git_staged_sig_git_001",
            source: "git",
            signal_id: "sig_git_001",
            outcome: "staged",
            event_id: "evt_git_001",
        });
    });
});

describe("StagedStore", () => {
    let store: StagedStore;
    beforeEach(async () => {
        store = new StagedStore(paths.staged);
        await store.ensureDir();
    });

    it("saves and loads staged entry", async () => {
        const entry = makeStagedEntry("staged_001");
        await store.save(entry);
        const loaded = await store.load("staged_001");
        expect(loaded).not.toBeNull();
    });

    it("finds pending entries", async () => {
        await store.save(makeStagedEntry("staged_001"));
        await store.save(makeStagedEntry("staged_002", { review_status: "accepted" }));
        const pending = await store.findPending();
        expect(pending).toHaveLength(1);
    });

    it("counts pending entries", async () => {
        await store.save(makeStagedEntry("staged_001"));
        await store.save(makeStagedEntry("staged_002", { review_status: "accepted" }));
        await store.save(makeStagedEntry("staged_003", { review_status: "rejected" }));
        const count = await store.count();
        expect(count).toBe(1);
    });
});

describe("StateStore", () => {
    let store: StateStore;
    beforeEach(async () => {
        await mkdir(paths.cairn, { recursive: true });
        store = new StateStore(paths.state);
    });

    it("returns default state when file missing", async () => {
        const state = await store.load();
        expect(state.initialization_status).toBe("not_initialized");
    });

    it("saves and loads state", async () => {
        const state = makeState();
        await store.save(state);
        const loaded = await store.load();
        expect(loaded.initialization_status).toBe("complete");
    });

    it("updates last session", async () => {
        await store.save(makeState());
        await store.updateLastSession("abc123", "2026-05-15T12:00:00Z");
        const loaded = await store.load();
        expect(loaded.last_session.commit).toBe("abc123");
        expect(loaded.last_session.ended_at).toBe("2026-05-15T12:00:00Z");
    });

    it("records activation", async () => {
        await store.save(makeState());
        await store.recordActivation("evt_001");
        await store.recordActivation("evt_001");
        const loaded = await store.load();
        expect(loaded.activation_log.recent_hits["evt_001"]).toBe(2);
    });
});

describe("ConfigStore", () => {
    let store: ConfigStore;
    beforeEach(async () => {
        await mkdir(paths.cairn, { recursive: true });
        store = new ConfigStore(paths.config);
    });

    it("returns null when file missing", async () => {
        const config = await store.load();
        expect(config).toBeNull();
    });

    it("saves and loads config", async () => {
        const config = makeConfig();
        await store.save(config);
        const loaded = await store.load();
        expect(loaded).not.toBeNull();
        expect(loaded!.version).toBe("3.0");
    });

    it("checks existence", async () => {
        expect(await store.exists()).toBe(false);
        await store.save(makeConfig());
        expect(await store.exists()).toBe(true);
    });
});

describe("GovernanceStore", () => {
    let store: GovernanceStore;
    beforeEach(async () => {
        store = new GovernanceStore(paths.governancePolicy, paths.governanceAudit);
        await store.ensureDir();
    });

    it("returns default policy when file missing", async () => {
        const policy = await store.loadPolicy();
        expect(policy.cognitive_mode).toBe("standard");
    });

    it("appends audit entries", async () => {
        await store.appendAudit({
            time: "2026-05-15T10:00:00Z",
            action: "ratified",
            target: "evt_001",
            actor: "human",
            reason: "approved",
        });
        await store.appendAudit({
            time: "2026-05-15T10:05:00Z",
            action: "rejected",
            target: "evt_002",
            actor: "human",
        });
        const log = await store.loadAuditLog();
        expect(log).toHaveLength(2);
        expect(log[0].action).toBe("ratified");
    });
});

describe("SessionStore", () => {
    let store: SessionStore;
    beforeEach(async () => {
        store = new SessionStore(paths.sessions);
        await store.ensureDir();
    });

    it("saves and loads a session", async () => {
        await store.save({
            id: "sess_001",
            started_at: "2026-05-15T10:00:00Z",
            ended_at: "2026-05-15T11:00:00Z",
            summary: "test session",
            signals_captured: 3,
            signals_routed: { G0: 1, G1: 1, G2: 1, G3: 0 },
            domains_touched: ["auth"],
            decisions_made: ["chose Redis"],
            unresolved: [],
        });
        const loaded = await store.load("sess_001");
        expect(loaded).not.toBeNull();
        expect(loaded!.summary).toBe("test session");
    });

    it("loads recent sessions", async () => {
        await store.save({
            id: "sess_001",
            started_at: "2026-05-14T10:00:00Z",
            ended_at: "2026-05-14T11:00:00Z",
            summary: "older",
            signals_captured: 0,
            signals_routed: { G0: 0, G1: 0, G2: 0, G3: 0 },
            domains_touched: [],
            decisions_made: [],
            unresolved: [],
        });
        await store.save({
            id: "sess_002",
            started_at: "2026-05-15T10:00:00Z",
            ended_at: "2026-05-15T11:00:00Z",
            summary: "newer",
            signals_captured: 0,
            signals_routed: { G0: 0, G1: 0, G2: 0, G3: 0 },
            domains_touched: [],
            decisions_made: [],
            unresolved: [],
        });
        const recent = await store.loadRecent(1);
        expect(recent).toHaveLength(1);
        expect(recent[0].id).toBe("sess_002");
    });
});
