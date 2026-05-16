import { describe, it, expect } from "vitest";
import {
    EvolutionEventSchema,
    SkeletonNodeSchema,
    DNAIdentitySchema,
    DNAImprintSchema,
    ConfigSchema,
    StateSchema,
    GovernancePolicySchema,
    AuditEntrySchema,
    StagedEntrySchema,
    GitSignalSchema,
    ConversationSignalSchema,
    CalibrationSignalSchema,
    SessionRecordSchema,
    DomainConstraintsSchema,
    DomainAcceptedDebtSchema,
    DomainRejectedPathsSchema,
    GravitySchema,
    TraumaSchema,
    LifecycleSchema,
    HealthSchema,
    SourceSchema,
    BehaviorEffectSchema,
    RevisitSchema,
    SubjectSchema,
} from "../../src/schemas/index.js";
import {
    makeEvolutionEvent,
    makeSkeletonNode,
    makeDNA,
    makeConfig,
    makeState,
    makeStagedEntry,
    makeTraumaEvent,
} from "../test-helpers.js";

describe("Shared schemas", () => {
    it("validates Gravity", () => {
        expect(GravitySchema.parse({ level: "G2" })).toEqual({ level: "G2" });
        expect(GravitySchema.parse({ level: "G3", architectural: "high" })).toEqual({
            level: "G3",
            architectural: "high",
        });
        expect(() => GravitySchema.parse({ level: "G4" })).toThrow();
    });

    it("validates Trauma with defaults", () => {
        const result = TraumaSchema.parse({});
        expect(result.is_trauma).toBe(false);
        expect(result.sensitivity_multiplier).toBe(1.0);
        expect(result.decay_override).toBeNull();
    });

    it("validates Lifecycle", () => {
        const result = LifecycleSchema.parse({ validity: "strategic" });
        expect(result.decay_policy).toBe("downgrade");
        expect(result.resurrection_count).toBe(0);
    });

    it("validates Health with defaults", () => {
        const result = HealthSchema.parse({});
        expect(result.state).toBe("ok");
        expect(result.reason).toBeNull();
    });

    it("validates Source", () => {
        const result = SourceSchema.parse({
            type: "git_revert",
            confidence: 0.95,
        });
        expect(result.verified).toBe(false);
        expect(result.refs).toEqual([]);
    });

    it("validates BehaviorEffect", () => {
        expect(BehaviorEffectSchema.parse({
            type: "avoid_suggestion",
            instruction: "do not use tRPC",
        })).toBeTruthy();
        expect(() => BehaviorEffectSchema.parse({ type: "unknown", instruction: "" })).toThrow();
    });

    it("validates Subject", () => {
        expect(SubjectSchema.parse({ name: "Redis" })).toEqual({ name: "Redis", aliases: [] });
        expect(SubjectSchema.parse({ type: "technology", name: "Redis" })).toEqual({
            type: "technology",
            name: "Redis",
            aliases: [],
        });
        expect(SubjectSchema.parse({ name: "MongoDB", aliases: ["document store", "mongo"] })).toEqual({
            name: "MongoDB",
            aliases: ["document store", "mongo"],
        });
    });

    it("validates Revisit", () => {
        const result = RevisitSchema.parse({});
        expect(result.when).toEqual([]);
        expect(result.status).toBe("not_met");
    });
});

describe("EvolutionEvent schema", () => {
    it("validates a full event", () => {
        const event = makeEvolutionEvent("evt_test_001");
        const parsed = EvolutionEventSchema.parse(event);
        expect(parsed.id).toBe("evt_test_001");
        expect(parsed.gravity.level).toBe("G1");
    });

    it("validates a trauma event", () => {
        const event = makeTraumaEvent("evt_trauma_001", "auth");
        const parsed = EvolutionEventSchema.parse(event);
        expect(parsed.trauma.is_trauma).toBe(true);
        expect(parsed.trauma.decay_override).toBe("permanent");
        expect(parsed.gravity.level).toBe("G2");
    });

    it("applies defaults for optional arrays", () => {
        const event = makeEvolutionEvent("evt_test_002");
        const parsed = EvolutionEventSchema.parse(event);
        expect(parsed.rejected_paths).toEqual([]);
        expect(parsed.constraints_added).toEqual([]);
        expect(parsed.conflicts_with).toEqual([]);
        expect(parsed.related).toEqual([]);
    });

    it("rejects invalid event type", () => {
        const event = { ...makeEvolutionEvent("evt_bad"), type: "invalid_type" };
        expect(() => EvolutionEventSchema.parse(event)).toThrow();
    });

    it("rejects missing required fields", () => {
        expect(() => EvolutionEventSchema.parse({})).toThrow();
        expect(() => EvolutionEventSchema.parse({ id: "test" })).toThrow();
    });
});

describe("Skeleton schema", () => {
    it("validates a skeleton node", () => {
        const node = makeSkeletonNode("api-layer");
        const parsed = SkeletonNodeSchema.parse(node);
        expect(parsed.domain).toBe("api-layer");
        expect(parsed.stability).toBe("stable");
    });

    it("applies defaults", () => {
        const parsed = SkeletonNodeSchema.parse({ domain: "test", role: "test role" });
        expect(parsed.owns).toEqual([]);
        expect(parsed.does_not_own).toEqual([]);
        expect(parsed.dependencies).toEqual([]);
        expect(parsed.causal_keywords).toEqual([]);
    });
});

describe("DNA schemas", () => {
    it("validates DNAIdentity with defaults", () => {
        const parsed = DNAIdentitySchema.parse({});
        expect(parsed.status).toBe("not_yet_emerged");
        expect(parsed.reevaluation_mode).toBe(false);
        expect(parsed.traits).toEqual({});
    });

    it("validates DNAIdentity with traits", () => {
        const dna = makeDNA({
            traits: {
                simplicity_bias: {
                    level: "high",
                    confidence: 0.85,
                    evidence_count: 7,
                    last_updated: "2026-03",
                    reasoning: "test",
                },
            },
            status: "emerged",
        });
        const parsed = DNAIdentitySchema.parse(dna);
        expect(parsed.traits.simplicity_bias.level).toBe("high");
    });

    it("validates DNAImprint", () => {
        const parsed = DNAImprintSchema.parse({
            inherited_from: "project_x",
            inherited_at: "2026-01",
        });
        expect(parsed.identity_status).toBe("not_yet_emerged");
        expect(parsed.inherited_constraints).toEqual([]);
    });
});

describe("Config schema", () => {
    it("validates a full config", () => {
        const config = makeConfig();
        const parsed = ConfigSchema.parse(config);
        expect(parsed.version).toBe("3.0");
        expect(parsed.cognitive_mode).toBe("standard");
    });

    it("applies defaults", () => {
        const parsed = ConfigSchema.parse({
            version: "3.0",
            project: { name: "test", created: "2026-01" },
        });
        expect(parsed.domains).toEqual([]);
        expect(parsed.cognitive_mode).toBe("standard");
        expect(parsed.tech_stack).toEqual([]);
    });

    it("rejects wrong version", () => {
        expect(() => ConfigSchema.parse({
            version: "2.0",
            project: { name: "test", created: "2026-01" },
        })).toThrow();
    });
});

describe("State schema", () => {
    it("validates a full state", () => {
        const state = makeState();
        const parsed = StateSchema.parse(state);
        expect(parsed.initialization_status).toBe("complete");
        expect(parsed.stage.phase).toBe("growth");
    });

    it("applies defaults for empty state", () => {
        const parsed = StateSchema.parse({});
        expect(parsed.initialization_status).toBe("not_initialized");
        expect(parsed.stage.phase).toBe("exploration");
        expect(parsed.activation_log.recent_hits).toEqual({});
    });
});

describe("Governance schemas", () => {
    it("validates GovernancePolicy", () => {
        const parsed = GovernancePolicySchema.parse({});
        expect(parsed.cognitive_mode).toBe("standard");
    });

    it("validates AuditEntry", () => {
        const parsed = AuditEntrySchema.parse({
            time: "2026-05-15T10:00:00Z",
            action: "ratified",
            target: "evt_001",
            actor: "human",
            reason: "approved",
        });
        expect(parsed.action).toBe("ratified");
    });

    it("rejects invalid audit action", () => {
        expect(() => AuditEntrySchema.parse({
            time: "2026-05-15T10:00:00Z",
            action: "invalid",
            target: "evt_001",
            actor: "human",
        })).toThrow();
    });
});

describe("StagedEntry schema", () => {
    it("validates a staged entry", () => {
        const entry = makeStagedEntry("staged_001");
        const parsed = StagedEntrySchema.parse(entry);
        expect(parsed.review_status).toBe("pending");
        expect(parsed.governance_required).toBe("auto_confirmable");
    });
});

describe("Signal schemas", () => {
    it("validates GitSignal", () => {
        const parsed = GitSignalSchema.parse({
            id: "sig_git_001",
            signal_type: "revert",
            raw_data: { commits: ["abc123"] },
            inferred_gravity: "G2",
            confidence: 0.9,
            captured_at: "2026-05-15T10:00:00Z",
        });
        expect(parsed.signal_type).toBe("revert");
        expect(parsed.inferred_gravity).toBe("G2");
    });

    it("validates ConversationSignal", () => {
        const parsed = ConversationSignalSchema.parse({
            id: "sig_conv_001",
            signal_type: "user_rejection",
            domain: "api-layer",
            details: { what: "rejected tRPC", reason: "migration cost" },
            confidence: 0.7,
            captured_at: "2026-05-15T10:00:00Z",
        });
        expect(parsed.signal_type).toBe("user_rejection");
    });

    it("validates CalibrationSignal", () => {
        const parsed = CalibrationSignalSchema.parse({
            id: "sig_cal_001",
            signal_type: "calibration_conflict",
            description: "no-go tRPC found in dependencies",
            evidence: {
                expected: "tRPC not in dependencies",
                actual: "tRPC found in package.json",
                source: "calibration_ear",
            },
            inferred_gravity: "G2",
            confidence: 0.95,
            captured_at: "2026-05-15T10:00:00Z",
        });
        expect(parsed.signal_type).toBe("calibration_conflict");
    });
});

describe("SessionRecord schema", () => {
    it("validates with defaults", () => {
        const parsed = SessionRecordSchema.parse({
            id: "sess_001",
            started_at: "2026-05-15T10:00:00Z",
            ended_at: "2026-05-15T11:00:00Z",
            summary: "worked on auth",
        });
        expect(parsed.signals_captured).toBe(0);
        expect(parsed.signals_routed).toEqual({ G0: 0, G1: 0, G2: 0, G3: 0 });
        expect(parsed.domains_touched).toEqual([]);
    });
});

describe("DomainCapillary schemas", () => {
    it("validates DomainConstraints", () => {
        const parsed = DomainConstraintsSchema.parse({ domain: "auth" });
        expect(parsed.constraints).toEqual([]);
    });

    it("validates DomainAcceptedDebt", () => {
        const parsed = DomainAcceptedDebtSchema.parse({ domain: "auth" });
        expect(parsed.debts).toEqual([]);
    });

    it("validates DomainRejectedPaths", () => {
        const parsed = DomainRejectedPathsSchema.parse({ domain: "auth" });
        expect(parsed.paths).toEqual([]);
    });
});
