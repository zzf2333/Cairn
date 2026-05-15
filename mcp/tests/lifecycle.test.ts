import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCairnServer } from "../src/server.js";
import { createTestEnv } from "./test-helpers.js";
import { resolvePaths } from "../src/paths.js";
import { StateStore } from "../src/stores/state-store.js";


async function callToolJSON(
    client: Client,
    name: string,
    args: Record<string, unknown>,
): Promise<string> {
    const result = await client.callTool({ name, arguments: args });
    return (result.content as Array<{ type: string; text: string }>)[0].text;
}

async function createSession(root: string) {
    const { server } = createCairnServer(root);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "lifecycle-test", version: "1.0.0" });
    await server.connect(st);
    await client.connect(ct);
    return { client, ct, st };
}

// ═══════════════════════════════════════════════════════════════════════════
// Complete multi-session lifecycle: proves signals flow from conversation
// through trust routing into memory and back out via cairn_context.
// ═══════════════════════════════════════════════════════════════════════════

describe("Lifecycle: Multi-session full verification", { timeout: 30_000 }, () => {
    let root: string;

    beforeAll(() => {
        const env = createTestEnv();
        root = env.root;
    });

    afterAll(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("Session 1: signals → memory (L3) + staged (L2) → context reflects constraints", async () => {
        const { client, ct, st } = await createSession(root);

        try {
            // 1. Initial context is empty
            const ctx1 = JSON.parse(await callToolJSON(client, "cairn_context", {}));
            expect(ctx1.no_go).toEqual([]);
            expect(ctx1.stage.phase).toBe("growth");
            expect(ctx1.relevant_domains).toEqual([]);
            expect(ctx1.active_debt).toEqual([]);

            // 2. user-rejection → L3 auto-write to memory (not L1!)
            const sig1 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "user-rejection",
                domain: "frontend",
                details: {
                    what: "Redux",
                    reason: "Too much boilerplate",
                    rejected_alternatives: ["Redux", "MobX"],
                },
                evidence: { user_said: "Don't use Redux" },
            }));
            expect(sig1.accepted).toBe(true);
            expect(sig1.level).toBe("L3");
            expect(sig1.route).toBe("memory");

            // 3. decision → L3 auto-write to memory
            const sig2 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "decision",
                domain: "frontend",
                details: { what: "Zustand for state management" },
                evidence: { user_said: "Let's use Zustand" },
            }));
            expect(sig2.accepted).toBe(true);
            expect(sig2.level).toBe("L3");
            expect(sig2.route).toBe("memory");

            // 4. debt-acceptance → L3 auto-write to memory
            const sig3 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "debt-acceptance",
                domain: "api",
                details: {
                    what: "Hardcoded API base URL",
                    reason: "Will fix when we add staging env",
                    revisit_when: ["staging environment is set up"],
                },
                evidence: { user_said: "Leave it hardcoded for now" },
            }));
            expect(sig3.accepted).toBe(true);
            expect(sig3.level).toBe("L3");
            expect(sig3.route).toBe("memory");

            // 5. user-constraint (global scope) → L2 staged (hard rule)
            const sig4 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "user-constraint",
                domain: "api",
                details: { what: "No GraphQL" },
                evidence: { user_said: "REST only, no GraphQL" },
            }));
            expect(sig4.accepted).toBe(true);
            expect(sig4.level).toBe("L2");
            expect(sig4.route).toBe("staged");

            // 6. cairn_context now reflects the 3 memory entries
            const ctx2 = JSON.parse(await callToolJSON(client, "cairn_context", {}));

            // Redux rejection should appear as no-go (avoid_suggestion)
            const noGoSubjects = ctx2.no_go.map((n: { subject: string }) => n.subject);
            expect(noGoSubjects).toContain("Redux");

            // Zustand decision should be in relevant_domains
            expect(ctx2.relevant_domains.length).toBeGreaterThan(0);
            const frontendDomain = ctx2.relevant_domains.find(
                (d: { domain: string }) => d.domain === "frontend",
            );
            expect(frontendDomain).toBeDefined();
            expect(frontendDomain.decisions).toBeGreaterThanOrEqual(1);
            expect(frontendDomain.rejections).toBeGreaterThanOrEqual(1);

            // Debt should appear
            expect(ctx2.active_debt.length).toBe(1);
            expect(ctx2.active_debt[0].subject).toBe("Hardcoded API base URL");

            // Staged warning
            expect(ctx2.warnings.some((w: string) => w.includes("staged"))).toBe(true);

            // 7. Status reflects correct counts
            const status = JSON.parse(await callToolJSON(client, "cairn_status", {}));
            expect(status.memory_count).toBe(3);
            expect(status.staged_count).toBe(1);

            // 8. cairn_plan returns constraints for frontend work
            const plan = JSON.parse(await callToolJSON(client, "cairn_plan", {
                task: "Add a new frontend component",
            }));
            expect(plan.historical_constraints.length).toBeGreaterThan(0);

            // 9. End session
            const end = JSON.parse(await callToolJSON(client, "cairn_session_end", {
                summary: "Set up frontend state management with Zustand, rejected Redux",
                changed_domains: ["frontend", "api"],
                decisions_made: ["Zustand for state", "No Redux", "Hardcoded API URL as debt"],
            }));
            expect(end.views_regenerated).toBe(true);

            // 10. Verify disk artifacts
            const paths = resolvePaths(root);
            const sessionFiles = readdirSync(paths.sessionsDir).filter(f => f.endsWith(".yaml"));
            expect(sessionFiles.length).toBe(1);

            const outputMd = readFileSync(join(paths.viewsDir, "output.md"), "utf-8");
            expect(outputMd).toContain("Redux");
            expect(outputMd).toContain("no-go");

            expect(existsSync(join(paths.viewsDir, "stage.md"))).toBe(true);
        } finally {
            await ct.close();
            await st.close();
        }
    });

    it("Session 2: persistence + staged review → memory promotion", async () => {
        const { client, ct, st } = await createSession(root);

        try {
            // 1. Constraints survive server restart
            const ctx = JSON.parse(await callToolJSON(client, "cairn_context", {}));
            expect(ctx.no_go.length).toBeGreaterThanOrEqual(1);
            const noGoSubjects = ctx.no_go.map((n: { subject: string }) => n.subject);
            expect(noGoSubjects).toContain("Redux");

            expect(ctx.active_debt.length).toBe(1);
            expect(ctx.relevant_domains.length).toBeGreaterThan(0);

            // 2. Staged entry from Session 1 is still pending
            const pending = JSON.parse(await callToolJSON(client, "cairn_review", {
                action: "list",
            }));
            expect(pending.length).toBe(1);
            expect(pending[0].review_status).toBe("pending");
            const stagedId = pending[0].id;

            // 3. Accept the staged entry → promotes to memory
            const acceptResult = JSON.parse(await callToolJSON(client, "cairn_review", {
                action: "accept",
                id: stagedId,
            }));
            expect(acceptResult.accepted).toBe(true);

            // 4. cairn_context now includes the accepted constraint
            const ctx2 = JSON.parse(await callToolJSON(client, "cairn_context", {}));
            expect(ctx2.no_go.length).toBeGreaterThanOrEqual(2);
            const noGoSubjects2 = ctx2.no_go.map((n: { subject: string }) => n.subject);
            expect(noGoSubjects2).toContain("No GraphQL");

            // 5. No more staged entries
            expect(ctx2.warnings.every((w: string) => !w.includes("staged"))).toBe(true);

            // 6. Doctor health check
            const doctor = JSON.parse(await callToolJSON(client, "cairn_doctor", {}));
            expect(doctor.config_status).toBe("ok");
            expect(doctor.conflicts).toEqual([]);

            // 7. Memory tool shows all entries
            const memories = JSON.parse(await callToolJSON(client, "cairn_memory", {
                action: "list",
            }));
            expect(memories.length).toBe(4);

            // 8. End second session
            const end = JSON.parse(await callToolJSON(client, "cairn_session_end", {
                summary: "Reviewed and accepted GraphQL constraint",
                changed_domains: ["api"],
            }));
            expect(end.views_regenerated).toBe(true);

            // 9. Two session records on disk
            const paths = resolvePaths(root);
            const sessionFiles = readdirSync(paths.sessionsDir).filter(f => f.endsWith(".yaml"));
            expect(sessionFiles.length).toBe(2);

            // 10. State tracks latest session
            const stateStore = new StateStore(paths.stateYaml);
            const state = stateStore.load();
            expect(state.last_session_at).not.toBeNull();
        } finally {
            await ct.close();
            await st.close();
        }
    });

    it("Session 3: domain filtering + duplicate merging", async () => {
        const { client, ct, st } = await createSession(root);

        try {
            // 1. Filtered context by task
            const ctx = JSON.parse(await callToolJSON(client, "cairn_context", {
                task: "Refactor frontend components",
                files: ["src/components/App.tsx"],
            }));
            expect(ctx.no_go.length).toBeGreaterThanOrEqual(2);
            expect(ctx.relevant_domains.some(
                (d: { domain: string }) => d.domain === "frontend",
            )).toBe(true);

            // 2. Duplicate signal → merges into existing memory (L0)
            const dup = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "user-rejection",
                domain: "frontend",
                details: { what: "Redux" },
                evidence: { user_said: "Still no Redux" },
            }));
            expect(dup.level).toBe("L0");
            expect(dup.route).toBe("dropped");
            expect(dup.reason).toContain("Merged");

            // 3. Memory count unchanged after duplicate
            const status = JSON.parse(await callToolJSON(client, "cairn_status", {}));
            expect(status.memory_count).toBe(4);
        } finally {
            await ct.close();
            await st.close();
        }
    });
});
