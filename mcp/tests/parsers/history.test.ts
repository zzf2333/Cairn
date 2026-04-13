import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    parseHistoryEntry,
    sortHistoryEntries,
} from "../../src/parsers/history.js";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/.cairn/history");

describe("parseHistoryEntry", () => {
    it("parses a simple single-line-value history entry", () => {
        const content = [
            "type: decision",
            "domain: auth",
            "decision_date: 2022-12",
            "recorded_date: 2025-01",
            "summary: Adopted JWT + Refresh token pattern",
            "rejected: session-based auth",
            "reason: stateless scaling",
            "revisit_when: team grows to 10+",
        ].join("\n");

        const entry = parseHistoryEntry(content, "2022-12_jwt.md");
        expect(entry.type).toBe("decision");
        expect(entry.domain).toBe("auth");
        expect(entry.decision_date).toBe("2022-12");
        expect(entry.recorded_date).toBe("2025-01");
        expect(entry.summary).toBe("Adopted JWT + Refresh token pattern");
        expect(entry.rejected).toBe("session-based auth");
        expect(entry.reason).toBe("stateless scaling");
        expect(entry.revisit_when).toBe("team grows to 10+");
        expect(entry.filename).toBe("2022-12_jwt.md");
    });

    it("parses multi-line values with 2-space continuation", () => {
        const content = [
            "type: experiment",
            "domain: api-layer",
            "decision_date: 2023-09",
            "recorded_date: 2025-01",
            "summary: Rejected tRPC after a 2-week trial",
            "rejected: tRPC — type-safe RPC layer built on top of React Query. Two-week spike revealed that",
            "  migrating existing REST consumers (mobile app, 3 webhook integrations, 2 partner API clients)",
            "  required a coordinated, multi-client flag day release.",
            "reason: Six or more clients consumed the existing REST API surface.",
            "  Absorbing the coordination cost was not viable for a team of 2.",
            "revisit_when: New greenfield service with no existing REST consumers,",
            "  or tRPC ships a first-class REST compatibility layer.",
        ].join("\n");

        const entry = parseHistoryEntry(content, "2023-09_trpc.md");
        expect(entry.rejected).toContain("tRPC — type-safe RPC layer");
        expect(entry.rejected).toContain("migrating existing REST consumers");
        expect(entry.rejected).toContain("coordinated, multi-client flag day release.");
        expect(entry.reason).toContain("Six or more clients");
        expect(entry.reason).toContain("Absorbing the coordination cost");
        expect(entry.revisit_when).toContain("New greenfield service");
        expect(entry.revisit_when).toContain("REST compatibility layer.");
    });

    it("handles empty revisit_when field", () => {
        const content = [
            "type: decision",
            "domain: auth",
            "decision_date: 2023-01",
            "recorded_date: 2025-01",
            "summary: Added Google OAuth",
            "rejected: none",
            "reason: user demand",
            "revisit_when: ",
        ].join("\n");

        const entry = parseHistoryEntry(content, "2023-01_oauth.md");
        expect(entry.revisit_when).toBe("");
    });

    it("parses the real trpc fixture file correctly", () => {
        const content = readFileSync(
            join(FIXTURES_DIR, "2023-09_trpc-experiment-rejection.md"),
            "utf-8",
        );
        const entry = parseHistoryEntry(
            content,
            "2023-09_trpc-experiment-rejection.md",
        );

        expect(entry.type).toBe("experiment");
        expect(entry.domain).toBe("api-layer");
        expect(entry.decision_date).toBe("2023-09");
        expect(entry.recorded_date).toBe("2025-01");
        expect(entry.summary).toContain("Rejected tRPC after a 2-week trial");
        expect(entry.rejected).toContain("tRPC");
        expect(entry.rejected).toContain("mobile app");
        expect(entry.reason).toContain("Six or more clients");
        expect(entry.revisit_when).toContain("greenfield");
    });

    it("parses the real auth-debt-accepted fixture file", () => {
        const content = readFileSync(
            join(FIXTURES_DIR, "2024-01_auth-debt-accepted.md"),
            "utf-8",
        );
        const entry = parseHistoryEntry(
            content,
            "2024-01_auth-debt-accepted.md",
        );

        expect(entry.type).toBe("debt");
        expect(entry.domain).toBe("auth");
        expect(entry.decision_date).toBe("2024-01");
    });

    it("parses the real state-mgmt-transition fixture file", () => {
        const content = readFileSync(
            join(FIXTURES_DIR, "2023-03_state-mgmt-transition.md"),
            "utf-8",
        );
        const entry = parseHistoryEntry(
            content,
            "2023-03_state-mgmt-transition.md",
        );

        expect(entry.type).toBe("transition");
        expect(entry.domain).toBe("state-management");
        expect(entry.decision_date).toBe("2023-03");
    });

    it("sets raw and filename fields", () => {
        const content = "type: decision\ndomain: auth\ndecision_date: 2023-01\nrecorded_date: 2025-01\nsummary: x\nrejected: y\nreason: z\nrevisit_when: w";
        const entry = parseHistoryEntry(content, "test.md");
        expect(entry.raw).toBe(content);
        expect(entry.filename).toBe("test.md");
    });
});

describe("sortHistoryEntries", () => {
    it("sorts by decision_date ascending", () => {
        const entries = [
            { decision_date: "2024-09" },
            { decision_date: "2023-03" },
            { decision_date: "2024-01" },
            { decision_date: "2023-09" },
        ].map((e) => ({ ...e, type: "", domain: "", recorded_date: "", summary: "", rejected: "", reason: "", revisit_when: "", raw: "", filename: "" }));

        const sorted = sortHistoryEntries(entries);
        expect(sorted.map((e) => e.decision_date)).toEqual([
            "2023-03",
            "2023-09",
            "2024-01",
            "2024-09",
        ]);
    });

    it("does not mutate the original array", () => {
        const entries = [
            { decision_date: "2024-01" },
            { decision_date: "2023-01" },
        ].map((e) => ({ ...e, type: "", domain: "", recorded_date: "", summary: "", rejected: "", reason: "", revisit_when: "", raw: "", filename: "" }));

        sortHistoryEntries(entries);
        expect(entries[0]!.decision_date).toBe("2024-01"); // original unchanged
    });
});
