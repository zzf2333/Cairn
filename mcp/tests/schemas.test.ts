import { describe, it, expect } from "vitest";
import {
    MemoryEntrySchema,
    SignalSchema,
    StagedEntrySchema,
    ConfigSchema,
    StageSnapshotSchema,
    SessionRecordSchema,
} from "../src/schemas/index.js";

describe("MemoryEntrySchema", () => {
    const validEntry = {
        id: "mem_2024_03_api_trpc_rejection",
        type: "rejection",
        domain: "api-layer",
        scope: "local",
        status: "active",
        health: { state: "ok", reason: null },
        confidence: { level: "high", score: 0.86, reason: "explicit rejection" },
        source: {
            kind: "git-revert",
            refs: [{ type: "commit", id: "a1b2c3d" }],
            captured_at: "2024-03-15T10:00:00Z",
        },
        subject: { name: "tRPC", category: "api-framework" },
        summary: "tRPC rejected after two-week trial",
        rejected: { what: "tRPC migration", reason: "REST client integration cost too high" },
        chosen: { what: "REST + OpenAPI", reason: "Fits current workflow" },
        behavior_effect: {
            type: "avoid_suggestion",
            instruction: "Do not suggest tRPC migration",
        },
        revisit: { when: ["All REST clients replaced"], status: "not_met" },
        relations: { related: ["mem_2024_03_api_openapi"], conflicts: [] },
        created_at: "2024-03-15T10:00:00Z",
        updated_at: "2024-03-15T10:00:00Z",
    };

    it("parses a valid entry", () => {
        const parsed = MemoryEntrySchema.parse(validEntry);
        expect(parsed.id).toBe("mem_2024_03_api_trpc_rejection");
        expect(parsed.type).toBe("rejection");
        expect(parsed.behavior_effect.type).toBe("avoid_suggestion");
    });

    it("applies defaults", () => {
        const minimal = {
            id: "mem_test",
            type: "decision",
            domain: "auth",
            source: {
                kind: "conversation",
                refs: [],
                captured_at: "2026-01-01T00:00:00Z",
            },
            subject: { name: "JWT" },
            summary: "Chose JWT",
            behavior_effect: { type: "prefer_approach", instruction: "Prefer JWT" },
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        };
        const parsed = MemoryEntrySchema.parse(minimal);
        expect(parsed.scope).toBe("local");
        expect(parsed.status).toBe("active");
        expect(parsed.health.state).toBe("ok");
        expect(parsed.revisit.status).toBe("not_met");
    });

    it("rejects invalid type", () => {
        const invalid = { ...validEntry, type: "invalid_type" };
        expect(() => MemoryEntrySchema.parse(invalid)).toThrow();
    });

    it("rejects invalid behavior_effect type", () => {
        const invalid = {
            ...validEntry,
            behavior_effect: { type: "invalid", instruction: "x" },
        };
        expect(() => MemoryEntrySchema.parse(invalid)).toThrow();
    });
});

describe("SignalSchema", () => {
    it("parses a valid signal", () => {
        const signal = {
            id: "sig_2026_05_11_001",
            source_ear: "git",
            signal_type: "dependency-removed",
            raw_data: { package: "tRPC" },
            inferred: { probable_type: "rejection", confidence: "high" },
            captured_at: "2026-05-11T08:00:00Z",
        };
        const parsed = SignalSchema.parse(signal);
        expect(parsed.source_ear).toBe("git");
        expect(parsed.signal_type).toBe("dependency-removed");
    });

    it("rejects invalid source_ear", () => {
        expect(() =>
            SignalSchema.parse({
                id: "sig_test",
                source_ear: "invalid",
                signal_type: "revert",
                captured_at: "2026-01-01T00:00:00Z",
            }),
        ).toThrow();
    });
});

describe("StagedEntrySchema", () => {
    it("parses a valid staged entry", () => {
        const staged = {
            id: "staged_2026_05_11_api_trpc",
            origin_signal: "sig_2026_05_11_001",
            draft_memory: {
                type: "rejection",
                domain: "api-layer",
                scope: "local",
                summary: "tRPC removed",
                behavior_effect: {
                    type: "avoid_suggestion",
                    instruction: "Do not suggest tRPC",
                },
            },
            review_status: "pending",
            routing_reason: "global impact",
            created_at: "2026-05-11T08:00:00Z",
        };
        const parsed = StagedEntrySchema.parse(staged);
        expect(parsed.review_status).toBe("pending");
    });
});

describe("ConfigSchema", () => {
    it("parses with defaults", () => {
        const config = {
            project: { name: "test", created: "2024-01" },
        };
        const parsed = ConfigSchema.parse(config);
        expect(parsed.version).toBe("2.0");
        expect(parsed.domains.locked).toEqual([]);
        expect(parsed.trust_policy.L3_auto_write.length).toBeGreaterThan(0);
    });
});

describe("StageSnapshotSchema", () => {
    it("parses a valid snapshot", () => {
        const snapshot = {
            phase: "growth",
            confidence: 0.68,
            status: "advisory",
            evidence: [{ source: "git", signal: "commit frequency stable" }],
            guidance: ["Balance speed and stability"],
            last_updated: "2026-05-11T08:00:00Z",
        };
        const parsed = StageSnapshotSchema.parse(snapshot);
        expect(parsed.phase).toBe("growth");
    });
});

describe("SessionRecordSchema", () => {
    it("parses a valid session record", () => {
        const session = {
            id: "sess_2026_05_11_001",
            started_at: "2026-05-11T10:00:00Z",
            ended_at: "2026-05-11T12:30:00Z",
            summary: "Refactored auth module",
        };
        const parsed = SessionRecordSchema.parse(session);
        expect(parsed.signals_captured).toBe(0);
        expect(parsed.signals_routed.L0).toBe(0);
    });
});
