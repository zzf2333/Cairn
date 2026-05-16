import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeTraumaEvent,
    makeSkeletonNode, makeDNA, makeConfig, makeState,
} from "../test-helpers.js";
import { buildPaths } from "../../src/paths.js";
import { BloodStore } from "../../src/stores/blood-store.js";
import { SkeletonStore } from "../../src/stores/skeleton-store.js";
import { DnaStore } from "../../src/stores/dna-store.js";
import { DomainStore } from "../../src/stores/domain-store.js";
import { StateStore } from "../../src/stores/state-store.js";
import { ConfigStore } from "../../src/stores/config-store.js";
import { GovernanceStore } from "../../src/stores/governance-store.js";
import { GovernanceEngine } from "../../src/engines/governance-engine.js";
import { TrustRouter } from "../../src/engines/trust-router.js";
import { BloodEngine } from "../../src/engines/blood-engine.js";
import { ViewsEngine } from "../../src/engines/views-engine.js";
import { CalibrationEar } from "../../src/engines/calibration-ear.js";

let tmpDir: string;
let paths: ReturnType<typeof buildPaths>;
let bloodStore: BloodStore;
let skeletonStore: SkeletonStore;
let dnaStore: DnaStore;
let domainStore: DomainStore;
let stateStore: StateStore;
let configStore: ConfigStore;
let governanceStore: GovernanceStore;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    paths = buildPaths(tmpDir);
    for (const dir of [paths.cairn, paths.blood, paths.skeleton, paths.dna,
        paths.domains, paths.staged, paths.signals, paths.signalsGit,
        paths.signalsCalibration, paths.signalsConversation,
        paths.governance, paths.views, paths.viewsDomains, paths.sessions]) {
        await mkdir(dir, { recursive: true });
    }
    bloodStore = new BloodStore(paths.blood);
    skeletonStore = new SkeletonStore(paths.skeleton);
    dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
    domainStore = new DomainStore(paths.domains);
    stateStore = new StateStore(paths.state);
    configStore = new ConfigStore(paths.config);
    governanceStore = new GovernanceStore(paths.governancePolicy, paths.governanceAudit);
    await configStore.save(makeConfig());
    await stateStore.save(makeState());
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("GovernanceEngine", () => {
    let engine: GovernanceEngine;
    beforeEach(() => {
        engine = new GovernanceEngine(governanceStore, configStore);
    });

    it("requires human_ratified for trauma", async () => {
        const perm = await engine.checkPermission("G1", false, false, true, false);
        expect(perm).toBe("human_ratified");
    });

    it("requires human_ratified for DNA changes", async () => {
        const perm = await engine.checkPermission("G1", false, true, false, false);
        expect(perm).toBe("human_ratified");
    });

    it("requires human_ratified for G3", async () => {
        const perm = await engine.checkPermission("G3", false, false, false, false);
        expect(perm).toBe("human_ratified");
    });

    it("requires human_ratified for G2 in standard mode", async () => {
        const perm = await engine.checkPermission("G2", false, false, false, false);
        expect(perm).toBe("human_ratified");
    });

    it("allows system_validated for G1 in standard mode", async () => {
        const perm = await engine.checkPermission("G1", false, false, false, false);
        expect(["agent_proposed", "system_validated"]).toContain(perm);
    });

    it("logs audit entries", async () => {
        await engine.logAudit({
            time: "2026-05-15T10:00:00Z",
            action: "ratified",
            target: "evt_001",
            actor: "human",
        });
        const log = await governanceStore.loadAuditLog();
        expect(log).toHaveLength(1);
    });
});

describe("TrustRouter", () => {
    let router: TrustRouter;
    let governanceEngine: GovernanceEngine;
    beforeEach(() => {
        governanceEngine = new GovernanceEngine(governanceStore, configStore);
        router = new TrustRouter(bloodStore, dnaStore, governanceEngine);
    });

    it("drops G0 signals", async () => {
        const result = await router.route({
            domain: "api",
            subject_name: "minor-fix",
            type: "architecture_decision",
            gravity: "G0",
        });
        expect(result.destination).toBe("dropped");
    });

    it("routes G3 to staged with human_ratified", async () => {
        const result = await router.route({
            domain: "api",
            subject_name: "major-change",
            type: "architecture_decision",
            gravity: "G3",
        });
        expect(result.destination).toBe("staged");
        expect(result.governance).toBe("human_ratified");
    });

    it("merges duplicate events", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_existing", {
            domain: "api",
            subject: { name: "Redis" },
            type: "architecture_decision",
        }));
        const result = await router.route({
            domain: "api",
            subject_name: "Redis",
            type: "architecture_decision",
            gravity: "G1",
        });
        expect(result.destination).toBe("blood");
        expect(result.merged_with).toBe("evt_existing");
    });

    it("upgrades gravity for trauma domains", async () => {
        await bloodStore.save(makeTraumaEvent("evt_trauma", "auth"));
        const result = await router.route({
            domain: "auth",
            subject_name: "new-auth-lib",
            type: "architecture_decision",
            gravity: "G1",
        });
        expect(result.gravity).not.toBe("G1");
    });

    it("forces staged for trauma signals", async () => {
        const result = await router.route({
            domain: "api",
            subject_name: "incident",
            type: "incident",
            gravity: "G2",
            isTrauma: true,
        });
        expect(result.destination).toBe("staged");
        expect(result.governance).toBe("human_ratified");
    });
});

describe("BloodEngine", () => {
    let engine: BloodEngine;
    let viewsEngine: ViewsEngine;
    beforeEach(() => {
        viewsEngine = new ViewsEngine(
            bloodStore, skeletonStore, domainStore, dnaStore, stateStore,
            paths.viewsOutput, paths.viewsStage, paths.viewsDomains,
        );
        engine = new BloodEngine(bloodStore, domainStore, viewsEngine);
    });

    it("commits event and updates domain capillaries", async () => {
        await domainStore.ensureDir("api-layer");
        const evt = makeEvolutionEvent("evt_001", {
            domain: "api-layer",
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
            subject: { name: "tRPC" },
        });
        await engine.commit(evt);

        const loaded = await bloodStore.load("evt_001");
        expect(loaded).not.toBeNull();

        const paths_loaded = await domainStore.loadRejectedPaths("api-layer");
        expect(paths_loaded.paths.length).toBeGreaterThanOrEqual(1);
    });

    it("archives an event", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001"));
        await engine.archive("evt_001", "no longer relevant");
        const loaded = await bloodStore.load("evt_001");
        expect(loaded!.health.state).toBe("stale");
    });

    it("resurrects an event", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            health: { state: "stale", reason: "old" },
            lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
        }));
        await engine.resurrect("evt_001");
        const loaded = await bloodStore.load("evt_001");
        expect(loaded!.health.state).toBe("resurrected");
        expect(loaded!.lifecycle.resurrection_count).toBe(1);
    });

    it("marks trauma and upgrades gravity", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            gravity: { level: "G1" },
        }));
        const result = await engine.markTrauma("evt_001");
        expect(result.trauma.is_trauma).toBe(true);
        expect(result.gravity.level).toBe("G2");
    });
});

describe("ViewsEngine", () => {
    let engine: ViewsEngine;
    beforeEach(async () => {
        engine = new ViewsEngine(
            bloodStore, skeletonStore, domainStore, dnaStore, stateStore,
            paths.viewsOutput, paths.viewsStage, paths.viewsDomains,
        );
    });

    it("generates output.md", async () => {
        await skeletonStore.save(makeSkeletonNode("api-layer"));
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            domain: "api-layer",
            behavior_effect: { type: "avoid_suggestion", instruction: "no tRPC" },
            subject: { name: "tRPC" },
        }));
        await engine.regenerate();

        const { readFile } = await import("node:fs/promises");
        const content = await readFile(paths.viewsOutput, "utf-8");
        expect(content).toContain("No-Go");
        expect(content).toContain("tRPC");
    });

    it("generates stage.md", async () => {
        await engine.regenerate();

        const { readFile } = await import("node:fs/promises");
        const content = await readFile(paths.viewsStage, "utf-8");
        expect(content).toContain("growth");
    });

    it("generates domain views", async () => {
        await skeletonStore.save(makeSkeletonNode("api-layer"));
        await engine.regenerate();

        const { readFile } = await import("node:fs/promises");
        const content = await readFile(join(paths.viewsDomains, "api-layer.md"), "utf-8");
        expect(content).toContain("api-layer");
    });
});

describe("CalibrationEar", () => {
    let ear: CalibrationEar;
    beforeEach(() => {
        ear = new CalibrationEar(tmpDir, bloodStore, skeletonStore, domainStore, dnaStore);
    });

    it("returns empty when no conflicts", async () => {
        const result = await ear.calibrate();
        expect(result.signals).toEqual([]);
    });

    it("detects no-go dependency conflict", async () => {
        await bloodStore.save(makeEvolutionEvent("evt_001", {
            subject: { name: "axios" },
            behavior_effect: { type: "avoid_suggestion", instruction: "no axios" },
        }));
        const pkgJson = JSON.stringify({
            dependencies: { axios: "^1.0.0" },
        });
        await writeFile(join(tmpDir, "package.json"), pkgJson);

        const result = await ear.calibrate();
        const conflict = result.signals.find(s => s.signal_type === "calibration_conflict");
        expect(conflict).toBeDefined();
    });
});
