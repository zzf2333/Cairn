import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../src/stores/memory-store.js";
import { SignalStore } from "../src/stores/signal-store.js";
import { StagedStore } from "../src/stores/staged-store.js";
import { makeMemory, makeSignal, makeStagedEntry } from "./test-helpers.js";

function tmpDir(prefix: string): string {
    const dir = join(tmpdir(), `cairn-test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}

describe("MemoryStore edge cases", () => {
    let dir: string;

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("findByType filters correctly", () => {
        dir = tmpDir("mem-type");
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_a", { type: "decision" }));
        store.save(makeMemory("mem_b", { type: "rejection" }));
        store.save(makeMemory("mem_c", { type: "transition" }));

        const decisions = store.findByType("decision");
        expect(decisions).toHaveLength(1);
        expect(decisions[0].id).toBe("mem_a");

        const rejections = store.findByType("rejection");
        expect(rejections).toHaveLength(1);
        expect(rejections[0].id).toBe("mem_b");
    });

    it("findActive excludes archived", () => {
        dir = tmpDir("mem-active");
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_live", { status: "active" }));
        store.save(makeMemory("mem_gone", { status: "archived" }));

        const active = store.findActive();
        expect(active).toHaveLength(1);
        expect(active[0].id).toBe("mem_live");
    });

    it("loadAll skips corrupted YAML", () => {
        dir = tmpDir("mem-corrupt");
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_good"));
        writeFileSync(join(dir, "mem_bad.yaml"), "{{{{not yaml at all!!", "utf-8");

        const all = store.loadAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("mem_good");
    });

    it("loadAll skips invalid schema", () => {
        dir = tmpDir("mem-schema");
        const store = new MemoryStore(dir);
        store.save(makeMemory("mem_valid"));
        writeFileSync(join(dir, "mem_wrong.yaml"), "id: mem_wrong\ntype: not_a_real_type\n", "utf-8");

        const all = store.loadAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("mem_valid");
    });

    it("remove returns false for non-existent", () => {
        dir = tmpDir("mem-rm");
        const store = new MemoryStore(dir);
        expect(store.remove("does_not_exist")).toBe(false);
    });
});

describe("SignalStore edge cases", () => {
    let dir: string;

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("countByDomainAndSubject counts correctly", () => {
        dir = tmpDir("sig-count");
        const store = new SignalStore(dir);
        store.save(makeSignal("sig_1", {
            raw_data: { subject: "prisma", what: "use prisma" },
            inferred: { probable_domain: "db", confidence: "medium" },
        }));
        store.save(makeSignal("sig_2", {
            raw_data: { subject: "prisma", what: "still prisma" },
            inferred: { probable_domain: "db", confidence: "medium" },
        }));
        store.save(makeSignal("sig_3", {
            raw_data: { subject: "drizzle", what: "use drizzle" },
            inferred: { probable_domain: "db", confidence: "medium" },
        }));

        expect(store.countByDomainAndSubject("db", "prisma")).toBe(2);
        expect(store.countByDomainAndSubject("db", "drizzle")).toBe(1);
        expect(store.countByDomainAndSubject("db", "knex")).toBe(0);
    });

    it("loadAll skips corrupted YAML", () => {
        dir = tmpDir("sig-corrupt");
        const store = new SignalStore(dir);
        store.save(makeSignal("sig_ok"));
        writeFileSync(join(dir, "sig_bad.yaml"), ":::broken:::", "utf-8");

        const all = store.loadAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("sig_ok");
    });

    it("findByDomain returns correct subset", () => {
        dir = tmpDir("sig-domain");
        const store = new SignalStore(dir);
        store.save(makeSignal("sig_d1", {
            inferred: { probable_domain: "auth", confidence: "high" },
        }));
        store.save(makeSignal("sig_d2", {
            inferred: { probable_domain: "auth", confidence: "medium" },
        }));
        store.save(makeSignal("sig_d3", {
            inferred: { probable_domain: "payments", confidence: "high" },
        }));

        const auth = store.findByDomain("auth");
        expect(auth).toHaveLength(2);
        expect(store.findByDomain("payments")).toHaveLength(1);
        expect(store.findByDomain("nope")).toHaveLength(0);
    });

    it("remove returns false for non-existent", () => {
        dir = tmpDir("sig-rm");
        const store = new SignalStore(dir);
        expect(store.remove("ghost_signal")).toBe(false);
    });
});

describe("StagedStore edge cases", () => {
    let dir: string;

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("reject marks status as rejected", () => {
        dir = tmpDir("stg-reject");
        const store = new StagedStore(dir);
        store.save(makeStagedEntry("staged_pending", { review_status: "pending" }));

        const result = store.reject("staged_pending");
        expect(result).toBe(true);

        const all = store.loadAll();
        expect(all).toHaveLength(1);
        expect(all[0].review_status).toBe("rejected");
    });

    it("reject returns false for non-existent", () => {
        dir = tmpDir("stg-reject-miss");
        const store = new StagedStore(dir);
        expect(store.reject("no_such_staged")).toBe(false);
    });

    it("loadAll skips corrupted YAML", () => {
        dir = tmpDir("stg-corrupt");
        const store = new StagedStore(dir);
        store.save(makeStagedEntry("staged_ok"));
        writeFileSync(join(dir, "staged_bad.yaml"), "totally {broken yaml", "utf-8");

        const all = store.loadAll();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe("staged_ok");
    });
});
