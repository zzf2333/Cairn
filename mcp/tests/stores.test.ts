import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../src/stores/memory-store.js";
import { SignalStore } from "../src/stores/signal-store.js";
import { StagedStore } from "../src/stores/staged-store.js";
import { StateStore } from "../src/stores/state-store.js";
import type { MemoryEntry } from "../src/schemas/index.js";
import type { Signal } from "../src/schemas/signal.js";

const TEST_DIR = join(tmpdir(), "cairn-test-stores-" + Date.now());

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

describe("MemoryStore", () => {
    const dir = join(TEST_DIR, "memory");

    beforeEach(() => mkdirSync(dir, { recursive: true }));
    afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

    it("saves and loads a memory entry", () => {
        const store = new MemoryStore(dir);
        const entry = makeMemory("mem_test_001");
        store.save(entry);
        const loaded = store.loadById("mem_test_001");
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe("mem_test_001");
        expect(loaded!.type).toBe("decision");
    });

    it("loadAll returns all entries", () => {
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_001"));
        store.save(makeMemory("mem_002"));
        expect(store.loadAll()).toHaveLength(2);
    });

    it("removes an entry", () => {
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_to_remove"));
        expect(store.remove("mem_to_remove")).toBe(true);
        expect(store.loadById("mem_to_remove")).toBeNull();
    });

    it("findByDomain filters correctly", () => {
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_api", { domain: "api-layer" }));
        store.save(makeMemory("mem_auth", { domain: "auth" }));
        expect(store.findByDomain("api-layer")).toHaveLength(1);
        expect(store.findByDomain("auth")).toHaveLength(1);
    });

    it("findConflicts returns conflicted entries", () => {
        const store = new MemoryStore(dir);
        store.save(
            makeMemory("mem_conflict", {
                health: { state: "conflicted", reason: "test" },
            }),
        );
        store.save(makeMemory("mem_ok"));
        expect(store.findConflicts()).toHaveLength(1);
    });

    it("findDuplicate detects duplicates", () => {
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_dup", { subject: { name: "REST API" } }));
        const dup = store.findDuplicate("api-layer", "REST API", "decision");
        expect(dup).not.toBeNull();
        expect(dup!.id).toBe("mem_dup");
    });
});

describe("SignalStore", () => {
    const dir = join(TEST_DIR, "signals");

    beforeEach(() => mkdirSync(dir, { recursive: true }));
    afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

    it("saves and loads signals", () => {
        const store = new SignalStore(dir);
        const signal: Signal = {
            id: "sig_test_001",
            source_ear: "git",
            signal_type: "revert",
            raw_data: { commit: "abc123" },
            inferred: { confidence: "high" },
            captured_at: "2026-01-01T00:00:00Z",
        };
        store.save(signal);
        const all = store.loadAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("sig_test_001");
    });
});

describe("StagedStore", () => {
    const dir = join(TEST_DIR, "staged");

    beforeEach(() => mkdirSync(dir, { recursive: true }));
    afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

    it("saves and loads staged entries", () => {
        const store = new StagedStore(dir);
        store.save({
            id: "staged_001",
            origin_signal: "sig_001",
            draft_memory: {
                type: "rejection",
                domain: "api-layer",
                summary: "tRPC rejected",
                behavior_effect: { type: "avoid_suggestion", instruction: "Do not suggest tRPC" },
            },
            review_status: "pending",
            routing_reason: "test",
            created_at: "2026-01-01T00:00:00Z",
        });
        expect(store.loadPending()).toHaveLength(1);
    });

    it("accept converts to memory entry", () => {
        const store = new StagedStore(dir);
        store.save({
            id: "staged_accept",
            origin_signal: "sig_001",
            draft_memory: {
                type: "decision",
                domain: "auth",
                summary: "Chose JWT",
                behavior_effect: { type: "prefer_approach", instruction: "Prefer JWT" },
            },
            review_status: "pending",
            routing_reason: "test",
            created_at: "2026-01-01T00:00:00Z",
        });
        const memory = store.accept("staged_accept");
        expect(memory).not.toBeNull();
        expect(memory!.type).toBe("decision");
        expect(memory!.domain).toBe("auth");
    });
});

describe("StateStore", () => {
    const filepath = join(TEST_DIR, "state.yaml");

    beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
    afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

    it("returns defaults when file doesn't exist", () => {
        const store = new StateStore(filepath);
        const state = store.load();
        expect(state.last_session_commit).toBeNull();
        expect(state.stage.phase).toBe("growth");
    });

    it("saves and loads state", () => {
        const store = new StateStore(filepath);
        const state = store.load();
        state.last_session_commit = "abc123";
        store.save(state);
        const loaded = store.load();
        expect(loaded.last_session_commit).toBe("abc123");
    });

    it("updates stage", () => {
        const store = new StateStore(filepath);
        store.updateStage({
            phase: "maturity",
            confidence: 0.8,
            status: "confirmed",
            evidence: [],
            guidance: [],
            last_updated: "2026-01-01T00:00:00Z",
        });
        const state = store.load();
        expect(state.stage.phase).toBe("maturity");
        expect(state.stage.status).toBe("confirmed");
    });
});
