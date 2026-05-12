import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
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

const execFileP = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_BIN = join(__dirname, "..", "dist", "cli.js");

// ─── Section 1: CLI binary ─────────────────────────────────────────────────

describe("E2E: CLI binary", () => {
    it("cairn version outputs the package version", async () => {
        const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
        const { stdout } = await execFileP("node", [CLI_BIN, "version"]);
        expect(stdout.trim()).toBe(`cairn ${pkg.version}`);
    });

    it("cairn help outputs usage with all commands", async () => {
        const { stdout } = await execFileP("node", [CLI_BIN, "help"]);
        expect(stdout).toContain("Commands:");
        for (const cmd of ["init", "status", "review", "doctor", "stage", "memory", "version"]) {
            expect(stdout).toContain(cmd);
        }
    });

    it("cairn status succeeds with .cairn/ directory", async () => {
        const { root } = createTestEnv();
        try {
            const { stdout } = await execFileP("node", [CLI_BIN, "status"], { cwd: root });
            expect(stdout).toContain("Cairn Status");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("cairn status without .cairn/ exits with error", async () => {
        const tmp = join(tmpdir(), `cairn-e2e-nocairn-${Date.now()}`);
        mkdirSync(tmp, { recursive: true });
        try {
            await expect(
                execFileP("node", [CLI_BIN, "status"], { cwd: tmp }),
            ).rejects.toThrow();
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    });
});

// ─── Section 2: MCP Server via InMemoryTransport ────────────────────────────

describe("E2E: MCP server via transport", { timeout: 15_000 }, () => {
    let client: Client;
    let clientTransport: InstanceType<typeof InMemoryTransport>;
    let serverTransport: InstanceType<typeof InMemoryTransport>;
    let root: string;

    beforeEach(async () => {
        const env = createTestEnv();
        root = env.root;
        const { server } = createCairnServer(root);
        [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        client = new Client({ name: "e2e-test", version: "1.0.0" });
        await server.connect(serverTransport);
        await client.connect(clientTransport);
    });

    afterEach(async () => {
        await clientTransport.close();
        await serverTransport.close();
        rmSync(root, { recursive: true, force: true });
    });

    it("server identifies as cairn with correct version", () => {
        const info = client.getServerVersion();
        expect(info?.name).toBe("cairn");
        expect(info?.version).toBe("0.2.0");
    });

    it("listTools returns all 6 registered tools", async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name).sort();
        expect(names).toEqual([
            "cairn_context",
            "cairn_doctor",
            "cairn_plan",
            "cairn_session_end",
            "cairn_signal",
            "cairn_status",
        ]);
    });

    it("cairn_status returns valid JSON with counts", async () => {
        const result = await client.callTool({ name: "cairn_status", arguments: {} });
        expect(result.isError).toBeFalsy();
        const text = (result.content as Array<{ type: string; text: string }>)[0].text;
        const status = JSON.parse(text);
        expect(status).toHaveProperty("memory_count");
        expect(status).toHaveProperty("staged_count");
        expect(status).toHaveProperty("signals_count");
        expect(status.memory_count).toBe(0);
    });

    it("cairn_context returns empty context for fresh project", async () => {
        const result = await client.callTool({ name: "cairn_context", arguments: {} });
        const text = (result.content as Array<{ type: string; text: string }>)[0].text;
        const ctx = JSON.parse(text);
        expect(ctx.no_go).toEqual([]);
        expect(ctx.stage.phase).toBe("growth");
    });

    it("cairn_signal accepts a signal and returns routing result", async () => {
        const result = await client.callTool({
            name: "cairn_signal",
            arguments: {
                type: "user-rejection",
                domain: "api-layer",
                details: { what: "GraphQL migration" },
                evidence: { user_said: "Too complex for our team" },
            },
        });
        const data = JSON.parse(
            (result.content as Array<{ type: string; text: string }>)[0].text,
        );
        expect(data.accepted).toBe(true);
        expect(["L1", "L2", "L3"]).toContain(data.level);
    });
});

// ─── Section 3: Full pipeline E2E ──────────────────────────────────────────

describe("E2E: Full pipeline signal → memory → context", { timeout: 15_000 }, () => {
    it("signal → staged → accept → context returns constraint → session_end", async () => {
        const { root } = createTestEnv();

        const { server } = createCairnServer(root);
        const [ct, st] = InMemoryTransport.createLinkedPair();
        const client = new Client({ name: "e2e-pipeline", version: "1.0.0" });
        await server.connect(st);
        await client.connect(ct);

        try {
            // 1. Context is empty initially
            const ctx1 = JSON.parse(await callToolJSON(client, "cairn_context", {}));
            expect(ctx1.no_go).toEqual([]);

            // 2. Send user-constraint signal (global scope → L2 staged)
            const sig = await callToolJSON(client, "cairn_signal", {
                type: "user-constraint",
                domain: "api-layer",
                details: { what: "No GraphQL" },
                evidence: { user_said: "We stay REST-only" },
            });
            const sigData = JSON.parse(sig);
            expect(sigData.accepted).toBe(true);
            expect(sigData.level).toBe("L2");

            // 3. Accept staged entry (simulating `cairn review` accept)
            const paths = resolvePaths(root);
            const stagedStore = new StagedStore(paths.stagedDir);
            const pending = stagedStore.loadPending();
            expect(pending.length).toBeGreaterThan(0);

            const memoryStore = new MemoryStore(paths.memoryDir);
            const stateStore = new StateStore(paths.stateYaml);
            const viewsEngine = new ViewsEngine(paths, memoryStore, stateStore);
            const memoryEngine = new MemoryEngine(memoryStore, viewsEngine);

            const memory = stagedStore.accept(pending[0].id);
            expect(memory).not.toBeNull();
            memoryEngine.write(memory!);

            // 4. Context now includes the constraint
            const ctx2 = await callToolJSON(client, "cairn_context", {});
            expect(ctx2).toContain("GraphQL");

            // 5. End session
            const endData = JSON.parse(
                await callToolJSON(client, "cairn_session_end", {
                    summary: "E2E test session",
                    changed_domains: ["api-layer"],
                    decisions_made: ["No GraphQL"],
                }),
            );
            expect(endData.views_regenerated).toBe(true);

            // 6. Session record written to disk
            const sessionFiles = readdirSync(paths.sessionsDir).filter((f) =>
                f.endsWith(".yaml"),
            );
            expect(sessionFiles.length).toBe(1);

            // 7. Views regenerated with constraint content
            const outputMd = readFileSync(join(paths.viewsDir, "output.md"), "utf-8");
            expect(outputMd).toContain("no-go");
        } finally {
            await ct.close();
            await st.close();
            rmSync(root, { recursive: true, force: true });
        }
    });
});

async function callToolJSON(
    client: Client,
    name: string,
    args: Record<string, unknown>,
): Promise<string> {
    const result = await client.callTool({ name, arguments: args });
    return (result.content as Array<{ type: string; text: string }>)[0].text;
}
