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
import { handleDnaList } from "./tools/cairn-dna-list.js";
import { handleDnaAccept } from "./tools/cairn-dna-accept.js";
import { handleDnaReject } from "./tools/cairn-dna-reject.js";

const CAIRN_INSTRUCTIONS = [
    "Cairn is a project memory engine. 14 MCP tools across 4 phases.",
    "",
    "INIT (once per project):",
    "1. cairn_init_status() — if not_initialized, analyze project (README/docs/git/deps), then",
    "2. cairn_init_commit({ config, skeleton, blood_candidates, stage?, dna?, imprint? })",
    "",
    "SESSION START: Call cairn_context({ task?, files? }) BEFORE responding to any user request.",
    "Respect ALL returned constraints for the entire session:",
    "- constraints.no_go: never suggest these directions; entries with archived:true are weaker (recent reactivations) but still warn",
    "- constraints.accepted_debt: do not fix; work within",
    "- constraints.stage_constraints: adjust suggestion aggressiveness to phase",
    "- challenges: respond per level — suggestion (acknowledge), reflective_challenge (justify in writing), hard_constraint (do not proceed)",
    "",
    "DURING WORK: Call cairn_signal() when you detect one of these signal types (underscored):",
    "- user_rejection — user rejects a suggestion",
    "- constraint_declaration — user states a constraint",
    "- decision — a significant decision is made",
    "- historical_reference — user references past decisions",
    "- debt_acceptance — technical debt is accepted",
    "- stage_constraint — phase-related constraint declared",
    "Include details.aliases for subjects with common synonyms (e.g. what='MongoDB', aliases=['document store','nosql']).",
    "Do NOT signal routine fixes, formatting, or duplicates.",
    "",
    "BEFORE DESIGN TASKS: Call cairn_plan({ task }) for historical constraints + DNA guidance.",
    "",
    "SESSION END: Call cairn_session_end({ summary, ... }) before the session closes.",
    "Side effects: scans git since last session, runs decay/calibration/safety-valve, infers stage,",
    "and may produce DNA candidates for review. Output exposes git_signals, stage, dna_compression, dna_safety_valve.",
    "",
    "REVIEW QUEUES (two separate channels):",
    "- EvolutionEvent staged: cairn_stage_list() → cairn_stage_accept/reject per user decision",
    "- DNA trait candidates: cairn_dna_list() → cairn_dna_accept/reject per user decision",
    "DNA candidates always need human ratification — a wrong trait silently distorts every future decision.",
    "",
    "DIAGNOSTICS:",
    "- cairn_status() — system state snapshot (counts, dna status, stage phase, drift warnings)",
    "- cairn_doctor() — consistency validation. NOTE: has side effects — auto-resurrects archived G0/G1 events with high recent activation. Surfaces G2+ as candidates only.",
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
        "Batch write initial cognition after project analysis. Pass dry_run: true to preview TrustRouter routing without writing.",
        {
            dry_run: z.boolean().optional(),
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

    server.tool(
        "cairn_dna_list",
        "List pending DNA trait candidates awaiting human ratification",
        {},
        async () => {
            try {
                return await handleDnaList(ctx);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_dna_accept",
        "Accept a DNA trait candidate, writing it to dna/identity.yaml",
        {
            id: z.string(),
        },
        async (args) => {
            try {
                return await handleDnaAccept(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    server.tool(
        "cairn_dna_reject",
        "Reject a DNA trait candidate; records the rejection in audit log",
        {
            id: z.string(),
            reason: z.string(),
        },
        async (args) => {
            try {
                return await handleDnaReject(ctx, args);
            } catch (e) {
                return formatToolError(e);
            }
        },
    );

    return server;
}
