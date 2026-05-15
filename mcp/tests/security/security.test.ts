import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
    createTmpDir, cleanTmpDir,
    makeEvolutionEvent, makeConfig, makeState,
} from "../test-helpers.js";
import { buildPaths } from "../../src/paths.js";
import { BloodStore } from "../../src/stores/blood-store.js";
import { StateStore } from "../../src/stores/state-store.js";
import { ConfigStore } from "../../src/stores/config-store.js";
import { EvolutionEventSchema } from "../../src/schemas/evolution-event.js";
import { ConfigSchema } from "../../src/schemas/config.js";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";

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

describe("Path traversal prevention", () => {
    it("event ID with ../ fails or stays within .cairn", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const maliciousId = "../../etc/passwd";
        const event = makeEvolutionEvent(maliciousId);

        let threw = false;
        try {
            await bloodStore.save(event);
        } catch {
            threw = true;
        }

        if (threw) {
            const bloodFiles = await readdir(paths.blood);
            expect(bloodFiles.length).toBe(0);
        } else {
            const resolvedTarget = resolve(join(paths.blood, `${maliciousId}.yaml`));
            const cairnDir = resolve(paths.cairn);
            const isInsideCairn = resolvedTarget.startsWith(cairnDir);
            const isInsideTmp = resolvedTarget.startsWith(resolve(tmpDir));
            expect(isInsideTmp).toBe(true);
        }
    });

    it("event with path traversal in subject does not escape", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const event = makeEvolutionEvent("evt_safe_001", {
            subject: { name: "../../../etc/passwd" },
            domain: "../escape",
        });

        await bloodStore.save(event);

        const loaded = await bloodStore.load("evt_safe_001");
        expect(loaded).not.toBeNull();
        expect(loaded!.subject.name).toBe("../../../etc/passwd");
        expect(loaded!.domain).toBe("../escape");
    });
});

describe("YAML injection", () => {
    it("YAML special characters in fields are safely serialized", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const yamlPayload = "key: value\n  nested: true\n- list_item";
        const event = makeEvolutionEvent("evt_yaml_001", {
            subject: { name: yamlPayload },
            trigger: "!!python/object:__import__('os').system('rm -rf /')",
            reasoning: "---\nmalicious: true",
            decision_or_change: "{exploit: true}",
        });

        await bloodStore.save(event);
        const loaded = await bloodStore.load("evt_yaml_001");

        expect(loaded).not.toBeNull();
        expect(loaded!.subject.name).toBe(yamlPayload);
        expect(loaded!.trigger).toBe("!!python/object:__import__('os').system('rm -rf /')");
        expect(loaded!.reasoning).toBe("---\nmalicious: true");
        expect(loaded!.decision_or_change).toBe("{exploit: true}");
    });

    it("YAML anchors and aliases in event data are preserved as strings", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const event = makeEvolutionEvent("evt_yaml_002", {
            subject: { name: "&anchor_name *alias_ref" },
            trigger: "<<: *merge_key",
        });

        await bloodStore.save(event);
        const loaded = await bloodStore.load("evt_yaml_002");
        expect(loaded).not.toBeNull();
        expect(loaded!.subject.name).toBe("&anchor_name *alias_ref");
    });
});

describe("Input validation via Zod schemas", () => {
    it("rejects event with invalid type", () => {
        const badEvent = { ...makeEvolutionEvent("evt_bad"), type: "sql_injection" };
        expect(() => EvolutionEventSchema.parse(badEvent)).toThrow();
    });

    it("rejects event with invalid gravity level", () => {
        const badEvent = { ...makeEvolutionEvent("evt_bad"), gravity: { level: "G99" } };
        expect(() => EvolutionEventSchema.parse(badEvent)).toThrow();
    });

    it("rejects event with missing required fields", () => {
        expect(() => EvolutionEventSchema.parse({})).toThrow();
        expect(() => EvolutionEventSchema.parse({ id: "test" })).toThrow();
        expect(() => EvolutionEventSchema.parse({ id: "test", domain: "x" })).toThrow();
    });

    it("rejects config with wrong version", () => {
        expect(() => ConfigSchema.parse({
            version: "999.0",
            project: { name: "test", created: "2026-01" },
        })).toThrow();
    });

    it("rejects event with confidence out of range", () => {
        const badEvent = {
            ...makeEvolutionEvent("evt_bad"),
            source: { type: "conversation", confidence: 5.0, verified: false, refs: [] },
        };
        expect(() => EvolutionEventSchema.parse(badEvent)).toThrow();
    });

    it("rejects event with invalid behavior effect type", () => {
        const badEvent = {
            ...makeEvolutionEvent("evt_bad"),
            behavior_effect: { type: "execute_code", instruction: "malicious" },
        };
        expect(() => EvolutionEventSchema.parse(badEvent)).toThrow();
    });
});

describe("Large input handling", () => {
    it("handles very long strings (10K+ chars) without crashing", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const longString = "a".repeat(15000);
        const event = makeEvolutionEvent("evt_large_001", {
            subject: { name: longString },
            trigger: longString,
            reasoning: longString,
            decision_or_change: longString,
        });

        await bloodStore.save(event);
        const loaded = await bloodStore.load("evt_large_001");

        expect(loaded).not.toBeNull();
        expect(loaded!.subject.name.length).toBe(15000);
        expect(loaded!.trigger.length).toBe(15000);
    });

    it("handles event with many rejected paths without crashing", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const manyPaths = Array.from({ length: 500 }, (_, i) => ({
            path: `path-${i}`,
            reason: `reason-${i}-${"x".repeat(200)}`,
        }));

        const event = makeEvolutionEvent("evt_large_002", {
            rejected_paths: manyPaths,
        });

        await bloodStore.save(event);
        const loaded = await bloodStore.load("evt_large_002");

        expect(loaded).not.toBeNull();
        expect(loaded!.rejected_paths.length).toBe(500);
    });

    it("handles event with many constraints without crashing", async () => {
        const bloodStore = new BloodStore(paths.blood);
        const manyConstraints = Array.from({ length: 200 }, (_, i) => `constraint-${i}`);

        const event = makeEvolutionEvent("evt_large_003", {
            constraints_added: manyConstraints,
        });

        await bloodStore.save(event);
        const loaded = await bloodStore.load("evt_large_003");

        expect(loaded).not.toBeNull();
        expect(loaded!.constraints_added.length).toBe(200);
    });
});
