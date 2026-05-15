import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EvolutionEvent } from "../src/schemas/evolution-event.js";
import type { SkeletonNode } from "../src/schemas/skeleton.js";
import type { DNAIdentity } from "../src/schemas/dna.js";
import type { Config } from "../src/schemas/config.js";
import type { State } from "../src/schemas/state.js";
import type { StagedEntry } from "../src/schemas/staged-entry.js";

export async function createTmpDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), "cairn-test-"));
}

export async function cleanTmpDir(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true });
}

const now = "2026-05-15T10:00:00Z";

export function makeEvolutionEvent(id: string, overrides?: Partial<EvolutionEvent>): EvolutionEvent {
    return {
        id,
        time: "2026-05-15",
        domain: "api-layer",
        type: "architecture_decision",
        gravity: { level: "G1" },
        source: { type: "conversation", confidence: 0.8, verified: false, refs: [] },
        subject: { name: "test-subject" },
        trigger: "test trigger",
        decision_or_change: "test decision",
        rejected_paths: [],
        reasoning: "test reasoning",
        constraints_added: [],
        constraints_removed: [],
        accepted_debt: [],
        behavior_effect: { type: "avoid_suggestion", instruction: "test instruction" },
        affects: { skeleton: false, dna: false, domains: ["api-layer"] },
        lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
        health: { state: "ok", reason: null },
        trauma: {
            is_trauma: false,
            sensitivity_multiplier: 1.0,
            decay_override: null,
            affects_dna: false,
            requires_human_ratification: true,
        },
        supersedes: null,
        conflicts_with: [],
        related: [],
        created_at: now,
        updated_at: now,
        governance_status: "auto_confirmed",
        ...overrides,
    };
}

export function makeTraumaEvent(id: string, domain: string): EvolutionEvent {
    return makeEvolutionEvent(id, {
        domain,
        type: "incident",
        gravity: { level: "G2", architectural: "high" },
        trauma: {
            is_trauma: true,
            sensitivity_multiplier: 2.0,
            decay_override: "permanent",
            affects_dna: true,
            requires_human_ratification: true,
        },
        lifecycle: { validity: "identity", decay_policy: "permanent", resurrection_count: 0 },
        governance_status: "ratified",
    });
}

export function makeSkeletonNode(domain: string, overrides?: Partial<SkeletonNode>): SkeletonNode {
    return {
        domain,
        role: `${domain} module`,
        owns: ["feature_a", "feature_b"],
        does_not_own: ["unrelated_feature"],
        stability: "stable",
        dependencies: [],
        causal_keywords: [domain, "test"],
        ...overrides,
    };
}

export function makeDNA(overrides?: Partial<DNAIdentity>): DNAIdentity {
    return {
        traits: {},
        status: "not_yet_emerged",
        reevaluation_mode: false,
        compression_threshold: {
            min_evidence: 3,
            min_timespan_months: 3,
            min_confidence: 0.6,
        },
        ...overrides,
    };
}

export function makeConfig(overrides?: Partial<Config>): Config {
    return {
        version: "3.0" as const,
        project: { name: "test-project", created: "2026-01" },
        domains: ["api-layer", "auth"],
        cognitive_mode: "standard",
        stage: { override: null },
        tech_stack: [],
        ...overrides,
    };
}

export function makeState(overrides?: Partial<State>): State {
    return {
        initialization_status: "complete",
        last_session: { commit: null, ended_at: null },
        stage: {
            phase: "growth",
            confidence: 0.7,
            status: "advisory",
            evidence: [],
            guidance: [],
        },
        activation_log: { recent_hits: {} },
        ...overrides,
    };
}

export function makeStagedEntry(id: string, overrides?: Partial<StagedEntry>): StagedEntry {
    return {
        id,
        draft_event: makeEvolutionEvent(`draft_${id}`),
        review_status: "pending",
        routing_reason: "test routing",
        gravity: "G1",
        governance_required: "auto_confirmable",
        created_at: now,
        ...overrides,
    };
}
