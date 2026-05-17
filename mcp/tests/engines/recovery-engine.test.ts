import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createContext } from "../../src/context.js";
import { createTmpDir, cleanTmpDir } from "../test-helpers.js";

describe("RecoveryEngine", () => {
    let root: string;
    beforeEach(async () => {
        root = await createTmpDir();
    });
    afterEach(async () => {
        await cleanTmpDir(root);
    });

    it("detects yaml parse failures and quarantines them on fix", async () => {
        const ctx = await createContext(root);
        await mkdir(ctx.paths.blood, { recursive: true });
        await writeFile(join(ctx.paths.blood, "broken.yaml"), "not: : valid: yaml: at all", "utf-8");
        await writeFile(join(ctx.paths.blood, "ok.yaml"), "id: x\nname: y\n", "utf-8");

        const scan = await ctx.recoveryEngine.scan();
        expect(scan.scanned).toBeGreaterThanOrEqual(2);
        const parseFail = scan.corruptions.find(c => c.kind === "yaml_parse_failure");
        expect(parseFail).toBeDefined();

        const fixed = await ctx.recoveryEngine.fix(scan);
        expect(fixed.quarantined.length).toBeGreaterThanOrEqual(1);

        // broken.yaml should no longer be in blood/
        const remaining = await readdir(ctx.paths.blood);
        expect(remaining).not.toContain("broken.yaml");
        expect(remaining).toContain("ok.yaml");
    });

    it("detects orphan skeleton refs but does not auto-delete blood", async () => {
        const ctx = await createContext(root);

        await ctx.skeletonStore.save({
            domain: "api-layer",
            role: "primary",
            capabilities: ["x"],
            files: [],
            depends_on: [],
            tags: [],
            archetype: "service",
            last_updated: "2026-05-15",
        });

        await ctx.bloodStore.save({
            id: "evo_orphan_test",
            time: "2026-05-15",
            domain: "missing-domain",
            type: "architecture_decision",
            gravity: { level: "G1" },
            source: { type: "conversation", confidence: 0.8, verified: false, refs: [] },
            subject: { name: "x" },
            trigger: "",
            decision_or_change: "",
            rejected_paths: [],
            reasoning: "",
            constraints_added: [],
            constraints_removed: [],
            accepted_debt: [],
            behavior_effect: { type: "avoid_suggestion", instruction: "" },
            affects: { skeleton: false, dna: false, domains: ["missing-domain"] },
            lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
            health: { state: "ok", reason: null },
            trauma: { is_trauma: false, severity: "low", sensitivity_multiplier: 1 },
            revisit: { when: [] },
            created_at: "2026-05-15T00:00:00Z",
            updated_at: "2026-05-15T00:00:00Z",
            governance_status: "auto_confirmed",
        });

        const scan = await ctx.recoveryEngine.scan();
        const orphan = scan.corruptions.find(c => c.kind === "orphan_skeleton_ref");
        expect(orphan).toBeDefined();

        const fixed = await ctx.recoveryEngine.fix(scan);
        // orphan blood not auto-quarantined
        expect(fixed.quarantined.some(p => p.includes("evo_orphan_test"))).toBe(false);
    });

    it("recovers an incomplete session checkpoint", async () => {
        const ctx = await createContext(root);
        await ctx.stateStore.startSessionCheckpoint("decay_done");

        const stateBefore = await ctx.stateStore.load();
        expect(stateBefore.session_in_progress).toBeDefined();

        const result = await ctx.recoveryEngine.recoverSession();
        expect(result.recovered).toBe(true);
        expect(result.previous_checkpoint?.step).toBe("decay_done");

        const stateAfter = await ctx.stateStore.load();
        expect(stateAfter.session_in_progress).toBeUndefined();
    });

    it("returns recovered=false when no checkpoint exists", async () => {
        const ctx = await createContext(root);
        const result = await ctx.recoveryEngine.recoverSession();
        expect(result.recovered).toBe(false);
    });
});
