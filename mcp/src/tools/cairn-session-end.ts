import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import type { SessionRecord, State, EvolutionEvent } from "../schemas/index.js";
import { downgradeGravity, type GravityLevel } from "../constants.js";
import { mapGitSignalToEvent } from "../engines/git-signal-mapper.js";
import { generateSessionId, checkContext } from "./session-guard.js";

const STAGE_HYSTERESIS_DAYS = 14;
const STAGE_MIN_CONFIDENCE = 0.6;

interface StageInferenceResult {
    inferred_phase: string;
    inferred_confidence: number;
    changed: boolean;
    transitionStagedId: string | null;
}

interface CompressionInferenceResult {
    candidates_detected: number;
    new_staged: string[];
}

async function runCompressionInference(
    ctx: CairnContext,
    nowIso: string,
): Promise<CompressionInferenceResult> {
    const identity = await ctx.dnaStore.loadIdentity();
    const threshold = identity.compression_threshold;
    const candidates = await ctx.compressionEngine.detectCandidates(
        threshold.min_evidence,
        threshold.min_timespan_months,
    );

    const result: CompressionInferenceResult = {
        candidates_detected: candidates.length,
        new_staged: [],
    };

    if (candidates.length === 0) return result;

    const pendingDna = await ctx.dnaStagedStore.findPending();
    const pendingTraitNames = new Set(pendingDna.map(p => p.trait_name));

    for (const candidate of candidates) {
        const existingTrait = identity.traits[candidate.trait_name];
        if (
            existingTrait
            && existingTrait.level === candidate.level
            && Math.abs(existingTrait.confidence - candidate.confidence) < 0.1
        ) {
            continue;
        }
        if (pendingTraitNames.has(candidate.trait_name)) continue;

        const id = `stg_dna_${candidate.trait_name}_${Date.now()}`;
        await ctx.dnaStagedStore.save({
            id,
            trait_name: candidate.trait_name,
            level: candidate.level,
            confidence: candidate.confidence,
            evidence_events: candidate.evidence_events,
            reasoning: candidate.reasoning,
            proposed_at: nowIso,
            review_status: "pending",
        });
        pendingTraitNames.add(candidate.trait_name);
        result.new_staged.push(id);
    }

    return result;
}

async function runStageInference(
    ctx: CairnContext,
    state: State,
    nowIso: string,
): Promise<StageInferenceResult> {
    const projectAgeMonths = await ctx.gitEar.getProjectAge();
    const commitStats = await ctx.gitEar.getCommitStats();
    const inferred = ctx.stageEngine.infer({
        projectAgeMonths,
        commitCount30d: commitStats.count30d,
        projectAvgCommits30d: commitStats.projectAvg,
        dependencyChangeRate: await ctx.gitEar.getDependencyChangeRate(30),
        newFileRatio: await ctx.gitEar.getNewFileRatio(30),
        contributorCount: await ctx.gitEar.getContributorCount(30),
    });

    const currentPhase = state.stage.phase;
    if (inferred.phase === currentPhase) {
        state.stage.confidence = inferred.confidence;
        state.stage.evidence = inferred.evidence;
        state.stage.guidance = inferred.guidance;
        state.stage.last_updated = nowIso;
        await ctx.stateStore.save(state);
        return {
            inferred_phase: inferred.phase,
            inferred_confidence: inferred.confidence,
            changed: false,
            transitionStagedId: null,
        };
    }

    if (inferred.confidence < STAGE_MIN_CONFIDENCE) {
        return {
            inferred_phase: inferred.phase,
            inferred_confidence: inferred.confidence,
            changed: false,
            transitionStagedId: null,
        };
    }

    if (!state.stage.last_updated) {
        state.stage.last_updated = nowIso;
        await ctx.stateStore.save(state);
        return {
            inferred_phase: inferred.phase,
            inferred_confidence: inferred.confidence,
            changed: false,
            transitionStagedId: null,
        };
    }

    const lastSetMs = new Date(state.stage.last_updated).getTime();
    const daysSinceSet = (Date.now() - lastSetMs) / (1000 * 60 * 60 * 24);
    if (daysSinceSet < STAGE_HYSTERESIS_DAYS) {
        return {
            inferred_phase: inferred.phase,
            inferred_confidence: inferred.confidence,
            changed: false,
            transitionStagedId: null,
        };
    }

    const transitionEvent: EvolutionEvent = {
        id: `evt_stage_transition_${currentPhase}_to_${inferred.phase}_${Date.now()}`,
        time: nowIso,
        domain: "global",
        type: "stage_transition",
        gravity: { level: "G2" },
        source: {
            type: "runtime_observed",
            confidence: inferred.confidence,
            verified: false,
            refs: [],
        },
        subject: { name: `phase:${inferred.phase}`, aliases: [currentPhase] },
        trigger: `stage inference detected ${currentPhase} → ${inferred.phase}`,
        decision_or_change: `transition project phase from ${currentPhase} to ${inferred.phase}`,
        rejected_paths: [],
        reasoning: inferred.evidence.map(e => `${e.source}: ${e.signal}`).join("; ") || "stage signals indicate phase change",
        constraints_added: [],
        constraints_removed: [],
        accepted_debt: [],
        behavior_effect: {
            type: "prefer_approach",
            instruction: inferred.guidance.join("; "),
        },
        affects: { skeleton: false, dna: false, domains: ["global"] },
        lifecycle: { validity: "strategic", decay_policy: "downgrade", resurrection_count: 0 },
        supersedes: null,
        conflicts_with: [],
        related: [],
        health: { state: "ok", reason: null },
        trauma: {
            is_trauma: false,
            sensitivity_multiplier: 1.0,
            decay_override: null,
            affects_dna: false,
            requires_human_ratification: true,
        },
        created_at: nowIso,
        updated_at: nowIso,
        governance_status: "pending",
    };

    const routing = await ctx.trustRouter.route({
        domain: transitionEvent.domain,
        subject_name: transitionEvent.subject.name,
        type: transitionEvent.type,
        gravity: transitionEvent.gravity.level as GravityLevel,
        isStageTransition: true,
    });

    if (routing.destination !== "staged") {
        return {
            inferred_phase: inferred.phase,
            inferred_confidence: inferred.confidence,
            changed: false,
            transitionStagedId: null,
        };
    }

    transitionEvent.gravity.level = routing.gravity;
    await ctx.stagedStore.save({
        id: transitionEvent.id,
        draft_event: transitionEvent,
        review_status: "pending",
        routing_reason: routing.reason,
        gravity: routing.gravity,
        governance_required: "human_ratified",
        created_at: nowIso,
    });

    return {
        inferred_phase: inferred.phase,
        inferred_confidence: inferred.confidence,
        changed: true,
        transitionStagedId: transitionEvent.id,
    };
}

interface SessionEndArgs {
    summary: string;
    changed_domains?: string[];
    decisions_made?: string[];
    unresolved?: string[];
}

export async function handleSessionEnd(ctx: CairnContext, args: Record<string, unknown>) {
    try {
        const {
            summary,
            changed_domains: changedDomains,
            decisions_made: decisionsMade,
            unresolved,
        } = args as unknown as SessionEndArgs;

        const now = new Date();
        const nowIso = now.toISOString();

        const contextCheck = await checkContext(ctx.stateStore);
        const sessionWarning = contextCheck.warning;
        let activeSession = contextCheck.session;

        let sessionId: string;
        let sessionStartedAt: string;

        if (activeSession) {
            sessionId = activeSession.id;
            sessionStartedAt = activeSession.started_at;
        } else {
            sessionId = generateSessionId(now);
            sessionStartedAt = nowIso;
            await ctx.stateStore.startSession({ id: sessionId, context_loaded: false });
            activeSession = await ctx.stateStore.getActiveSession();
        }

        await ctx.stateStore.setSessionCheckpoint("init");

        const headCommit = await ctx.gitEar.getHeadCommit();

        const state = await ctx.stateStore.load();
        const priorCommit = state.last_session.commit;

        if (state.last_session.ended_at) {
            const lastEnded = new Date(state.last_session.ended_at);
            const daysSince = Math.floor((now.getTime() - lastEnded.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince > 30) {
                await ctx.stateStore.clearActivationLog();
            }
        }

        const gitScan = priorCommit
            ? await ctx.gitEar.scan(priorCommit)
            : { signals: [] };

        const gitNewBlood: string[] = [];
        const gitNewStaged: string[] = [];
        const gitDropped: string[] = [];
        const signalsRouted = { G0: 0, G1: 0, G2: 0, G3: 0 };

        for (const signal of gitScan.signals) {
            const event = mapGitSignalToEvent(signal, nowIso);
            if (!event) continue;

            const routing = await ctx.trustRouter.route({
                domain: event.domain,
                subject_name: event.subject.name,
                type: event.type,
                gravity: event.gravity.level as GravityLevel,
            });

            signalsRouted[routing.gravity as keyof typeof signalsRouted] += 1;

            if (routing.merged_with) {
                continue;
            }

            if (routing.destination === "dropped") {
                gitDropped.push(event.id);
                continue;
            }

            event.gravity.level = routing.gravity;

            if (routing.destination === "blood") {
                event.governance_status = "auto_confirmed";
                await ctx.bloodEngine.commit(event);
                gitNewBlood.push(event.id);
            } else if (routing.destination === "staged") {
                event.governance_status = "pending";
                await ctx.stagedStore.save({
                    id: event.id,
                    draft_event: event,
                    review_status: "pending",
                    routing_reason: routing.reason,
                    gravity: routing.gravity,
                    governance_required: routing.governance === "human_ratified"
                        ? "human_ratified"
                        : "auto_confirmable",
                    created_at: nowIso,
                });
                gitNewStaged.push(event.id);
            }
        }

        state.last_session.commit = headCommit;
        state.last_session.ended_at = nowIso;
        await ctx.stateStore.save(state);

        await ctx.stateStore.setSessionCheckpoint("git_scan_done");

        const config = await ctx.configStore.load();
        const cognitiveMode = config?.cognitive_mode ?? "standard";
        const decayActions = await ctx.decayEngine.checkDecay(cognitiveMode);

        const decayStale: Array<{ id: string; reason: string }> = [];
        const decayArchived: Array<{ id: string; reason: string }> = [];
        const decayDowngraded: Array<{ id: string; from: string; to: string }> = [];

        for (const action of decayActions) {
            if (action.action === "mark_stale") {
                await ctx.bloodEngine.markStale(action.event_id, action.reason);
                decayStale.push({ id: action.event_id, reason: action.reason });
            } else if (action.action === "archive") {
                await ctx.bloodEngine.archive(action.event_id, action.reason);
                decayArchived.push({ id: action.event_id, reason: action.reason });
            } else if (action.action === "downgrade") {
                const event = await ctx.bloodStore.load(action.event_id);
                if (event) {
                    const fromGravity = event.gravity.level as GravityLevel;
                    event.gravity.level = downgradeGravity(fromGravity);
                    event.updated_at = new Date().toISOString();
                    if (event.gravity.level === "G0") {
                        await ctx.bloodEngine.archive(action.event_id, "downgraded to G0");
                        decayArchived.push({ id: action.event_id, reason: "downgraded to G0" });
                    } else {
                        await ctx.bloodStore.save(event);
                        decayDowngraded.push({ id: action.event_id, from: fromGravity, to: event.gravity.level });
                    }
                }
            }
        }

        await ctx.stateStore.setSessionCheckpoint("decay_done");

        const calibration = await ctx.calibrationEar.calibrate();
        const safetyValve = await ctx.calibrationEar.applySafetyValve(calibration.signals);

        const calibrationByType: Record<string, number> = {};
        for (const sig of calibration.signals) {
            calibrationByType[sig.signal_type] = (calibrationByType[sig.signal_type] ?? 0) + 1;
        }

        await ctx.stateStore.setSessionCheckpoint("calibration_done");

        const stageResult = await runStageInference(ctx, state, nowIso);
        if (stageResult.transitionStagedId) {
            gitNewStaged.push(stageResult.transitionStagedId);
        }

        await ctx.stateStore.setSessionCheckpoint("stage_done");

        const dnaResult = await runCompressionInference(ctx, nowIso);

        await ctx.stateStore.setSessionCheckpoint("compression_done");

        await ctx.viewsEngine.regenerate();

        const record: SessionRecord = {
            id: sessionId,
            started_at: sessionStartedAt,
            ended_at: nowIso,
            summary,
            signals_captured: gitScan.signals.length + calibration.signals.length + safetyValve.signals.length,
            signals_routed: signalsRouted,
            domains_touched: changedDomains ?? [],
            decisions_made: decisionsMade ?? [],
            unresolved: unresolved ?? [],
            compliance: {
                context_loaded: activeSession?.context_loaded ?? false,
                plan_called: activeSession?.plan_called ?? false,
                observe_called: activeSession?.observe_called ?? false,
                signals_count: activeSession?.signals_count ?? 0,
                degraded_signals_count: activeSession?.degraded_signals_count ?? 0,
                observed_candidates_count: activeSession?.observed_candidates_count ?? 0,
                captured_candidates_count: activeSession?.captured_candidates_count ?? 0,
                recovered: activeSession?.recovered ?? false,
            },
        };

        await ctx.sessionStore.save(record);

        const durationMin = Math.round((now.getTime() - new Date(sessionStartedAt).getTime()) / 60000);
        const complianceLine = JSON.stringify({
            ts: nowIso,
            session: sessionId,
            host: ctx.hostName ?? "unknown",
            task: activeSession?.task ?? null,
            context: activeSession?.context_loaded ?? false,
            plan: activeSession?.plan_called ?? false,
            observe: activeSession?.observe_called ?? false,
            signals: activeSession?.signals_count ?? 0,
            degraded: activeSession?.degraded_signals_count ?? 0,
            observed_candidates: activeSession?.observed_candidates_count ?? 0,
            captured_candidates: activeSession?.captured_candidates_count ?? 0,
            recovered: activeSession?.recovered ?? false,
            session_closed: true,
            domains: changedDomains ?? [],
            duration_min: durationMin,
        });
        try {
            await mkdir(dirname(ctx.paths.complianceLog), { recursive: true });
            await appendFile(ctx.paths.complianceLog, complianceLine + "\n");
        } catch {
            // best-effort logging
        }

        await ctx.stateStore.clearSession();

        const stagedCount = await ctx.stagedStore.count();

        const highlights: string[] = [];
        if (safetyValve.entered_reevaluation) highlights.push("DNA safety valve triggered — entered reevaluation mode");
        if (stageResult.changed) highlights.push(`Stage transition detected: → ${stageResult.inferred_phase}`);
        if (decayArchived.length > 0) highlights.push(`${decayArchived.length} event(s) archived by decay`);
        if (dnaResult.new_staged.length > 0) highlights.push(`${dnaResult.new_staged.length} new DNA candidate(s) staged for review`);
        if (stagedCount > 0) highlights.push(`${stagedCount} staged entry/entries pending review`);
        if (safetyValve.triggered_traits.length > 0 && !safetyValve.entered_reevaluation) {
            highlights.push(`DNA confidence reduced for: ${safetyValve.triggered_traits.join(", ")}`);
        }

        const response: Record<string, unknown> = {
            highlights,
            signals_processed: gitScan.signals.length + calibration.signals.length,
            new_blood: gitNewBlood.length,
            new_staged: gitNewStaged.length,
            views_regenerated: true,
            pending_review: stagedCount,
            git_signals: {
                scanned: gitScan.signals.length,
                new_blood: gitNewBlood.length,
                new_staged: gitNewStaged.length,
                dropped: gitDropped.length,
            },
            decay: {
                events_processed: decayActions.length,
                stale: decayStale,
                archived: decayArchived,
                downgraded: decayDowngraded,
            },
            calibration: {
                signals_detected: calibration.signals.length,
                by_type: calibrationByType,
            },
            stage: {
                phase: stageResult.inferred_phase,
                confidence: stageResult.inferred_confidence,
                changed: stageResult.changed,
                transition_staged: stageResult.transitionStagedId,
            },
            dna_compression: {
                candidates_detected: dnaResult.candidates_detected,
                new_staged: dnaResult.new_staged,
            },
            dna_safety_valve: {
                triggered_traits: safetyValve.triggered_traits,
                confidence_reduced: safetyValve.confidence_reduced,
                entered_reevaluation: safetyValve.entered_reevaluation,
            },
            session: {
                id: sessionId,
                signals_count: activeSession?.signals_count ?? 0,
                degraded_signals_count: activeSession?.degraded_signals_count ?? 0,
                context_was_loaded: activeSession?.context_loaded ?? false,
            },
        };
        if (sessionWarning) response.warning = sessionWarning;

        return toolResult(JSON.stringify(response));
    } catch (error) {
        return formatToolError(error);
    }
}
