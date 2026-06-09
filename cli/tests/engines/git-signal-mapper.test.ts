import { describe, it, expect } from "vitest";
import { mapGitSignalToEvent } from "../../src/engines/git-signal-mapper.js";
import { inferDomainFromFiles } from "../../src/engines/git-ear.js";
import type { GitSignal } from "../../src/schemas/index.js";
import { makeSkeletonNode } from "../test-helpers.js";

const NOW = "2026-05-16T10:00:00Z";

function makeGitSignal(overrides: Partial<GitSignal> & Pick<GitSignal, "signal_type">): GitSignal {
    return {
        id: overrides.id ?? `sig_test_${overrides.signal_type}`,
        signal_type: overrides.signal_type,
        raw_data: overrides.raw_data ?? {},
        inferred_gravity: overrides.inferred_gravity ?? "G1",
        inferred_domain: overrides.inferred_domain ?? "api-layer",
        inferred_domain_confidence: overrides.inferred_domain_confidence,
        confidence: overrides.confidence ?? 0.8,
        captured_at: overrides.captured_at ?? NOW,
    };
}

describe("mapGitSignalToEvent", () => {
    it("maps revert to a rejection event with warn_before effect", () => {
        const sig = makeGitSignal({
            signal_type: "revert",
            raw_data: { commits: ["abc1234567"] },
            inferred_gravity: "G2",
        });
        const event = mapGitSignalToEvent(sig, NOW);
        expect(event).not.toBeNull();
        expect(event!.type).toBe("rejection");
        expect(event!.behavior_effect.type).toBe("warn_before");
        expect(event!.source.type).toBe("git_revert");
        expect(event!.source.refs[0]).toEqual({ type: "commit", id: "abc1234567" });
        expect(event!.gravity.level).toBe("G2");
    });

    it("maps dependency_removed to a transition + avoid_suggestion", () => {
        const sig = makeGitSignal({
            signal_type: "dependency_removed",
            raw_data: { packages: { removed: ["mongodb"] } },
        });
        const event = mapGitSignalToEvent(sig, NOW);
        expect(event).not.toBeNull();
        expect(event!.type).toBe("transition");
        expect(event!.subject.name).toBe("mongodb");
        expect(event!.subject.type).toBe("dependency");
        expect(event!.behavior_effect.type).toBe("avoid_suggestion");
        expect(event!.source.type).toBe("git_dependency");
    });

    it("returns null for dependency_removed when packages.removed is empty", () => {
        const sig = makeGitSignal({
            signal_type: "dependency_removed",
            raw_data: { packages: { removed: [] } },
        });
        expect(mapGitSignalToEvent(sig, NOW)).toBeNull();
    });

    it("maps dependency_replaced with rejected_paths and aliases", () => {
        const sig = makeGitSignal({
            signal_type: "dependency_replaced",
            raw_data: { packages: { replaced: [{ from: "axios", to: "fetch" }] } },
        });
        const event = mapGitSignalToEvent(sig, NOW);
        expect(event).not.toBeNull();
        expect(event!.type).toBe("transition");
        expect(event!.subject.name).toBe("fetch");
        expect(event!.subject.aliases).toContain("axios");
        expect(event!.rejected_paths[0]).toEqual({ path: "axios", reason: "replaced by fetch" });
        expect(event!.behavior_effect.type).toBe("prefer_approach");
    });

    it("drops large_refactor when file count is the only evidence", () => {
        const sig = makeGitSignal({
            signal_type: "large_refactor",
            raw_data: {
                commits: ["aaa1111"],
                files_changed: ["src/misc/foo.ts", "src/misc/bar.ts", "src/misc/baz.ts"],
            },
            inferred_gravity: "G2",
        });
        const event = mapGitSignalToEvent(sig, NOW);
        expect(event).toBeNull();
    });

    it("drops docs/config-only large_refactor without architecture message", () => {
        const sig = makeGitSignal({
            signal_type: "large_refactor",
            raw_data: {
                commits: ["aaa1111"],
                files_changed: ["AGENTS.md", "CLAUDE.md", ".gitignore", "docs/readme.md"],
            },
            inferred_domain: "frontend",
            inferred_gravity: "G2",
        });
        expect(mapGitSignalToEvent(sig, NOW)).toBeNull();
    });

    it("maps semantic frontend migration refactor with evidence metadata", () => {
        const sig = makeGitSignal({
            signal_type: "large_refactor",
            raw_data: {
                commits: ["aaa1111"],
                commit_message: "feat: migrate frontend from Next.js to Vite",
                files_changed: [
                    "apps/web/src/main.tsx",
                    "apps/web/src/routes/index.tsx",
                    "apps/web/vite.config.ts",
                    "apps/web/package.json",
                ],
                domain_evidence: ["owns:apps/web/src/main.tsx"],
            },
            inferred_domain: "frontend",
            inferred_domain_confidence: 0.95,
            inferred_gravity: "G2",
        });
        const event = mapGitSignalToEvent(sig, NOW);
        expect(event).not.toBeNull();
        expect(event!.type).toBe("architecture_decision");
        expect(event!.subject.name).toContain("frontend");
        expect(event!.behavior_effect.type).toBe("require_review");
        expect(event!.reasoning).toContain("architecture-like commit message");
        expect(event!.evidence?.source_signal_id).toBe(sig.id);
        expect(event!.evidence?.mapper_version).toBe("git-signal-mapper:v2");
        expect(event!.evidence?.domain_confidence).toBe(0.95);
    });

    it("uses 'global' domain when inferred_domain is missing", () => {
        const sig: GitSignal = {
            id: "sig_test_no_domain",
            signal_type: "revert",
            raw_data: { commits: ["abcdef0"] },
            inferred_gravity: "G1",
            confidence: 0.8,
            captured_at: NOW,
        };
        const event = mapGitSignalToEvent(sig, NOW);
        expect(event!.domain).toBe("global");
    });
});

describe("inferDomainFromFiles", () => {
    const nodes = [
        makeSkeletonNode("frontend", {
            owns: ["apps/web/"],
            does_not_own: ["apps/server/"],
            causal_keywords: ["react", "component", "route", "ui"],
        }),
        makeSkeletonNode("runtime", {
            owns: ["apps/server/src/runtime/"],
            does_not_own: ["apps/web/"],
            causal_keywords: ["runtime", "leader", "worker"],
        }),
        makeSkeletonNode("queue", {
            owns: ["apps/server/src/queue/"],
            does_not_own: ["apps/server/src/runtime/"],
            causal_keywords: ["queue", "bullmq"],
        }),
    ];

    it("uses skeleton ownership paths before broad keywords", () => {
        const result = inferDomainFromFiles(["apps/server/src/runtime/loop.ts"], nodes);
        expect(result.domain).toBe("runtime");
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        expect(result.evidence[0]).toContain("owns:");
    });

    it("does not map docs and global config files to frontend", () => {
        const result = inferDomainFromFiles(["docs/design/frontend-prd.md", "AGENTS.md", ".gitignore"], nodes);
        expect(result.domain).toBe("global");
    });

    it("returns multi when frontend and runtime ownership are balanced", () => {
        const result = inferDomainFromFiles([
            "apps/web/src/main.tsx",
            "apps/server/src/runtime/loop.ts",
        ], nodes);
        expect(result.domain).toBe("multi");
    });
});
