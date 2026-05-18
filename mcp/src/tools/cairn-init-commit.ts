import type { CairnContext } from "../context.js";
import { ensureCairnDirs } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { EvolutionEvent } from "../schemas/index.js";
import type { BloodCandidate } from "../schemas/blood-candidate.js";
import { KNOWN_DNA_TRAITS, VERSION, type GravityLevel, type CognitiveMode, type ProjectPhase } from "../constants.js";
import { type InitStep, INIT_STEPS, REQUIRED_INIT_STEPS } from "../schemas/state.js";

interface InitCommitArgs {
    dry_run?: boolean;
    step?: InitStep;
    config?: {
        project_name: string;
        domains: string[];
        cognitive_mode: CognitiveMode;
        tech_stack?: Array<{ name: string; domain: string; summary: string }>;
    };
    skeleton?: Array<{
        domain: string;
        role: string;
        owns: string[];
        does_not_own: string[];
        causal_keywords: string[];
        dependencies?: string[];
    }>;
    blood_candidates?: BloodCandidate[];
    stage?: { phase: ProjectPhase; confidence: number; evidence: string[] };
    dna?: { traits?: Array<{ name: string; level: "low" | "medium" | "high"; confidence: number; reasoning: string }> };
    imprint?: {
        inherited_from: string;
        inherited_constraints: string[];
        inherited_warnings: Array<{ domain: string; warning: string }>;
    };
}

function buildEventFromCandidate(candidate: BloodCandidate, index: number): EvolutionEvent {
    const now = new Date().toISOString();
    const domain = candidate.domain;
    const id = `evt_init_${domain}_${candidate.type}_${index}`;

    return {
        id,
        time: now,
        domain,
        type: candidate.type,
        gravity: {
            level: candidate.gravity.level,
        },
        source: {
            type: candidate.source.type,
            confidence: candidate.source.confidence,
            verified: false,
            refs: candidate.source.refs ?? [],
        },
        subject: {
            name: candidate.summary,
            aliases: [],
        },
        trigger: "initialization",
        decision_or_change: candidate.decision ?? candidate.summary,
        rejected_paths: candidate.rejected_paths ?? [],
        reasoning: candidate.reasoning ?? candidate.behavior_effect.instruction,
        constraints_added: candidate.constraints_added ?? [],
        constraints_removed: [],
        accepted_debt: [],
        behavior_effect: {
            type: candidate.behavior_effect.type,
            instruction: candidate.behavior_effect.instruction,
        },
        affects: {
            skeleton: false,
            dna: false,
            domains: [domain],
        },
        lifecycle: {
            validity: candidate.lifecycle.validity,
            review_after: candidate.lifecycle.review_after,
            decay_policy: "downgrade",
            resurrection_count: 0,
        },
        revisit: candidate.revisit
            ? { when: candidate.revisit.when, status: "not_met" }
            : undefined,
        supersedes: null,
        conflicts_with: [],
        related: [],
        health: { state: "ok", reason: null },
        trauma: {
            is_trauma: candidate.trauma?.is_trauma ?? false,
            sensitivity_multiplier: candidate.trauma?.sensitivity_multiplier ?? 1.0,
            decay_override: candidate.trauma?.is_trauma ? "permanent" : null,
            affects_dna: false,
            requires_human_ratification: candidate.trauma?.is_trauma ?? false,
        },
        created_at: now,
        updated_at: now,
        governance_status: "auto_confirmed",
    };
}

function nextStep(completedSteps: readonly string[]): InitStep | null {
    return INIT_STEPS.find(s => !completedSteps.includes(s)) ?? null;
}

export async function handleInitCommit(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const parsed = args as unknown as InitCommitArgs;

        if (!parsed.step) {
            return await handleLegacyInitCommit(ctx, parsed);
        }

        switch (parsed.step) {
            case "config":
                return await handleConfigStep(ctx, parsed);
            case "skeleton":
                return await handleSkeletonStep(ctx, parsed);
            case "blood":
                return await handleBloodStep(ctx, parsed);
            case "dna":
                return await handleDnaStep(ctx, parsed);
            case "stage":
                return await handleStageStep(ctx, parsed);
            default:
                return formatToolError(new Error(`Unknown init step: ${parsed.step}`));
        }
    } catch (error) {
        return formatToolError(error);
    }
}

async function requireStepCompleted(ctx: CairnContext, step: InitStep): Promise<string | null> {
    const progress = await ctx.stateStore.getInitProgress();
    if (!progress || !progress.completed_steps.includes(step)) {
        return `Step "${step}" must be completed first`;
    }
    return null;
}

async function handleConfigStep(ctx: CairnContext, args: InitCommitArgs) {
    if (!args.config) {
        return formatToolError(new Error("config is required for the config step"));
    }

    if (args.dry_run) {
        return toolResult(JSON.stringify({
            dry_run: true,
            step: "config",
            would_write: {
                project_name: args.config.project_name,
                domains: args.config.domains,
                cognitive_mode: args.config.cognitive_mode,
                tech_stack: args.config.tech_stack ?? [],
            },
            next_step: "skeleton",
        }));
    }

    await ensureCairnDirs(ctx.paths);

    const now = new Date().toISOString();
    await ctx.configStore.save({
        version: "3.0",
        project: { name: args.config.project_name, created: now },
        domains: args.config.domains,
        cognitive_mode: args.config.cognitive_mode,
        stage: { override: null },
        tech_stack: args.config.tech_stack ?? [],
        logging: { enabled: true, retention_days: 30 },
    });

    await ctx.stateStore.markInitStep("config");
    const progress = await ctx.stateStore.getInitProgress();

    return toolResult(JSON.stringify({
        step: "config",
        written: true,
        project_name: args.config.project_name,
        domains: args.config.domains,
        cognitive_mode: args.config.cognitive_mode,
        completed_steps: progress?.completed_steps ?? ["config"],
        next_step: "skeleton",
    }));
}

async function handleSkeletonStep(ctx: CairnContext, args: InitCommitArgs) {
    const err = await requireStepCompleted(ctx, "config");
    if (err) return formatToolError(new Error(err));

    if (!args.skeleton || args.skeleton.length === 0) {
        return formatToolError(new Error("skeleton is required for the skeleton step"));
    }

    if (args.dry_run) {
        return toolResult(JSON.stringify({
            dry_run: true,
            step: "skeleton",
            would_write: args.skeleton.map(s => ({ domain: s.domain, role: s.role })),
            skeleton_nodes: args.skeleton.length,
            next_step: "blood",
        }));
    }

    const config = await ctx.configStore.load();
    if (!config) {
        return formatToolError(new Error("Config not found — complete the config step first"));
    }
    const domains = [...new Set(args.skeleton.map(s => s.domain))];
    config.domains = domains;
    await ctx.configStore.save(config);

    for (const node of args.skeleton) {
        await ctx.skeletonStore.save({
            domain: node.domain,
            role: node.role,
            owns: node.owns,
            does_not_own: node.does_not_own,
            stability: "stable",
            dependencies: node.dependencies ?? [],
            causal_keywords: node.causal_keywords,
        });
    }

    await ctx.stateStore.markInitStep("skeleton");
    const progress = await ctx.stateStore.getInitProgress();

    return toolResult(JSON.stringify({
        step: "skeleton",
        written: args.skeleton.length,
        domains,
        completed_steps: progress?.completed_steps ?? [],
        next_step: "blood",
    }));
}

async function handleBloodStep(ctx: CairnContext, args: InitCommitArgs) {
    const err = await requireStepCompleted(ctx, "skeleton");
    if (err) return formatToolError(new Error(err));

    if (!args.blood_candidates || args.blood_candidates.length === 0) {
        return formatToolError(new Error("blood_candidates is required for the blood step"));
    }

    if (args.dry_run) {
        const autoConfirm: Array<{ id: string; summary: string; gravity: string; domain: string }> = [];
        const willStage: Array<{ id: string; summary: string; gravity: string; domain: string; routing_reason: string }> = [];
        const willDrop: Array<{ id: string; summary: string; reason: string }> = [];
        const warnings: string[] = [];

        for (let i = 0; i < args.blood_candidates.length; i++) {
            const candidate = args.blood_candidates[i];
            const event = buildEventFromCandidate(candidate, i);
            const routing = await ctx.trustRouter.route({
                domain: event.domain,
                subject_name: event.subject.name,
                type: event.type,
                gravity: event.gravity.level as GravityLevel,
                isTrauma: event.trauma.is_trauma,
            });

            const row = {
                id: event.id,
                summary: event.subject.name,
                gravity: routing.gravity,
                domain: event.domain,
            };
            if (routing.destination === "blood") autoConfirm.push(row);
            else if (routing.destination === "staged") willStage.push({ ...row, routing_reason: routing.reason });
            else willDrop.push({ id: event.id, summary: event.subject.name, reason: routing.reason });
        }

        if (args.blood_candidates.length > 50) {
            warnings.push(`${args.blood_candidates.length} blood candidates is unusually high — consider filtering.`);
        }

        return toolResult(JSON.stringify({
            dry_run: true,
            step: "blood",
            would_write: {
                blood_auto_confirm: autoConfirm,
                blood_staged: willStage,
                blood_dropped: willDrop,
            },
            summary: {
                blood_auto_confirm: autoConfirm.length,
                blood_staged: willStage.length,
                blood_dropped: willDrop.length,
            },
            warnings,
            next_step: "dna",
        }));
    }

    const now = new Date().toISOString();
    let autoConfirmed = 0;
    let staged = 0;

    for (let i = 0; i < args.blood_candidates.length; i++) {
        const candidate = args.blood_candidates[i];
        const event = buildEventFromCandidate(candidate, i);

        const routing = await ctx.trustRouter.route({
            domain: event.domain,
            subject_name: event.subject.name,
            type: event.type,
            gravity: event.gravity.level as GravityLevel,
            isTrauma: event.trauma.is_trauma,
        });

        if (routing.destination === "blood") {
            event.governance_status = "auto_confirmed";
            await ctx.bloodEngine.commit(event);
            autoConfirmed++;
        } else if (routing.destination === "staged") {
            event.governance_status = "pending";
            await ctx.stagedStore.save({
                id: event.id,
                draft_event: event,
                review_status: "pending",
                routing_reason: routing.reason,
                gravity: routing.gravity as GravityLevel,
                governance_required: routing.governance === "human_ratified"
                    ? "human_ratified"
                    : "auto_confirmable",
                created_at: now,
            });
            staged++;
        }
    }

    await ctx.stateStore.markInitStep("blood");

    const state = await ctx.stateStore.load();
    if (state.initialization_status === "complete") {
        state.cairn_version = VERSION;
        await ctx.stateStore.save(state);
        await ctx.viewsEngine.regenerate();
    }

    const progress = await ctx.stateStore.getInitProgress();

    return toolResult(JSON.stringify({
        step: "blood",
        auto_confirmed: autoConfirmed,
        staged,
        completed_steps: progress?.completed_steps ?? [],
        initialization_complete: state.initialization_status === "complete",
        next_step: nextStep(progress?.completed_steps ?? []),
        pending_review: staged,
    }));
}

async function handleDnaStep(ctx: CairnContext, args: InitCommitArgs) {
    const err = await requireStepCompleted(ctx, "config");
    if (err) return formatToolError(new Error(err));

    if (!args.dna?.traits || args.dna.traits.length === 0) {
        return formatToolError(new Error("dna.traits is required for the dna step"));
    }

    if (args.dry_run) {
        const warnings: string[] = [];
        for (const trait of args.dna.traits) {
            if (!(KNOWN_DNA_TRAITS as readonly string[]).includes(trait.name)) {
                warnings.push(`DNA trait "${trait.name}" is not in KNOWN_DNA_TRAITS (${KNOWN_DNA_TRAITS.join(", ")}) — it will not influence routing or challenges.`);
            }
        }
        return toolResult(JSON.stringify({
            dry_run: true,
            step: "dna",
            would_stage: args.dna.traits,
            warnings,
            message: "Traits will be staged for review (not written directly). Use cairn_dna_accept to confirm each trait after committing this step.",
            next_step: "stage",
        }));
    }

    const now = new Date().toISOString();
    const staged: string[] = [];
    const skipped: string[] = [];
    for (const trait of args.dna.traits) {
        if (!(KNOWN_DNA_TRAITS as readonly string[]).includes(trait.name)) {
            skipped.push(trait.name);
            continue;
        }
        await ctx.dnaStagedStore.save({
            id: `stg_dna_${trait.name}_init_${Date.now()}`,
            trait_name: trait.name as typeof KNOWN_DNA_TRAITS[number],
            level: trait.level,
            confidence: trait.confidence,
            evidence_events: [],
            reasoning: trait.reasoning,
            proposed_at: now,
            review_status: "pending",
        });
        staged.push(trait.name);
    }

    await ctx.stateStore.markInitStep("dna");
    const progress = await ctx.stateStore.getInitProgress();

    return toolResult(JSON.stringify({
        step: "dna",
        traits_staged: staged.length,
        staged_traits: staged,
        skipped_unknown_traits: skipped,
        message: staged.length > 0
            ? "DNA traits staged for review. Use cairn_dna_list to view, then cairn_dna_accept to confirm each trait."
            : "No known DNA traits to stage.",
        completed_steps: progress?.completed_steps ?? [],
        next_step: nextStep(progress?.completed_steps ?? []),
    }));
}

async function handleStageStep(ctx: CairnContext, args: InitCommitArgs) {
    const err = await requireStepCompleted(ctx, "config");
    if (err) return formatToolError(new Error(err));

    if (!args.stage) {
        return formatToolError(new Error("stage is required for the stage step"));
    }

    if (args.dry_run) {
        return toolResult(JSON.stringify({
            dry_run: true,
            step: "stage",
            would_write: {
                phase: args.stage.phase,
                confidence: args.stage.confidence,
                evidence: args.stage.evidence,
            },
            next_step: null,
        }));
    }

    await ctx.stateStore.updateStage({
        phase: args.stage.phase,
        confidence: args.stage.confidence,
        status: "advisory",
        evidence: args.stage.evidence.map(e => ({ source: "init", signal: e })),
        guidance: [],
    });

    await ctx.stateStore.markInitStep("stage");
    const progress = await ctx.stateStore.getInitProgress();

    if (progress?.completed_steps.includes("blood")) {
        await ctx.viewsEngine.regenerate();
    }

    return toolResult(JSON.stringify({
        step: "stage",
        phase: args.stage.phase,
        confidence: args.stage.confidence,
        completed_steps: progress?.completed_steps ?? [],
        next_step: null,
    }));
}

async function handleLegacyInitCommit(ctx: CairnContext, args: InitCommitArgs) {
    if (!args.config) {
        return formatToolError(new Error("config is required"));
    }
    if (!args.skeleton) {
        return formatToolError(new Error("skeleton is required"));
    }
    if (!args.blood_candidates) {
        return formatToolError(new Error("blood_candidates is required"));
    }

    const { config, skeleton, blood_candidates: bloodCandidates, stage, dna, imprint } = args;
    const dryRun = args.dry_run;
    const now = new Date().toISOString();

    if (dryRun) {
        return await previewInit(ctx, {
            config, skeleton, bloodCandidates, stage, dna, imprint,
        });
    }

    await ensureCairnDirs(ctx.paths);

    await ctx.configStore.save({
        version: "3.0",
        project: { name: config.project_name, created: now },
        domains: [...new Set(skeleton.map(s => s.domain))],
        cognitive_mode: config.cognitive_mode,
        stage: { override: null },
        tech_stack: config.tech_stack ?? [],
        logging: { enabled: true, retention_days: 30 },
    });

    for (const node of skeleton) {
        await ctx.skeletonStore.save({
            domain: node.domain,
            role: node.role,
            owns: node.owns,
            does_not_own: node.does_not_own,
            stability: "stable",
            dependencies: node.dependencies ?? [],
            causal_keywords: node.causal_keywords,
        });
    }

    let autoConfirmed = 0;
    let staged = 0;

    for (let i = 0; i < bloodCandidates.length; i++) {
        const candidate = bloodCandidates[i];
        const event = buildEventFromCandidate(candidate, i);

        const routing = await ctx.trustRouter.route({
            domain: event.domain,
            subject_name: event.subject.name,
            type: event.type,
            gravity: event.gravity.level as GravityLevel,
            isTrauma: event.trauma.is_trauma,
        });

        if (routing.destination === "blood") {
            event.governance_status = "auto_confirmed";
            await ctx.bloodEngine.commit(event);
            autoConfirmed++;
        } else if (routing.destination === "staged") {
            event.governance_status = "pending";
            await ctx.stagedStore.save({
                id: event.id,
                draft_event: event,
                review_status: "pending",
                routing_reason: routing.reason,
                gravity: routing.gravity as GravityLevel,
                governance_required: routing.governance === "human_ratified"
                    ? "human_ratified"
                    : "auto_confirmable",
                created_at: now,
            });
            staged++;
        }
    }

    if (stage) {
        await ctx.stateStore.updateStage({
            phase: stage.phase,
            confidence: stage.confidence,
            status: "advisory",
            evidence: stage.evidence.map(e => ({ source: "init", signal: e })),
            guidance: [],
        });
    }

    if (dna?.traits && dna.traits.length > 0) {
        const identity = await ctx.dnaStore.loadIdentity();
        for (const trait of dna.traits) {
            identity.traits[trait.name] = {
                level: trait.level,
                confidence: trait.confidence,
                evidence_count: 1,
                last_updated: now,
                reasoning: trait.reasoning,
                drift_warning_count: 0,
                last_safety_valve_at: null,
            };
        }
        identity.status = "emerging";
        await ctx.dnaStore.saveIdentity(identity);
    }

    if (imprint) {
        await ctx.dnaStore.saveImprint({
            inherited_from: imprint.inherited_from,
            inherited_at: now,
            inherited_constraints: imprint.inherited_constraints,
            inherited_warnings: imprint.inherited_warnings,
            identity_status: "not_yet_emerged",
        });
    }

    const state = await ctx.stateStore.load();
    state.initialization_status = "complete";
    state.cairn_version = VERSION;
    await ctx.stateStore.save(state);

    await ctx.viewsEngine.regenerate();

    return toolResult(JSON.stringify({
        created: true,
        written: {
            config: true,
            skeleton: skeleton.length,
            blood_auto_confirmed: autoConfirmed,
            blood_staged: staged,
            stage: !!stage,
            views: true,
        },
        pending_review: staged,
        initialization_status: "complete",
    }));
}

interface PreviewArgs {
    config: NonNullable<InitCommitArgs["config"]>;
    skeleton: NonNullable<InitCommitArgs["skeleton"]>;
    bloodCandidates: BloodCandidate[];
    stage?: InitCommitArgs["stage"];
    dna?: InitCommitArgs["dna"];
    imprint?: InitCommitArgs["imprint"];
}

async function previewInit(ctx: CairnContext, args: PreviewArgs) {
    const { config, skeleton, bloodCandidates, stage, dna, imprint } = args;

    const autoConfirm: Array<{ id: string; summary: string; gravity: string; domain: string }> = [];
    const willStage: Array<{ id: string; summary: string; gravity: string; domain: string; routing_reason: string }> = [];
    const willDrop: Array<{ id: string; summary: string; reason: string }> = [];

    for (let i = 0; i < bloodCandidates.length; i++) {
        const candidate = bloodCandidates[i];
        const event = buildEventFromCandidate(candidate, i);
        const routing = await ctx.trustRouter.route({
            domain: event.domain,
            subject_name: event.subject.name,
            type: event.type,
            gravity: event.gravity.level as GravityLevel,
            isTrauma: event.trauma.is_trauma,
        });

        const row = {
            id: event.id,
            summary: event.subject.name,
            gravity: routing.gravity,
            domain: event.domain,
        };
        if (routing.destination === "blood") autoConfirm.push(row);
        else if (routing.destination === "staged") willStage.push({ ...row, routing_reason: routing.reason });
        else willDrop.push({ id: event.id, summary: event.subject.name, reason: routing.reason });
    }

    const warnings: string[] = [];
    const skeletonDomains = new Set(skeleton.map(s => s.domain));
    const configDomains = new Set(config.domains);
    const inConfigOnly = config.domains.filter(d => !skeletonDomains.has(d));
    const inSkeletonOnly = [...skeletonDomains].filter(d => !configDomains.has(d));
    if (inConfigOnly.length > 0 || inSkeletonOnly.length > 0) {
        warnings.push(
            `config.domains and skeleton domains differ — ` +
            (inConfigOnly.length > 0 ? `config-only: [${inConfigOnly.join(", ")}] ` : "") +
            (inSkeletonOnly.length > 0 ? `skeleton-only: [${inSkeletonOnly.join(", ")}]` : "") +
            `. On commit, domains will be derived from skeleton.`
        );
    }
    if (dna?.traits) {
        for (const trait of dna.traits) {
            if (!(KNOWN_DNA_TRAITS as readonly string[]).includes(trait.name)) {
                warnings.push(`DNA trait "${trait.name}" is not in KNOWN_DNA_TRAITS (${KNOWN_DNA_TRAITS.join(", ")}) — it will not influence routing or challenges.`);
            }
        }
    }
    if (bloodCandidates.length > 50) {
        warnings.push(`${bloodCandidates.length} blood candidates is unusually high — consider whether all are signal-worthy or if some are noise from git history.`);
    }
    if (skeleton.length === 0) {
        warnings.push("No skeleton nodes — cairn_context will have no domain boundaries to activate.");
    }
    if (!stage) {
        warnings.push("No stage advisory — context() will report 'unknown' phase until session_end infers one.");
    }

    return toolResult(JSON.stringify({
        dry_run: true,
        would_write: {
            config: {
                project_name: config.project_name,
                domains: [...new Set(skeleton.map(s => s.domain))],
                cognitive_mode: config.cognitive_mode,
                tech_stack: config.tech_stack ?? [],
            },
            skeleton: skeleton.map(s => ({ domain: s.domain, role: s.role })),
            blood_auto_confirm: autoConfirm,
            blood_staged: willStage,
            blood_dropped: willDrop,
            stage: stage ? { phase: stage.phase, confidence: stage.confidence } : null,
            dna_traits: dna?.traits ?? [],
            imprint: imprint ? { inherited_from: imprint.inherited_from } : null,
        },
        summary: {
            skeleton_nodes: skeleton.length,
            blood_auto_confirm: autoConfirm.length,
            blood_staged: willStage.length,
            blood_dropped: willDrop.length,
            dna_traits: dna?.traits?.length ?? 0,
        },
        warnings,
        next_step: "Review with user, then call cairn_init_commit again with dry_run: false (or omit) to write.",
    }));
}
