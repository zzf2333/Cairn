import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { EvolutionEvent } from "../schemas/index.js";
import type { BloodCandidate } from "../schemas/blood-candidate.js";
import { KNOWN_DNA_TRAITS, VERSION, type GravityLevel, type CognitiveMode, type ProjectPhase } from "../constants.js";

interface InitCommitArgs {
    dry_run?: boolean;
    config: {
        project_name: string;
        domains: string[];
        cognitive_mode: CognitiveMode;
        tech_stack?: Array<{ name: string; domain: string; summary: string }>;
    };
    skeleton: Array<{
        domain: string;
        role: string;
        owns: string[];
        does_not_own: string[];
        causal_keywords: string[];
        dependencies?: string[];
    }>;
    blood_candidates: BloodCandidate[];
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

export async function handleInitCommit(ctx: CairnContext, args: Record<string, unknown>) {
    // Init intentionally does NOT call gitEar.scan() to backscan git history.
    // Initial cognition is curated by the AI via the blood_candidates argument
    // (higher quality than mass-scanning historical commits would produce).
    // Auto git scanning begins on the first session_end after init, using
    // state.last_session.commit (set below) as the starting point.
    try {
        const {
            dry_run: dryRun,
            config,
            skeleton,
            blood_candidates: bloodCandidates,
            stage,
            dna,
            imprint,
        } = args as unknown as InitCommitArgs;
        const now = new Date().toISOString();

        if (dryRun) {
            return await previewInit(ctx, {
                config, skeleton, bloodCandidates, stage, dna, imprint,
            });
        }

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
    } catch (error) {
        return formatToolError(error);
    }
}

interface PreviewArgs {
    config: InitCommitArgs["config"];
    skeleton: InitCommitArgs["skeleton"];
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
