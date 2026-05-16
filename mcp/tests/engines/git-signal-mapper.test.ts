import { describe, it, expect } from "vitest";
import { mapGitSignalToEvent } from "../../src/engines/git-signal-mapper.js";
import type { GitSignal } from "../../src/schemas/index.js";

const NOW = "2026-05-16T10:00:00Z";

function makeGitSignal(overrides: Partial<GitSignal> & Pick<GitSignal, "signal_type">): GitSignal {
    return {
        id: overrides.id ?? `sig_test_${overrides.signal_type}`,
        signal_type: overrides.signal_type,
        raw_data: overrides.raw_data ?? {},
        inferred_gravity: overrides.inferred_gravity ?? "G1",
        inferred_domain: overrides.inferred_domain ?? "api-layer",
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

    it("maps large_refactor to an architecture_decision", () => {
        const sig = makeGitSignal({
            signal_type: "large_refactor",
            raw_data: {
                commits: ["aaa1111"],
                files_changed: ["src/api/foo.ts", "src/api/bar.ts", "src/api/baz.ts"],
            },
            inferred_gravity: "G2",
        });
        const event = mapGitSignalToEvent(sig, NOW);
        expect(event).not.toBeNull();
        expect(event!.type).toBe("architecture_decision");
        expect(event!.subject.name).toContain("src");
        expect(event!.behavior_effect.type).toBe("prefer_approach");
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
