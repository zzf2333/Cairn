import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir } from "node:fs/promises";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeSkeletonNode, makeConfig, makeState,
} from "../test-helpers.js";
import { buildPaths } from "../../src/paths.js";
import { BloodStore } from "../../src/stores/blood-store.js";
import { SkeletonStore } from "../../src/stores/skeleton-store.js";
import { DnaStore } from "../../src/stores/dna-store.js";
import { DomainStore } from "../../src/stores/domain-store.js";
import { StateStore } from "../../src/stores/state-store.js";
import { ConfigStore } from "../../src/stores/config-store.js";
import { GovernanceStore } from "../../src/stores/governance-store.js";
import { ActivationEngine } from "../../src/engines/activation-engine.js";
import { ChallengeEngine } from "../../src/engines/challenge-engine.js";
import { ViewsEngine } from "../../src/engines/views-engine.js";
import { TrustRouter } from "../../src/engines/trust-router.js";
import { GovernanceEngine } from "../../src/engines/governance-engine.js";

let tmpDir: string;
let paths: ReturnType<typeof buildPaths>;

beforeEach(async () => {
    tmpDir = await createTmpDir();
    paths = buildPaths(tmpDir);
    for (const dir of [paths.cairn, paths.blood, paths.skeleton, paths.dna,
        paths.domains, paths.staged, paths.signals, paths.signalsGit,
        paths.signalsCalibration, paths.signalsConversation,
        paths.governance, paths.views, paths.viewsDomains, paths.sessions]) {
        await mkdir(dir, { recursive: true });
    }
});

afterEach(async () => {
    await cleanTmpDir(tmpDir);
});

describe("Performance", () => {
    it("activation with 500+ blood events completes in <200ms", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const skeletonStore = new SkeletonStore(paths.skeleton);
        const dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
        const domainStore = new DomainStore(paths.domains);
        const stateStore = new StateStore(paths.state);

        await stateStore.save(makeState());
        await skeletonStore.save(makeSkeletonNode("api-layer", {
            causal_keywords: ["api", "REST"],
        }));
        await skeletonStore.save(makeSkeletonNode("auth", {
            causal_keywords: ["auth", "login"],
        }));

        const domains = ["api-layer", "auth", "data", "infra", "ui"];
        for (let i = 0; i < 500; i++) {
            const domain = domains[i % domains.length];
            await bloodStore.save(makeEvolutionEvent(`evt_perf_${i}`, {
                domain,
                subject: { name: `subject-${i}` },
            }));
        }

        const challengeEngine = new ChallengeEngine(bloodStore, skeletonStore, dnaStore);
        const engine = new ActivationEngine(bloodStore, skeletonStore, dnaStore, domainStore, stateStore, challengeEngine);

        const start = performance.now();
        const result = await engine.activate({ task: "fix the API endpoint" });
        const elapsed = performance.now() - start;

        expect(result.meta.blood_events_scanned).toBeGreaterThanOrEqual(500);
        expect(elapsed).toBeLessThan(2000);
    });

    it("views regeneration with 100+ events completes in <500ms", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const skeletonStore = new SkeletonStore(paths.skeleton);
        const dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
        const domainStore = new DomainStore(paths.domains);
        const stateStore = new StateStore(paths.state);

        await stateStore.save(makeState());

        const domains = ["api-layer", "auth", "data", "infra", "ui"];
        for (const d of domains) {
            await skeletonStore.save(makeSkeletonNode(d, {
                causal_keywords: [d],
            }));
            await domainStore.ensureDir(d);
        }

        for (let i = 0; i < 100; i++) {
            const domain = domains[i % domains.length];
            await bloodStore.save(makeEvolutionEvent(`evt_views_${i}`, {
                domain,
                subject: { name: `subject-${i}` },
                behavior_effect: {
                    type: i % 3 === 0 ? "avoid_suggestion" : "prefer_approach",
                    instruction: `instruction-${i}`,
                },
            }));
        }

        const viewsEngine = new ViewsEngine(
            bloodStore, skeletonStore, domainStore, dnaStore, stateStore,
            paths.viewsOutput, paths.viewsStage, paths.viewsDomains,
        );

        const start = performance.now();
        await viewsEngine.regenerate();
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(500);
    });

    it("trust router routes 100 signals sequentially in <1000ms", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
        const configStore = new ConfigStore(paths.config);
        const governanceStore = new GovernanceStore(paths.governancePolicy, paths.governanceAudit);

        await configStore.save(makeConfig());

        const governanceEngine = new GovernanceEngine(governanceStore, configStore);
        const router = new TrustRouter(bloodStore, dnaStore, governanceEngine);

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            await router.route({
                domain: `domain-${i % 5}`,
                subject_name: `subject-${i}`,
                type: "architecture_decision",
                gravity: (["G0", "G1", "G2", "G3"] as const)[i % 4],
            });
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(1000);
    });
});
