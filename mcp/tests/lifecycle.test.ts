import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCairnServer } from "../src/server.js";
import { createTestEnv } from "./test-helpers.js";
import { StagedStore } from "../src/stores/staged-store.js";
import { MemoryEngine } from "../src/engines/memory-engine.js";
import { MemoryStore } from "../src/stores/memory-store.js";
import { ViewsEngine } from "../src/engines/views-engine.js";
import { StateStore } from "../src/stores/state-store.js";
import { resolvePaths } from "../src/paths.js";


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
// Complete multi-session lifecycle test.
//
// Proves the full Cairn loop works end-to-end:
//   Session 1: empty project → signal capture → human review → memory →
//              context enriched → plan queries → session end
//   Session 2: new server on same dir → persistence verified →
//              new signals → doctor health check → session end
//   CLI:       status + doctor commands reflect accumulated state
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

    // ─── Session 1 ─────────────────────────────────────────────────────────

    it("Session 1: empty → signals → review → context enriched → session end", async () => {
        const { client, ct, st } = await createSession(root);

        try {
            // 1. Initial context is empty
            const ctx1 = JSON.parse(await callToolJSON(client, "cairn_context", {}));
            expect(ctx1.no_go).toEqual([]);
            expect(ctx1.stage.phase).toBe("growth");
            expect(ctx1.relevant_domains).toEqual([]);
            expect(ctx1.active_debt).toEqual([]);
            expect(ctx1.warnings).toEqual([]);

            // 2. user-constraint → scope:"global" → hard L2 (staged)
            const sig1 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "user-constraint",
                domain: "api-layer",
                details: { what: "No GraphQL" },
                evidence: { user_said: "We stay REST-only" },
            }));
            expect(sig1.accepted).toBe(true);
            expect(sig1.level).toBe("L2");
            expect(sig1.route).toBe("staged");

            // 3. Second user-constraint in different domain → also L2
            const sig2 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "user-constraint",
                domain: "testing",
                details: { what: "No mocking databases" },
                evidence: { user_said: "Real DB in tests, always" },
            }));
            expect(sig2.accepted).toBe(true);
            expect(sig2.level).toBe("L2");

            // 4. user-rejection → scope:"local" → L1 (signals pool)
            const sig3 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "user-rejection",
                domain: "api-layer",
                details: {
                    what: "ORM library",
                    rejected_alternatives: ["TypeORM", "Prisma"],
                },
                evidence: { user_said: "We use raw SQL" },
            }));
            expect(sig3.accepted).toBe(true);
            expect(sig3.level).toBe("L1");
            expect(sig3.route).toBe("signals");

            // 5. decision → scope:"local" → L1
            const sig4 = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "decision",
                domain: "api-layer",
                details: { what: "REST with OpenAPI spec" },
                evidence: { user_said: "OpenAPI first" },
            }));
            expect(sig4.accepted).toBe(true);
            expect(sig4.level).toBe("L1");

            // 6. Status reflects 2 staged + 2 L1 signals
            const status = JSON.parse(await callToolJSON(client, "cairn_status", {}));
            expect(status.staged_count).toBe(2);
            expect(status.signals_count).toBeGreaterThanOrEqual(2);
            expect(status.memory_count).toBe(0);

            // 7. Accept all staged entries (simulates `cairn review`)
            const paths = resolvePaths(root);
            const stagedStore = new StagedStore(paths.stagedDir);
            const pending = stagedStore.loadPending();
            expect(pending.length).toBe(2);

            const memoryStore = new MemoryStore(paths.memoryDir);
            const stateStore = new StateStore(paths.stateYaml);
            const viewsEngine = new ViewsEngine(paths, memoryStore, stateStore);
            const memoryEngine = new MemoryEngine(memoryStore, viewsEngine);

            for (const entry of pending) {
                const memory = stagedStore.accept(entry.id);
                expect(memory).not.toBeNull();
                memoryEngine.write(memory!);
            }

            // 8. Context now includes no-go constraints (both have global scope)
            const ctx2 = JSON.parse(await callToolJSON(client, "cairn_context", {}));
            expect(ctx2.no_go.length).toBe(2);
            const noGoSubjects = ctx2.no_go.map((n: { subject: string }) => n.subject);
            expect(noGoSubjects).toContain("No GraphQL");
            expect(noGoSubjects).toContain("No mocking databases");

            // 9. Relevant domains now populated
            expect(ctx2.relevant_domains.length).toBeGreaterThan(0);
            const apiDomain = ctx2.relevant_domains.find(
                (d: { domain: string }) => d.domain === "api-layer",
            );
            expect(apiDomain).toBeDefined();
            expect(apiDomain.memory_count).toBeGreaterThanOrEqual(1);

            // 10. cairn_plan returns historical constraints (read-only, never writes)
            const plan = JSON.parse(await callToolJSON(client, "cairn_plan", {
                task: "Design api-layer REST routes",
            }));
            expect(plan.task).toBe("Design api-layer REST routes");
            expect(plan.historical_constraints.length).toBeGreaterThan(0);

            // Verify plan didn't write anything (read-only guarantee)
            const statusAfterPlan = JSON.parse(
                await callToolJSON(client, "cairn_status", {}),
            );
            expect(statusAfterPlan.memory_count).toBe(2);

            // 11. End session
            const end = JSON.parse(await callToolJSON(client, "cairn_session_end", {
                summary: "Established API constraints and testing strategy",
                changed_domains: ["api-layer", "testing"],
                decisions_made: ["No GraphQL", "No DB mocking", "REST + OpenAPI"],
            }));
            expect(end.views_regenerated).toBe(true);

            // 12. Verify disk artifacts
            const sessionFiles = readdirSync(paths.sessionsDir).filter(
                (f) => f.endsWith(".yaml"),
            );
            expect(sessionFiles.length).toBe(1);

            const sessionRecord = readFileSync(
                join(paths.sessionsDir, sessionFiles[0]),
                "utf-8",
            );
            expect(sessionRecord).toContain("API constraints");

            const outputMd = readFileSync(join(paths.viewsDir, "output.md"), "utf-8");
            expect(outputMd).toContain("no-go");

            expect(existsSync(join(paths.viewsDir, "stage.md"))).toBe(true);
        } finally {
            await ct.close();
            await st.close();
        }
    });

    // ─── Session 2 ─────────────────────────────────────────────────────────

    it("Session 2: persistence across server restart → doctor → second session", async () => {
        // Brand new server instance, same root — proves persistence through filesystem
        const { client, ct, st } = await createSession(root);

        try {
            // 1. No-go constraints survive server restart
            const ctx = JSON.parse(await callToolJSON(client, "cairn_context", {}));
            expect(ctx.no_go.length).toBe(2);
            expect(ctx.stage.phase).toBeDefined();
            expect(ctx.relevant_domains.length).toBeGreaterThan(0);

            // 2. New constraint in a different domain
            const sig = JSON.parse(await callToolJSON(client, "cairn_signal", {
                type: "user-constraint",
                domain: "deployment",
                details: { what: "Docker only, no Kubernetes" },
                evidence: { user_said: "K8s is overkill for us" },
            }));
            expect(sig.accepted).toBe(true);
            expect(sig.level).toBe("L2");

            // 3. Doctor reports system health
            const doctor = JSON.parse(await callToolJSON(client, "cairn_doctor", {}));
            expect(doctor.config_status).toBe("ok");
            expect(doctor.output_tokens.status).not.toBe("missing");
            expect(doctor.conflicts).toEqual([]);
            expect(doctor).toHaveProperty("staged_backlog");
            expect(doctor).toHaveProperty("orphan_no_go");
            expect(doctor).toHaveProperty("stale_domains");
            expect(doctor).toHaveProperty("todos_in_memory");

            // 4. End second session
            const end = JSON.parse(await callToolJSON(client, "cairn_session_end", {
                summary: "Added deployment constraints, verified system health",
                changed_domains: ["deployment"],
                decisions_made: ["Docker only"],
            }));
            expect(end.views_regenerated).toBe(true);

            // 5. Two session records on disk
            const paths = resolvePaths(root);
            const sessionFiles = readdirSync(paths.sessionsDir).filter(
                (f) => f.endsWith(".yaml"),
            );
            expect(sessionFiles.length).toBe(2);

            // 6. State tracks latest session
            const stateStore = new StateStore(paths.stateYaml);
            const state = stateStore.load();
            expect(state.last_session_at).not.toBeNull();
        } finally {
            await ct.close();
            await st.close();
        }
    });

    // ─── Session 3: context filtering ──────────────────────────────────────

    it("Session 3: context domain filtering with task and files", async () => {
        const { client, ct, st } = await createSession(root);

        try {
            // Filtered by task keyword matching domain "api-layer"
            const ctx = JSON.parse(await callToolJSON(client, "cairn_context", {
                task: "Refactor api-layer routes",
                files: ["src/api/routes.ts"],
            }));

            // no_go is global — always returned regardless of domain filter
            expect(ctx.no_go.length).toBe(2);

            // relevant_domains should include api-layer
            expect(ctx.relevant_domains.some(
                (d: { domain: string }) => d.domain === "api-layer",
            )).toBe(true);
        } finally {
            await ct.close();
            await st.close();
        }
    });

});
