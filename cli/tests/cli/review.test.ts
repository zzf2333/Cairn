import { mkdir } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clusterStagedEntries, isLegacyNoisyLargeRefactor, runReview } from "../../src/cli/review.js";
import { buildPaths } from "../../src/paths.js";
import { GovernanceStore, StagedStore } from "../../src/stores/index.js";
import { cleanTmpDir, createTmpDir, makeEvolutionEvent, makeStagedEntry } from "../test-helpers.js";

let tmpDir: string;
let originalCwd: string;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    originalCwd = process.cwd();
});

afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    await cleanTmpDir(tmpDir);
});

describe("review clustering", () => {
    it("clusters legacy noisy large-refactor entries without evidence", () => {
        const entry = makeStagedEntry("stg_legacy", {
            draft_event: makeEvolutionEvent("evt_legacy", {
                source: { type: "runtime_observed", confidence: 0.6, verified: false, refs: [] },
                trigger: "large refactor detected: 42 files changed",
                decision_or_change: "refactored apps module",
                gravity: { level: "G2" },
                evidence: undefined,
            }),
            routing_reason: "G2 architecture decision requires review",
            gravity: "G2",
            governance_required: "human_ratified",
        });

        expect(isLegacyNoisyLargeRefactor(entry)).toBe(true);
        const clusters = clusterStagedEntries([entry]);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].id).toBe("noisy-large-refactor");
        expect(clusters[0].count).toBe(1);
    });

    it("does not batch-dismiss entries that already carry mapper evidence", () => {
        const entry = makeStagedEntry("stg_evidence", {
            draft_event: makeEvolutionEvent("evt_evidence", {
                source: { type: "runtime_observed", confidence: 0.8, verified: false, refs: [] },
                trigger: "large refactor detected: 12 files changed",
                decision_or_change: "refactored runtime engine",
                gravity: { level: "G2" },
                evidence: {
                    mapper_version: "git-signal-mapper:v2",
                    routing_reason: "behavioral runtime source changed with tests",
                    confidence: 0.78,
                    domain_confidence: 0.8,
                    domain_evidence: ["path:cli/src/engines"],
                },
            }),
            gravity: "G2",
        });

        expect(isLegacyNoisyLargeRefactor(entry)).toBe(false);
        expect(clusterStagedEntries([entry]).find(cluster => cluster.id === "noisy-large-refactor")).toBeUndefined();
    });

    it("dry-runs dismissals by default and only rejects with --yes", async () => {
        const paths = buildPaths(tmpDir);
        await mkdir(paths.staged, { recursive: true });
        const stagedStore = new StagedStore(paths.staged);
        const governanceStore = new GovernanceStore(paths.governancePolicy, paths.governanceAudit);
        const entry = makeStagedEntry("stg_dismiss", {
            draft_event: makeEvolutionEvent("evt_dismiss", {
                source: { type: "runtime_observed", confidence: 0.6, verified: false, refs: [] },
                trigger: "large refactor detected: 30 files changed",
                decision_or_change: "refactored docs module",
                gravity: { level: "G2" },
                evidence: undefined,
            }),
            gravity: "G2",
            governance_required: "human_ratified",
        });
        await stagedStore.save(entry);
        process.chdir(tmpDir);
        vi.spyOn(console, "log").mockImplementation(() => undefined);

        await runReview(["dismiss", "--cluster", "noisy-large-refactor", "--dry-run", "--json"]);
        expect((await stagedStore.load("stg_dismiss"))?.review_status).toBe("pending");
        expect(await governanceStore.loadAuditLog()).toHaveLength(0);

        await runReview(["dismiss", "--cluster", "noisy-large-refactor", "--yes", "--json"]);
        expect((await stagedStore.load("stg_dismiss"))?.review_status).toBe("rejected");
        const audit = await governanceStore.loadAuditLog();
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({
            action: "rejected",
            target: "stg_dismiss",
            actor: "system",
        });
    });
});
