import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./constants.js";
import { type CairnContext } from "./context.js";
import { formatToolError } from "./errors.js";
import { summarizeArgs } from "./observability/logger.js";
import { z } from "zod";
import { BloodCandidateSchema } from "./schemas/blood-candidate.js";
import { COGNITIVE_MODES } from "./schemas/config.js";
import { PROJECT_PHASES, INIT_STEPS } from "./schemas/state.js";
import { DNA_TRAIT_LEVELS } from "./schemas/dna.js";

async function wrap<A>(
    ctx: CairnContext,
    name: string,
    args: A,
    handler: () => Promise<any>,
): Promise<any> {
    const start = performance.now();
    const ts = new Date().toISOString();
    try {
        const res = await handler();
        await ctx.logger.log({
            ts, tool: name, duration_ms: performance.now() - start,
            ok: true, args_summary: summarizeArgs(args),
        });
        return res;
    } catch (e) {
        await ctx.logger.log({
            ts, tool: name, duration_ms: performance.now() - start,
            ok: false, args_summary: summarizeArgs(args),
            error: e instanceof Error ? e.message : String(e),
        });
        return formatToolError(e);
    }
}
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
import { handleObserve } from "./tools/cairn-observe.js";

const CAIRN_INSTRUCTIONS = [
    "Cairn is a project memory engine. 15 MCP tools across 4 phases.",
    "",
    "INIT (once per project, step-by-step):",
    "1. cairn_init_status() — returns current step and per-step guide.",
    "2. For each step (config → skeleton → blood → dna → stage):",
    "   a. Analyze what the current step needs (follow the guide). For blood: cross-reference git history, code structure, team memory/lessons, AND project instructions (CLAUDE.md, ADRs).",
    "   b. cairn_init_commit({ step: '<step>', ..., dry_run: true }) — preview.",
    "   c. Present preview to user for confirmation.",
    "   d. cairn_init_commit({ step: '<step>', ... }) — write after user confirms.",
    "   e. cairn_init_status() — check next step.",
    "3. Blood candidates auto-confirm during init (no double-staging).",
    "4. DNA traits are staged (not written directly). After committing the dna step, call cairn_dna_list to review, then cairn_dna_accept for each trait.",
    "5. DNA and stage steps are optional but recommended.",
    "Legacy: omit step for batch init (cairn_init_commit with all fields at once).",
    "If cairn_init_status returns not_initialized/partial or cairn_context returns interaction_hint=needs_init,",
    "you MUST complete initialization before proceeding with the user's task.",
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
    "",
    "PRE-COMMIT CHECKPOINT: Call cairn_observe({ summary, candidates }) BEFORE every git commit.",
    "Extract candidate signals from work done since last observe/commit. Each gets recommendation (capture/skip) with reasoning.",
    "Captured candidates route through TrustRouter to blood/staged; skipped ones are reported for human override.",
    "If any candidates are staged, present them to the user before proceeding with commit.",
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
        async () => wrap(ctx, "cairn_init_status", {}, () => handleInitStatus(ctx)),
    );

    server.tool(
        "cairn_init_commit",
        "Write initial cognition. Use step for progressive init (config → skeleton → blood → dna → stage), or omit for batch write.",
        {
            dry_run: z.boolean().optional(),
            step: z.enum(INIT_STEPS).optional(),
            config: z.object({
                project_name: z.string(),
                domains: z.array(z.string()),
                cognitive_mode: z.enum(COGNITIVE_MODES),
                tech_stack: z.array(z.object({
                    name: z.string(),
                    domain: z.string(),
                    summary: z.string(),
                })).optional(),
            }).optional(),
            skeleton: z.array(z.object({
                domain: z.string(),
                role: z.string(),
                owns: z.array(z.string()),
                does_not_own: z.array(z.string()),
                causal_keywords: z.array(z.string()),
                dependencies: z.array(z.string()).optional(),
            })).optional(),
            blood_candidates: z.array(BloodCandidateSchema).optional(),
            stage: z.object({
                phase: z.enum(PROJECT_PHASES),
                confidence: z.number(),
                evidence: z.array(z.string()),
            }).optional(),
            dna: z.object({
                traits: z.array(z.object({
                    name: z.string(),
                    level: z.enum(DNA_TRAIT_LEVELS),
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
        async (args) => wrap(ctx, "cairn_init_commit", args, () => handleInitCommit(ctx, args)),
    );

    server.tool(
        "cairn_context",
        "Activate relevant cognition for the current task",
        {
            task: z.string().optional(),
            files: z.array(z.string()).optional(),
        },
        async (args) => wrap(ctx, "cairn_context", args, () => handleContext(ctx, args)),
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
        async (args) => wrap(ctx, "cairn_signal", args, () => handleSignal(ctx, args)),
    );

    server.tool(
        "cairn_observe",
        "Pre-commit checkpoint: extract and route candidate signals from recent work",
        {
            summary: z.string().describe("What was done in the work chunk leading to this commit"),
            candidates: z.array(z.object({
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
                recommendation: z.enum(["capture", "skip"]),
                recommendation_reason: z.string(),
            })),
        },
        async (args) => wrap(ctx, "cairn_observe", args, () => handleObserve(ctx, args)),
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
        async (args) => wrap(ctx, "cairn_session_end", args, () => handleSessionEnd(ctx, args)),
    );

    server.tool(
        "cairn_status",
        "Get Cairn system status",
        {},
        async () => wrap(ctx, "cairn_status", {}, () => handleStatus(ctx)),
    );

    server.tool(
        "cairn_plan",
        "Get historical constraints for a task",
        {
            task: z.string(),
        },
        async (args) => wrap(ctx, "cairn_plan", args, () => handlePlan(ctx, args)),
    );

    server.tool(
        "cairn_stage_list",
        "List pending staged entries for review",
        {},
        async () => wrap(ctx, "cairn_stage_list", {}, () => handleStageList(ctx)),
    );

    server.tool(
        "cairn_stage_accept",
        "Accept a staged entry into blood",
        {
            id: z.string(),
        },
        async (args) => wrap(ctx, "cairn_stage_accept", args, () => handleStageAccept(ctx, args)),
    );

    server.tool(
        "cairn_stage_reject",
        "Reject a staged entry",
        {
            id: z.string(),
            reason: z.string(),
        },
        async (args) => wrap(ctx, "cairn_stage_reject", args, () => handleStageReject(ctx, args)),
    );

    server.tool(
        "cairn_doctor",
        "Run cognitive consistency validation",
        {},
        async () => wrap(ctx, "cairn_doctor", {}, () => handleDoctor(ctx)),
    );

    server.tool(
        "cairn_dna_list",
        "List pending DNA trait candidates awaiting human ratification",
        {},
        async () => wrap(ctx, "cairn_dna_list", {}, () => handleDnaList(ctx)),
    );

    server.tool(
        "cairn_dna_accept",
        "Accept a DNA trait candidate, writing it to dna/identity.yaml",
        {
            id: z.string(),
        },
        async (args) => wrap(ctx, "cairn_dna_accept", args, () => handleDnaAccept(ctx, args)),
    );

    server.tool(
        "cairn_dna_reject",
        "Reject a DNA trait candidate; records the rejection in audit log",
        {
            id: z.string(),
            reason: z.string(),
        },
        async (args) => wrap(ctx, "cairn_dna_reject", args, () => handleDnaReject(ctx, args)),
    );

    return server;
}
