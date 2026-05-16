import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./constants.js";
import { type CairnContext } from "./context.js";
import { formatToolError } from "./errors.js";
import { z } from "zod";
import { handleInitStatus } from "./tools/cairn-init-status.js";
import { handleInitCommit } from "./tools/cairn-init-commit.js";
import { handleContext } from "./tools/cairn-context.js";
import { handleSignal } from "./tools/cairn-signal.js";
import { handleSessionEnd } from "./tools/cairn-session-end.js";
import { handleStatus } from "./tools/cairn-status.js";
import { handlePlan } from "./tools/cairn-plan.js";
import { handleStageList } from "./tools/cairn-stage-list.js";
import { handleStageAccept } from "./tools/cairn-stage-accept.js";
import { handleStageReject } from "./tools/cairn-stage-reject.js";
import { handleDoctor } from "./tools/cairn-doctor.js";

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
    "call cairn_stage_list(), present entries to user with context, then accept/reject per their decision.",
    "",
    "CONSTRAINT RULES:",
    "- no_go: Never suggest these directions. Explain history if asked.",
    "- active_debt: Do not fix. Work within the constraint.",
    "- stage: Adjust suggestion aggressiveness to project phase (exploration > growth > maturity > maintenance).",
].join("\n");

export function createServer(ctx: CairnContext): McpServer {
    const server = new McpServer(
        { name: "cairn", version: VERSION },
        { instructions: CAIRN_INSTRUCTIONS },
    );

    server.tool(
        "cairn_init_status",
        "Check Cairn initialization status",
        {},
        async () => {
            try {
                return await handleInitStatus(ctx);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_init_commit",
        "Batch write initial cognition after project analysis",
        {
            config: z.object({
                project_name: z.string(),
                domains: z.array(z.string()),
                cognitive_mode: z.string(),
            }),
            skeleton: z.array(z.object({
                domain: z.string(),
                role: z.string(),
                owns: z.array(z.string()),
                does_not_own: z.array(z.string()),
                causal_keywords: z.array(z.string()),
                dependencies: z.array(z.string()).optional(),
            })),
            blood_candidates: z.array(z.any()),
            stage: z.object({
                phase: z.string(),
                confidence: z.number(),
                evidence: z.array(z.string()),
            }).optional(),
            dna: z.object({
                traits: z.array(z.object({
                    name: z.string(),
                    level: z.string(),
                    confidence: z.number(),
                    reasoning: z.string(),
                })).optional(),
            }).optional(),
            imprint: z.object({
                inherited_from: z.string(),
                inherited_constraints: z.array(z.string()),
                inherited_warnings: z.array(z.object({
                    domain: z.string(),
                    warning: z.string(),
                })),
            }).optional(),
        },
        async (args) => {
            try {
                return await handleInitCommit(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_context",
        "Activate relevant cognition for the current task",
        {
            task: z.string().optional(),
            files: z.array(z.string()).optional(),
        },
        async (args) => {
            try {
                return await handleContext(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_signal",
        "Report a conversation signal to Cairn",
        {
            signal_type: z.string(),
            domain: z.string().optional(),
            details: z.object({
                what: z.string(),
                aliases: z.array(z.string()).optional(),
                reason: z.string().optional(),
                rejected_alternatives: z.array(z.object({
                    path: z.string(),
                    reason: z.string(),
                })).optional(),
                revisit_when: z.array(z.string()).optional(),
            }),
            evidence: z.object({
                user_said: z.string().optional(),
                files: z.array(z.string()).optional(),
                commit_ref: z.string().optional(),
            }).default({}),
        },
        async (args) => {
            try {
                return await handleSignal(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_session_end",
        "End the current session with a summary",
        {
            summary: z.string(),
            changed_domains: z.array(z.string()).optional(),
            decisions_made: z.array(z.string()).optional(),
            unresolved: z.array(z.string()).optional(),
        },
        async (args) => {
            try {
                return await handleSessionEnd(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_status",
        "Get Cairn system status",
        {},
        async () => {
            try {
                return await handleStatus(ctx);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_plan",
        "Get historical constraints for a task",
        {
            task: z.string(),
        },
        async (args) => {
            try {
                return await handlePlan(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_stage_list",
        "List pending staged entries for review",
        {},
        async () => {
            try {
                return await handleStageList(ctx);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_stage_accept",
        "Accept a staged entry into blood",
        {
            id: z.string(),
        },
        async (args) => {
            try {
                return await handleStageAccept(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_stage_reject",
        "Reject a staged entry",
        {
            id: z.string(),
            reason: z.string(),
        },
        async (args) => {
            try {
                return await handleStageReject(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_doctor",
        "Run cognitive consistency validation",
        {},
        async () => {
            try {
                return await handleDoctor(ctx);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    return server;
}
