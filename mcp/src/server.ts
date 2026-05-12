import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolvePaths, type CairnPaths } from "./paths.js";
import { formatToolError, toolResult } from "./errors.js";
import { MemoryStore } from "./stores/memory-store.js";
import { SignalStore } from "./stores/signal-store.js";
import { StagedStore } from "./stores/staged-store.js";
import { StateStore } from "./stores/state-store.js";
import { ViewsEngine } from "./engines/views-engine.js";
import { TrustRouter } from "./engines/trust-router.js";
import { GitEar } from "./engines/git-ear.js";
import { StageEngine } from "./engines/stage-engine.js";
import { MemoryEngine } from "./engines/memory-engine.js";
import { handleCairnContext } from "./tools/cairn-context.js";
import { handleCairnSignal } from "./tools/cairn-signal.js";
import { handleCairnSessionEnd } from "./tools/cairn-session-end.js";
import { handleCairnStatus } from "./tools/cairn-status.js";
import { handleCairnPlan } from "./tools/cairn-plan.js";
import { handleCairnDoctor } from "./tools/cairn-doctor.js";
import {
    SIGNAL_TYPES,
    MEMORY_TYPES,
    BEHAVIOR_EFFECT_TYPES,
} from "./schemas/index.js";
import type { Config } from "./schemas/config.js";

export interface CairnContext {
    paths: CairnPaths;
    memoryStore: MemoryStore;
    signalStore: SignalStore;
    stagedStore: StagedStore;
    stateStore: StateStore;
    viewsEngine: ViewsEngine;
    trustRouter: TrustRouter;
    gitEar: GitEar;
    stageEngine: StageEngine;
    memoryEngine: MemoryEngine;
}

export function createCairnContext(startDir?: string): CairnContext {
    const paths = resolvePaths(startDir);
    const memoryStore = new MemoryStore(paths.memoryDir);
    const signalStore = new SignalStore(paths.signalsDir);
    const stagedStore = new StagedStore(paths.stagedDir);
    const stateStore = new StateStore(paths.stateYaml);
    const viewsEngine = new ViewsEngine(paths, memoryStore, stateStore);
    const memoryEngine = new MemoryEngine(memoryStore, viewsEngine);
    const trustRouter = new TrustRouter(
        memoryStore,
        signalStore,
        stagedStore,
        memoryEngine,
        stateStore,
    );
    const gitEar = new GitEar(paths.root);
    const stageEngine = new StageEngine();

    return {
        paths,
        memoryStore,
        signalStore,
        stagedStore,
        stateStore,
        viewsEngine,
        trustRouter,
        gitEar,
        stageEngine,
        memoryEngine,
    };
}

export async function runStartupGitScan(ctx: CairnContext): Promise<void> {
    try {
        const state = ctx.stateStore.load();
        const signals = await ctx.gitEar.scanSinceLastSession(
            state.last_session_commit,
        );

        if (signals.length > 0) {
            let config: Config;
            try {
                config = ctx.stateStore.loadConfig(ctx.paths.configYaml);
            } catch {
                config = {
                    version: "2.0",
                    project: {
                        name: "unknown",
                        created: new Date().toISOString().slice(0, 7),
                    },
                    domains: { locked: [] },
                    trust_policy: {
                        L3_auto_write: [],
                        L2_staged: [],
                        never_auto: [],
                    },
                    stage: { override: null, auto_constraint: false },
                };
            }

            for (const signal of signals) {
                ctx.trustRouter.route(signal, config);
            }
        }

        const head = await ctx.gitEar.getHeadCommit();
        if (head) {
            ctx.stateStore.updateLastGitScan(head);
        }
    } catch {
        // Non-fatal: server works fine without git scan
    }
}

export function createCairnServer(
    startDir?: string,
): { server: McpServer; runStartupScan: () => Promise<void> } {
    const server = new McpServer({
        name: "cairn",
        version: "2.0.0-alpha.0",
    });

    let ctx: CairnContext | null = null;

    function getCtx(): CairnContext {
        if (!ctx) {
            ctx = createCairnContext(startDir);
        }
        return ctx;
    }

    // cairn_context — stable
    server.registerTool(
        "cairn_context",
        {
            title: "Get Cairn Constraint Context",
            description:
                "Get project memory constraints before working. " +
                "Returns: stage advisory, no-go list, relevant domain summaries, active debts, warnings.",
            inputSchema: {
                task: z.string().optional().describe("Current task description"),
                files: z
                    .array(z.string())
                    .optional()
                    .describe("Files being worked on"),
            },
        },
        (args) => {
            try {
                return handleCairnContext(getCtx(), args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    // cairn_signal — stable
    server.registerTool(
        "cairn_signal",
        {
            title: "Report a Signal to Cairn",
            description:
                "Report a project signal from conversation. " +
                "Use when: user rejects a suggestion, references past decisions, " +
                "states constraints, or makes a significant decision.",
            inputSchema: {
                type: z
                    .enum(SIGNAL_TYPES)
                    .describe("Signal type"),
                domain: z.string().optional().describe("Affected domain"),
                details: z.object({
                    what: z.string().describe("What happened"),
                    reason: z.string().optional().describe("Why"),
                    rejected_alternatives: z
                        .array(z.string())
                        .optional()
                        .describe("Alternatives considered and rejected"),
                    revisit_when: z
                        .array(z.string())
                        .optional()
                        .describe("Conditions to revisit"),
                }),
                evidence: z.object({
                    user_said: z.string().optional(),
                    files: z.array(z.string()).optional(),
                    commit: z.string().optional(),
                }),
            },
        },
        (args) => {
            try {
                return handleCairnSignal(getCtx(), args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    // cairn_session_end — stable
    server.registerTool(
        "cairn_session_end",
        {
            title: "End Cairn Session",
            description:
                "Call at session end. Processes pending signals, " +
                "generates session record, regenerates views.",
            inputSchema: {
                summary: z.string().describe("Session summary"),
                changed_domains: z.array(z.string()).optional(),
                decisions_made: z.array(z.string()).optional(),
                unresolved: z.array(z.string()).optional(),
            },
        },
        async (args) => {
            try {
                return await handleCairnSessionEnd(getCtx(), args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    // cairn_status — stable
    server.registerTool(
        "cairn_status",
        {
            title: "Cairn System Status",
            description:
                "Get system status: memory count, staged count, signals count, " +
                "conflicts, stale domains, stage advisory.",
        },
        () => {
            try {
                return handleCairnStatus(getCtx());
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    // cairn_plan — experimental
    server.registerTool(
        "cairn_plan",
        {
            title: "Cairn History-Aware Planning (Experimental)",
            description:
                "Get historical constraints for a task. Read-only — " +
                "never writes signals, staged, or memory.",
            inputSchema: {
                task: z.string().describe("Task to plan for"),
            },
        },
        (args) => {
            try {
                return handleCairnPlan(getCtx(), args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    // cairn_doctor — experimental
    server.registerTool(
        "cairn_doctor",
        {
            title: "Cairn Health Check (Experimental)",
            description:
                "Run health diagnostics: token budget, orphan no-gos, " +
                "stale domains, conflicts, staged backlog.",
        },
        () => {
            try {
                return handleCairnDoctor(getCtx());
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    return {
        server,
        runStartupScan: async () => {
            try {
                await runStartupGitScan(getCtx());
            } catch {
                // No .cairn/ directory or other init failure — silent
            }
        },
    };
}
