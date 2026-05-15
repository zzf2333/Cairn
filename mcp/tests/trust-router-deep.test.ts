import { describe, it, expect, afterEach } from "vitest";
import { rmSync } from "node:fs";
import { createTestEnv, makeSignal, makeMemory, defaultConfig } from "./test-helpers.js";
import type { Config } from "../src/schemas/config.js";
import type { Signal } from "../src/schemas/signal.js";

describe("L2 policy matching", () => {
    let root: string;
    let router: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    function setup() {
        const env = createTestEnv();
        root = env.root;
        router = env.ctx.trustRouter;
    }

    it("matches scope == global rule", () => {
        setup();
        const signal = makeSignal("sig_l2_global", {
            raw_data: { what: "no ORM", scope: "global", subject: "orm" },
            inferred: { probable_type: "decision", confidence: "high" },
        });
        expect(router.matchesL2Policy(signal, defaultConfig)).toBe(true);
    });

    it("matches type == transition rule", () => {
        setup();
        const signal = makeSignal("sig_l2_transition", {
            raw_data: { what: "move to monorepo", subject: "monorepo" },
            inferred: { probable_type: "transition", confidence: "high" },
        });
        expect(router.matchesL2Policy(signal, defaultConfig)).toBe(true);
    });

    it("does not match when no rules apply", () => {
        setup();
        const signal = makeSignal("sig_l2_none", {
            raw_data: { what: "pick lodash", scope: "local", subject: "lodash" },
            inferred: { probable_type: "decision", confidence: "high" },
        });
        expect(router.matchesL2Policy(signal, defaultConfig)).toBe(false);
    });
});

describe("L3 auto-write policy matching", () => {
    let root: string;
    let router: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    function setup() {
        const env = createTestEnv();
        root = env.root;
        router = env.ctx.trustRouter;
    }

    it("matches git-revert with local scope", () => {
        setup();
        const signal = makeSignal("sig_l3_revert", {
            source_ear: "git",
            signal_type: "revert",
            raw_data: { what: "reverted X", scope: "local", subject: "X" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, defaultConfig)).toBe(true);
    });

    it("matches git-dependency + rejection + local scope", () => {
        setup();
        const signal = makeSignal("sig_l3_dep", {
            source_ear: "git",
            signal_type: "dependency-removed",
            raw_data: { what: "removed moment.js", scope: "local", subject: "moment" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, defaultConfig)).toBe(true);
    });

    it("global scope prevents L3 match", () => {
        setup();
        const signal = makeSignal("sig_l3_global", {
            source_ear: "git",
            signal_type: "revert",
            raw_data: { what: "reverted Y", scope: "global", subject: "Y" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, defaultConfig)).toBe(false);
    });

    it("matches conversation rejection via config rule", () => {
        setup();
        const signal = makeSignal("sig_l3_conv_rej", {
            source_ear: "conversation",
            signal_type: "user-rejection",
            raw_data: { what: "rejected X", scope: "local", subject: "X" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, defaultConfig)).toBe(true);
    });

    it("matches conversation decision via config rule", () => {
        setup();
        const signal = makeSignal("sig_l3_conv_dec", {
            source_ear: "conversation",
            signal_type: "decision",
            raw_data: { what: "chose Y", scope: "local", subject: "Y" },
            inferred: { probable_type: "decision", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, defaultConfig)).toBe(true);
    });

    it("matches conversation debt via config rule", () => {
        setup();
        const signal = makeSignal("sig_l3_conv_debt", {
            source_ear: "conversation",
            signal_type: "debt-acceptance",
            raw_data: { what: "accepted tech debt", scope: "local", subject: "tech-debt" },
            inferred: { probable_type: "debt", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, defaultConfig)).toBe(true);
    });

    it("conversation signals do not match without conversation rules", () => {
        setup();
        const gitOnlyConfig: Config = {
            ...defaultConfig,
            trust_policy: {
                ...defaultConfig.trust_policy,
                L3_auto_write: [
                    "source.kind == 'git-revert' AND scope == 'local'",
                    "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'",
                ],
            },
        };
        const signal = makeSignal("sig_l3_conv_noconfig", {
            source_ear: "conversation",
            signal_type: "user-rejection",
            raw_data: { what: "rejected Z", scope: "local", subject: "Z" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, gitOnlyConfig)).toBe(false);
    });

    it("empty L3 rules match nothing", () => {
        setup();
        const emptyL3Config: Config = {
            ...defaultConfig,
            trust_policy: {
                ...defaultConfig.trust_policy,
                L3_auto_write: [],
            },
        };
        const gitSignal = makeSignal("sig_l3_empty_git", {
            source_ear: "git",
            signal_type: "revert",
            raw_data: { what: "reverted Z", scope: "local", subject: "Z" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(gitSignal, emptyL3Config)).toBe(false);

        const convSignal = makeSignal("sig_l3_empty_conv", {
            source_ear: "conversation",
            signal_type: "user-rejection",
            raw_data: { what: "rejected W", scope: "local", subject: "W" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(convSignal, emptyL3Config)).toBe(false);
    });
});

describe("inferSourceKind", () => {
    let root: string;
    let router: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    function setup() {
        const env = createTestEnv();
        root = env.root;
        router = env.ctx.trustRouter;
    }

    it("returns git-revert for git + revert", () => {
        setup();
        const signal = makeSignal("sig_src_revert", {
            source_ear: "git",
            signal_type: "revert",
        });
        expect(router.inferSourceKind(signal)).toBe("git-revert");
    });

    it("returns git-dependency for git + dependency-removed", () => {
        setup();
        const signal = makeSignal("sig_src_dep", {
            source_ear: "git",
            signal_type: "dependency-removed",
        });
        expect(router.inferSourceKind(signal)).toBe("git-dependency");
    });

    it("returns conversation for conversation source", () => {
        setup();
        const signal = makeSignal("sig_src_conv", {
            source_ear: "conversation",
            signal_type: "decision",
        });
        expect(router.inferSourceKind(signal)).toBe("conversation");
    });

    it("returns manual for unknown source_ear + signal_type combo", () => {
        setup();
        const signal = makeSignal("sig_src_manual", {
            source_ear: "git",
            signal_type: "large-refactor",
        });
        expect(router.inferSourceKind(signal)).toBe("manual");
    });
});

describe("L1 accumulation", () => {
    let root: string;
    let ctx: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("upgrades to L2 after 3 signals with same domain+subject", () => {
        const env = createTestEnv();
        root = env.root;
        ctx = env.ctx;

        const base = {
            source_ear: "conversation" as const,
            signal_type: "decision" as const,
            raw_data: { what: "use Prisma", subject: "prisma-orm" },
            inferred: { probable_type: "experiment" as const, probable_domain: "database", confidence: "medium" as const },
        };

        const r1 = ctx.trustRouter.route(
            makeSignal("sig_acc_1", base),
            defaultConfig,
        );
        expect(r1.level).toBe("L1");

        const r2 = ctx.trustRouter.route(
            makeSignal("sig_acc_2", base),
            defaultConfig,
        );
        expect(r2.level).toBe("L1");

        const r3 = ctx.trustRouter.route(
            makeSignal("sig_acc_3", base),
            defaultConfig,
        );
        expect(r3.level).toBe("L2");
        expect(r3.reason).toContain("accumulated");
    });
});

describe("signalToMemory conversion", () => {
    let root: string;
    let router: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("produces a MemoryEntry with correct fields", () => {
        const env = createTestEnv();
        root = env.root;
        router = env.ctx.trustRouter;

        const signal = makeSignal("sig_conv", {
            source_ear: "git",
            signal_type: "revert",
            raw_data: { what: "reverted tRPC", scope: "local", subject: "tRPC", reason: "too complex" },
            inferred: {
                probable_type: "rejection",
                probable_domain: "api-layer",
                confidence: "high",
            },
        });

        const mem = router.signalToMemory(signal, "api-layer", "tRPC");
        expect(mem.type).toBe("rejection");
        expect(mem.domain).toBe("api-layer");
        expect(mem.scope).toBe("local");
        expect(mem.status).toBe("active");
        expect(mem.source.kind).toBe("git-revert");
        expect(mem.source.refs[0].id).toBe("sig_conv");
        expect(mem.subject.name).toBe("tRPC");
        expect(mem.summary).toBe("reverted tRPC");
        expect(mem.behavior_effect.type).toBe("avoid_suggestion");
        expect(mem.behavior_effect.instruction).toBe("too complex");
        expect(mem.confidence.level).toBe("high");
    });
});

describe("evaluateRule edge cases", () => {
    let root: string;
    let router: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    function setup() {
        const env = createTestEnv();
        root = env.root;
        router = env.ctx.trustRouter;
    }

    it("single condition rule matches", () => {
        setup();
        expect(router.evaluateRule(
            "type == 'rejection'",
            { "source.kind": "conversation", scope: "local", type: "rejection" },
        )).toBe(true);
    });

    it("extra whitespace in conditions still matches", () => {
        setup();
        expect(router.evaluateRule(
            "  source.kind == 'conversation'   AND   type == 'rejection'  ",
            { "source.kind": "conversation", scope: "local", type: "rejection" },
        )).toBe(true);
    });

    it("unknown variable in rule causes condition to fail", () => {
        setup();
        expect(router.evaluateRule(
            "source.kind == 'conversation' AND foo == 'bar'",
            { "source.kind": "conversation", scope: "local", type: "rejection" },
        )).toBe(false);
    });

    it("malformed rule returns false", () => {
        setup();
        expect(router.evaluateRule(
            "this is not a valid rule",
            { "source.kind": "conversation", type: "rejection" },
        )).toBe(false);
    });

    it("empty string returns false", () => {
        setup();
        expect(router.evaluateRule(
            "",
            { "source.kind": "conversation", type: "rejection" },
        )).toBe(false);
    });

    it("three-condition rule matches when all vars present", () => {
        setup();
        expect(router.evaluateRule(
            "source.kind == 'conversation' AND type == 'rejection' AND scope == 'local'",
            { "source.kind": "conversation", scope: "local", type: "rejection" },
        )).toBe(true);
    });

    it("three-condition rule fails when one var mismatches", () => {
        setup();
        expect(router.evaluateRule(
            "source.kind == 'conversation' AND type == 'rejection' AND scope == 'local'",
            { "source.kind": "conversation", scope: "global", type: "rejection" },
        )).toBe(false);
    });
});

describe("Config variations", () => {
    let root: string;
    let router: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    function setup() {
        const env = createTestEnv();
        root = env.root;
        router = env.ctx.trustRouter;
    }

    it("custom L3 rule with novel field matches", () => {
        setup();
        const customConfig: Config = {
            ...defaultConfig,
            trust_policy: {
                ...defaultConfig.trust_policy,
                L3_auto_write: [
                    "source.kind == 'conversation' AND type == 'experiment'",
                ],
            },
        };
        const signal = makeSignal("sig_custom", {
            source_ear: "conversation",
            signal_type: "decision",
            raw_data: { what: "experiment X", scope: "local", subject: "X" },
            inferred: { probable_type: "experiment", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, customConfig)).toBe(true);
    });

    it("config with only conversation rules does not match git signals", () => {
        setup();
        const convOnlyConfig: Config = {
            ...defaultConfig,
            trust_policy: {
                ...defaultConfig.trust_policy,
                L3_auto_write: [
                    "source.kind == 'conversation' AND type == 'rejection'",
                    "source.kind == 'conversation' AND type == 'decision'",
                ],
            },
        };
        const signal = makeSignal("sig_git_only", {
            source_ear: "git",
            signal_type: "revert",
            raw_data: { what: "reverted X", scope: "local", subject: "X" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, convOnlyConfig)).toBe(false);
    });

    it("stricter rule with scope constraint only matches local", () => {
        setup();
        const strictConfig: Config = {
            ...defaultConfig,
            trust_policy: {
                ...defaultConfig.trust_policy,
                L3_auto_write: [
                    "source.kind == 'conversation' AND type == 'rejection' AND scope == 'local'",
                ],
            },
        };
        const localSignal = makeSignal("sig_strict_local", {
            source_ear: "conversation",
            signal_type: "user-rejection",
            raw_data: { what: "rejected X", scope: "local", subject: "X" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(localSignal, strictConfig)).toBe(true);

        const globalSignal = makeSignal("sig_strict_global", {
            source_ear: "conversation",
            signal_type: "user-rejection",
            raw_data: { what: "rejected Y", scope: "global", subject: "Y" },
            inferred: { probable_type: "rejection", confidence: "high" },
        });
        expect(router.matchesL3Policy(globalSignal, strictConfig)).toBe(false);
    });

    it("malformed rule strings in config are safely ignored", () => {
        setup();
        const brokenConfig: Config = {
            ...defaultConfig,
            trust_policy: {
                ...defaultConfig.trust_policy,
                L3_auto_write: [
                    "not a real rule",
                    "=== broken ===",
                    "",
                ],
            },
        };
        const signal = makeSignal("sig_broken", {
            source_ear: "conversation",
            signal_type: "decision",
            raw_data: { what: "chose X", scope: "local", subject: "X" },
            inferred: { probable_type: "decision", confidence: "high" },
        });
        expect(router.matchesL3Policy(signal, brokenConfig)).toBe(false);
    });
});

describe("inferBehaviorType via routing", () => {
    let root: string;
    let router: any;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    function setup() {
        const env = createTestEnv();
        root = env.root;
        router = env.ctx.trustRouter;
    }

    it("user-rejection → avoid_suggestion", () => {
        setup();
        expect(router.inferBehaviorType(
            makeSignal("sig_bh1", { signal_type: "user-rejection" }),
        )).toBe("avoid_suggestion");
    });

    it("decision → prefer_approach", () => {
        setup();
        expect(router.inferBehaviorType(
            makeSignal("sig_bh2", { signal_type: "decision" }),
        )).toBe("prefer_approach");
    });

    it("debt-acceptance → warn_before", () => {
        setup();
        expect(router.inferBehaviorType(
            makeSignal("sig_bh3", { signal_type: "debt-acceptance" }),
        )).toBe("warn_before");
    });

    it("unknown type → require_review", () => {
        setup();
        expect(router.inferBehaviorType(
            makeSignal("sig_bh4", { signal_type: "large-refactor" }),
        )).toBe("require_review");
    });
});
