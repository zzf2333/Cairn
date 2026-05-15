import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolvePaths, buildPaths, findCairnRoot } from "./paths.js";
import { formatToolError, toolResult } from "./errors.js";
import { handleCairnContext } from "./tools/cairn-context.js";
import { handleCairnSignal } from "./tools/cairn-signal.js";
import { handleCairnSessionEnd } from "./tools/cairn-session-end.js";
import { handleCairnStatus } from "./tools/cairn-status.js";
import { handleCairnPlan } from "./tools/cairn-plan.js";
import { handleCairnDoctor } from "./tools/cairn-doctor.js";
import { handleCairnReview } from "./tools/cairn-review.js";
import { handleCairnMemory } from "./tools/cairn-memory.js";
import { bootstrapCairnDir } from "./bootstrap.js";
import {
    SIGNAL_TYPES,
    MEMORY_TYPES,
    BEHAVIOR_EFFECT_TYPES,
} from "./schemas/index.js";
import type { Config } from "./schemas/config.js";
import { createCairnContextFromPaths, type CairnContext } from "./context.js";

export type { CairnContext } from "./context.js";
export { createCairnContextFromPaths } from "./context.js";

export function createCairnContext(startDir?: string): CairnContext {
    return createCairnContextFromPaths(resolvePaths(startDir));
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

const CAIRN_INSTRUCTIONS = [
    "Cairn is a project memory engine. Follow this protocol:",
    "",
    "SESSION START: Call cairn_context() BEFORE responding to any user request.",
    "Pass task and/or files if known. Respect all returned constraints (no_go, active_debt, stage) for the entire session.",
    "",
    "DURING WORK: Call cairn_signal() when you detect:",
    "- User rejects a suggestion (type: user-rejection)",
    "- User states a constraint (type: user-constraint)",
    "- A significant decision is made (type: decision)",
    "- User references past decisions (type: historical-reference)",
    "- Technical debt is accepted (type: debt-acceptance)",
    "Do NOT signal routine fixes, formatting, or duplicates.",
    "",
    "BEFORE DESIGN TASKS: Call cairn_plan() for historical constraints.",
    "",
    "SESSION END: Call cairn_session_end() with a summary before the session closes.",
    "",
    "REVIEWING: When cairn_context warns about pending staged entries,",
    "call cairn_review(action:'list'), present entries to user with context, then accept/reject per their decision.",
    "",
    "CONSTRAINT RULES:",
    "- no_go: Never suggest these directions. Explain history if asked.",
    "- active_debt: Do not fix. Work within the constraint.",
    "- stage: Adjust suggestion aggressiveness to project phase (exploration > growth > maturity > maintenance).",
].join("\n");

export function createCairnServer(
    startDir?: string,
): {
    server: McpServer;
    runStartupScan: () => Promise<void>;
    setProjectRoot: (root: string) => void;
    setRootResolver: (resolver: () => Promise<string | undefined>) => void;
} {
    const server = new McpServer(
        {
            name: "cairn",
            version: "0.2.6",
        },
        {
            instructions: CAIRN_INSTRUCTIONS,
        },
    );

    let ctx: CairnContext | null = null;
    let ctxPromise: Promise<CairnContext> | null = null;
    let projectRoot: string | undefined;
    let rootResolver: (() => Promise<string | undefined>) | undefined;

    function setProjectRoot(root: string) {
        projectRoot = root;
    }

    function setRootResolver(resolver: () => Promise<string | undefined>) {
        rootResolver = resolver;
    }

    async function getCtx(): Promise<CairnContext> {
        if (ctx) return ctx;
        if (ctxPromise) return ctxPromise;

        ctxPromise = (async () => {
            if (!projectRoot && rootResolver) {
                try {
                    const resolved = await rootResolver();
                    if (resolved) projectRoot = resolved;
                } catch { /* resolver failed — use fallback */ }
            }
            const effectiveDir = projectRoot ?? startDir;
            const root = findCairnRoot(effectiveDir);
            if (root) {
                ctx = createCairnContextFromPaths(buildPaths(root));
            } else {
                const result = await bootstrapCairnDir(effectiveDir);
                ctx = createCairnContextFromPaths(result.paths);
                ctx.bootstrapResult = result;
            }
            return ctx;
        })();

        return ctxPromise;
    }

    // cairn_context — stable
    server.registerTool(
        "cairn_context",
        {
            title: "Get Cairn Constraint Context",
            description:
                "MUST call at session start before any other work. " +
                "Returns project constraints: stage advisory, no-go list, relevant domain summaries, active debts, warnings. " +
                "Auto-initializes on first use. Respect all returned constraints for the entire session.",
            inputSchema: {
                task: z.string().optional().describe("Current task description"),
                files: z
                    .array(z.string())
                    .optional()
                    .describe("Files being worked on"),
            },
        },
        async (args) => {
            try {
                return handleCairnContext(await getCtx(), args);
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
        async (args) => {
            try {
                return handleCairnSignal(await getCtx(), args);
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
                "MUST call before session ends. Processes pending signals, " +
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
                return await handleCairnSessionEnd(await getCtx(), args);
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
                "conflicts, stale domains, stage advisory. " +
                "Use action 'stage_show' for detailed stage info, 'stage_confirm' to confirm stage.",
            inputSchema: {
                action: z
                    .enum(["status", "stage_show", "stage_confirm"])
                    .optional()
                    .describe("Action: status (default), stage_show, or stage_confirm"),
            },
        },
        async (args) => {
            try {
                return handleCairnStatus(await getCtx(), args);
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
        async (args) => {
            try {
                return handleCairnPlan(await getCtx(), args);
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
        async () => {
            try {
                return handleCairnDoctor(await getCtx());
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    // cairn_review — stable
    server.registerTool(
        "cairn_review",
        {
            title: "Review Staged Memory Entries",
            description:
                "Review, accept, or reject staged memory entries. " +
                "Call with action:'list' to see pending entries, then accept/reject based on user decision.",
            inputSchema: {
                action: z.enum(["list", "accept", "reject"]).describe("Action to perform"),
                id: z.string().optional().describe("Entry ID (required for accept/reject)"),
            },
        },
        async (args) => {
            try {
                return handleCairnReview(await getCtx(), args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    // cairn_memory — stable
    server.registerTool(
        "cairn_memory",
        {
            title: "Manage Memory Entries",
            description:
                "List, view, or archive project memory entries.",
            inputSchema: {
                action: z.enum(["list", "show", "archive"]).describe("Action to perform"),
                id: z.string().optional().describe("Entry ID (required for show/archive)"),
                domain: z.string().optional().describe("Filter by domain (list only)"),
            },
        },
        async (args) => {
            try {
                return handleCairnMemory(await getCtx(), args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    return {
        server,
        runStartupScan: async () => {
            try {
                await runStartupGitScan(await getCtx());
            } catch {
                // Bootstrap or git scan failure — silent
            }
        },
        setProjectRoot,
        setRootResolver,
    };
}
