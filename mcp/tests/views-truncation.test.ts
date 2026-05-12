import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createTestEnv, makeMemory } from "./test-helpers.js";
import { approxTokens } from "../src/tokens.js";
import type { CairnContext } from "../src/server.js";

describe("ViewsEngine — token truncation", () => {
    let ctx: CairnContext;
    let root: string;

    beforeEach(() => {
        const env = createTestEnv();
        ctx = env.ctx;
        root = env.root;
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it("truncates output.md when exceeding 800 token hard limit", () => {
        for (let i = 0; i < 35; i++) {
            ctx.memoryStore.save(
                makeMemory(`mem_long_${i}`, {
                    domain: "api-layer",
                    subject: { name: `Decision-${i}-about-a-very-long-subject-name` },
                    summary: `This is a very long summary for memory entry ${i} that describes an important architectural decision made during the project development process with additional padding text to inflate token count significantly`,
                }),
            );
        }

        ctx.viewsEngine.regenerate();

        const content = readFileSync(
            join(ctx.paths.viewsDir, "output.md"),
            "utf-8",
        );
        expect(approxTokens(content)).toBeLessThanOrEqual(800);
    });

    it("preserves no-go section during truncation", () => {
        ctx.memoryStore.save(
            makeMemory("mem_nogo_trunc", {
                type: "rejection",
                subject: { name: "tRPC" },
                behavior_effect: {
                    type: "avoid_suggestion",
                    instruction: "Do not suggest tRPC migration",
                },
            }),
        );

        for (let i = 0; i < 35; i++) {
            ctx.memoryStore.save(
                makeMemory(`mem_stack_${i}`, {
                    domain: "api-layer",
                    subject: { name: `Stack-Decision-${i}` },
                    summary: `Long summary for stack entry ${i} with padding text to push the total token count past the hard limit and trigger truncation behavior in the views engine`,
                }),
            );
        }

        ctx.viewsEngine.regenerate();

        const content = readFileSync(
            join(ctx.paths.viewsDir, "output.md"),
            "utf-8",
        );
        expect(content).toContain("tRPC");
        expect(content).toContain("Do not suggest tRPC migration");
    });

    it("preserves stage section during truncation", () => {
        for (let i = 0; i < 35; i++) {
            ctx.memoryStore.save(
                makeMemory(`mem_stage_${i}`, {
                    domain: "api-layer",
                    subject: { name: `Stage-Decision-${i}` },
                    summary: `Long summary for entry ${i} that adds enough text to trigger the truncation logic in the views engine and ensure the stage section is preserved`,
                }),
            );
        }

        ctx.viewsEngine.regenerate();

        const content = readFileSync(
            join(ctx.paths.viewsDir, "output.md"),
            "utf-8",
        );
        expect(content).toContain("## stage");
        expect(content).toContain("phase: growth");
    });

    it("truncates domain views when > 500 tokens", () => {
        for (let i = 0; i < 40; i++) {
            ctx.memoryStore.save(
                makeMemory(`mem_dom_${i}`, {
                    domain: "api-layer",
                    subject: { name: `Domain-Entry-${i}-with-long-name` },
                    summary: `Very detailed summary for domain entry ${i} describing why this particular architectural decision was made and what alternatives were considered during the lengthy design process`,
                }),
            );
        }

        ctx.viewsEngine.regenerate();

        const domainContent = readFileSync(
            join(ctx.paths.viewsDomainsDir, "api-layer.md"),
            "utf-8",
        );
        expect(approxTokens(domainContent)).toBeLessThanOrEqual(500);
    });

    it("does not truncate when under limit", () => {
        ctx.memoryStore.save(
            makeMemory("mem_small_1", {
                subject: { name: "REST" },
                summary: "Use REST for APIs",
            }),
        );
        ctx.memoryStore.save(
            makeMemory("mem_small_2", {
                subject: { name: "JWT" },
                summary: "Use JWT for auth",
                domain: "auth",
            }),
        );

        ctx.viewsEngine.regenerate();

        const content = readFileSync(
            join(ctx.paths.viewsDir, "output.md"),
            "utf-8",
        );
        expect(content).toContain("REST");
        expect(content).toContain("Use REST for APIs");
        expect(content).toContain("JWT");
        expect(content).toContain("Use JWT for auth");
    });

    it("generates empty sections gracefully with 0 memories", () => {
        ctx.viewsEngine.regenerate();

        const content = readFileSync(
            join(ctx.paths.viewsDir, "output.md"),
            "utf-8",
        );
        expect(content).toContain("## stage");
        expect(content).toContain("## no-go");
        expect(content).toContain("(none)");
    });
});
