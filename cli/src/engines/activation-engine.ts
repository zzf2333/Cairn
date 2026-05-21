import type { EvolutionEvent, SkeletonNode, DNAIdentity } from "../schemas/index.js";
import type { BloodStore } from "../stores/blood-store.js";
import type { SkeletonStore } from "../stores/skeleton-store.js";
import type { DnaStore } from "../stores/dna-store.js";
import type { DomainStore } from "../stores/domain-store.js";
import type { StateStore } from "../stores/state-store.js";
import type { ChallengeEngine } from "./challenge-engine.js";
import { GRAVITY_ORDER, type GravityLevel, RESURRECTION_THRESHOLD } from "../constants.js";
import { approxTokens } from "../tokens.js";

export interface Challenge {
    level: "suggestion" | "reflective_challenge" | "hard_constraint";
    conflict_with: string;
    description: string;
    required_response?: string;
    trauma?: boolean;
    archived?: boolean;
}

export interface ActivationInput {
    task?: string;
    files?: string[];
}

export interface CairnContextResult {
    stage: {
        phase: string;
        confidence: number;
        status: string;
        guidance: string[];
    };
    dna: {
        relevant_traits: Array<{
            name: string;
            level: string;
            implication: string;
        }>;
        reevaluation_mode?: boolean;
        paused_traits?: Array<{ name: string; level: string }>;
    };
    constraints: {
        no_go: Array<{
            what: string;
            reason: string;
            reasoning?: string;
            gravity: string;
            source_event: string;
            archived?: boolean;
        }>;
        accepted_debt: Array<{
            what: string;
            reason: string;
            revisit_when: string[];
        }>;
        stage_constraints: string[];
    };
    relevant_domains: Array<{
        domain: string;
        skeleton_role: string;
        rejected_paths: Array<{ path: string; reason: string }>;
        open_questions: string[];
        pitfalls: string[];
    }>;
    challenges: Challenge[];
    meta: {
        skeleton_nodes_activated: string[];
        blood_events_scanned: number;
        context_token_estimate: number;
    };
}

export class ActivationEngine {
    constructor(
        private readonly bloodStore: BloodStore,
        private readonly skeletonStore: SkeletonStore,
        private readonly dnaStore: DnaStore,
        private readonly domainStore: DomainStore,
        private readonly stateStore: StateStore,
        private readonly challengeEngine: ChallengeEngine,
    ) {}

    async activate(input: ActivationInput): Promise<CairnContextResult> {
        const matchedNodes = await this.taskToSkeleton(input);
        const expandedDomains = await this.expandCapillaries(matchedNodes);
        const { events, archivedReactivating, scannedCount } = await this.traverseBlood(expandedDomains);
        const dnaActivation = await this.activateDna(expandedDomains);
        return this.assembleContext(
            input, matchedNodes, expandedDomains,
            events, archivedReactivating, scannedCount, dnaActivation,
        );
    }

    private async taskToSkeleton(input: ActivationInput): Promise<SkeletonNode[]> {
        const allNodes = await this.skeletonStore.loadAll();
        if (allNodes.length === 0) return [];

        const keywords = new Set<string>();
        if (input.task) {
            for (const word of input.task.split(/\s+/)) {
                const lower = word.toLowerCase();
                if (lower.length > 0) keywords.add(lower);
            }
        }
        if (input.files) {
            for (const filePath of input.files) {
                const segments = filePath.split(/[/\\]/).filter(s => s.length > 0);
                for (const seg of segments) {
                    keywords.add(seg.toLowerCase());
                }
            }
        }

        if (keywords.size === 0) return allNodes;

        const matched = allNodes.filter(node =>
            node.causal_keywords.some(ck =>
                [...keywords].some(kw => ck.toLowerCase().includes(kw) || kw.includes(ck.toLowerCase()))
            )
        );

        return matched.length > 0 ? matched : allNodes;
    }

    private async expandCapillaries(nodes: SkeletonNode[]): Promise<string[]> {
        const domains = new Set<string>();
        for (const node of nodes) {
            domains.add(node.domain);
        }

        const allNodes = await this.skeletonStore.loadAll();
        const nodeMap = new Map<string, SkeletonNode>();
        for (const n of allNodes) {
            nodeMap.set(n.domain, n);
        }

        for (const node of nodes) {
            for (const dep of node.dependencies) {
                if (nodeMap.has(dep)) {
                    domains.add(dep);
                }
            }
        }

        return [...domains];
    }

    private async traverseBlood(domains: string[]): Promise<{
        events: EvolutionEvent[];
        archivedReactivating: EvolutionEvent[];
        scannedCount: number;
    }> {
        const allEvents = await this.bloodStore.loadAll();
        const scannedCount = allEvents.length;
        const state = await this.stateStore.load();

        const matchesDomainAndGravity = (e: EvolutionEvent): boolean =>
            domains.includes(e.domain)
            && GRAVITY_ORDER[e.gravity.level as GravityLevel] >= GRAVITY_ORDER.G1;

        const relevant = allEvents.filter(e =>
            matchesDomainAndGravity(e)
            && (e.health.state === "ok" || e.health.state === "resurrected"),
        );

        const archivedReactivating = allEvents.filter(e => {
            if (!matchesDomainAndGravity(e)) return false;
            if (e.health.state !== "stale" && e.health.state !== "archived") return false;
            const hits = state.activation_log.recent_hits[e.id] ?? 0;
            return hits >= RESURRECTION_THRESHOLD;
        });

        const sortByPriority = (a: EvolutionEvent, b: EvolutionEvent) => {
            const gravDiff = GRAVITY_ORDER[b.gravity.level as GravityLevel] - GRAVITY_ORDER[a.gravity.level as GravityLevel];
            if (gravDiff !== 0) return gravDiff;
            const traumaDiff = (b.trauma.is_trauma ? 1 : 0) - (a.trauma.is_trauma ? 1 : 0);
            if (traumaDiff !== 0) return traumaDiff;
            return b.created_at.localeCompare(a.created_at);
        };
        relevant.sort(sortByPriority);
        archivedReactivating.sort(sortByPriority);

        await this.stateStore.recordActivationBatch([
            ...relevant.map(e => e.id),
            ...archivedReactivating.map(e => e.id),
        ]);

        return { events: relevant, archivedReactivating, scannedCount };
    }

    private async activateDna(domains: string[]): Promise<{
        traits: Array<{ name: string; level: string; implication: string }>;
        reevaluationMode: boolean;
        pausedTraits: Array<{ name: string; level: string }>;
    }> {
        const identity = await this.dnaStore.loadIdentity();
        if (identity.status === "not_yet_emerged") {
            return { traits: [], reevaluationMode: false, pausedTraits: [] };
        }

        // In reevaluation_mode the TrustRouter already skips trait-based modulation
        // (see trust-router.ts). Mirror that here so the AI doesn't *think* the
        // traits are active when the runtime is ignoring them.
        if (identity.reevaluation_mode) {
            const paused = Object.entries(identity.traits).map(([name, trait]) => ({
                name,
                level: trait.level,
            }));
            return { traits: [], reevaluationMode: true, pausedTraits: paused };
        }

        const traits: Array<{ name: string; level: string; implication: string }> = [];
        for (const [name, trait] of Object.entries(identity.traits)) {
            const implication = this.traitImplication(name, trait.level, domains);
            if (implication) {
                traits.push({ name, level: trait.level, implication });
            }
        }
        return { traits, reevaluationMode: false, pausedTraits: [] };
    }

    private traitImplication(name: string, level: string, _domains: string[]): string | null {
        if (name === "simplicity_bias" && level === "high") {
            return "Prefer simple solutions; avoid complex frameworks unless justified";
        }
        if (name === "infra_aggressiveness" && level === "low") {
            return "Conservative on new infrastructure; prefer proven tools";
        }
        if (name === "test_discipline" && level === "high") {
            return "Maintain high test coverage; suggest tests for changes";
        }
        if (name === "refactor_appetite" && level === "high") {
            return "Open to refactoring; suggest structural improvements";
        }
        if (name === "refactor_appetite" && level === "low") {
            return "Avoid large refactors; prefer incremental changes";
        }
        if (level === "high" || level === "low") {
            return `${name} is ${level} — factor into recommendations`;
        }
        return null;
    }

    private async assembleContext(
        input: ActivationInput,
        matchedNodes: SkeletonNode[],
        domains: string[],
        events: EvolutionEvent[],
        archivedReactivating: EvolutionEvent[],
        scannedCount: number,
        dnaActivation: {
            traits: Array<{ name: string; level: string; implication: string }>;
            reevaluationMode: boolean;
            pausedTraits: Array<{ name: string; level: string }>;
        },
    ): Promise<CairnContextResult> {
        const state = await this.stateStore.load();

        // no_go[].reason must carry the *why* (reasoning), not the *how*
        // (behavior_effect.instruction). The latter tells the AI what to do; the
        // former lets the AI explain the decision back to the user and judge
        // whether circumstances have changed enough to seek a reevaluation.
        const noGoReason = (e: EvolutionEvent): string => {
            const r = (e.reasoning ?? "").trim();
            return r.length > 0 ? r : e.behavior_effect.instruction;
        };

        const noGo: CairnContextResult["constraints"]["no_go"] = [];
        for (const event of events) {
            if (event.behavior_effect.type === "avoid_suggestion") {
                noGo.push({
                    what: event.subject.name,
                    reason: noGoReason(event),
                    reasoning: event.reasoning,
                    gravity: event.gravity.level,
                    source_event: event.id,
                });
            }
        }
        for (const event of archivedReactivating) {
            if (event.behavior_effect.type === "avoid_suggestion") {
                noGo.push({
                    what: event.subject.name,
                    reason: `[archived, reactivating] ${noGoReason(event)}`,
                    reasoning: event.reasoning,
                    gravity: event.gravity.level,
                    source_event: event.id,
                    archived: true,
                });
            }
        }

        const allAcceptedDebt: CairnContextResult["constraints"]["accepted_debt"] = [];
        for (const domain of domains) {
            const debt = await this.domainStore.loadAcceptedDebt(domain);
            for (const d of debt.debts) {
                allAcceptedDebt.push({
                    what: d.what,
                    reason: d.reason,
                    revisit_when: d.revisit_when,
                });
            }
        }

        const stageConstraints: string[] = [...state.stage.guidance];

        const relevantDomains: CairnContextResult["relevant_domains"] = [];
        for (const domain of domains) {
            const node = matchedNodes.find(n => n.domain === domain)
                ?? (await this.skeletonStore.load(domain));
            const rejectedPaths = await this.domainStore.loadRejectedPaths(domain);

            const domainEvents = events.filter(e => e.domain === domain);
            const pitfalls: string[] = [];
            for (const evt of domainEvents) {
                if (evt.trauma.is_trauma) {
                    pitfalls.push(`[TRAUMA] ${evt.subject.name}: ${evt.behavior_effect.instruction}`);
                }
            }

            const openQuestions: string[] = [];
            for (const evt of domainEvents) {
                if (evt.revisit && evt.revisit.status === "not_met") {
                    for (const condition of evt.revisit.when) {
                        openQuestions.push(condition);
                    }
                }
            }

            relevantDomains.push({
                domain,
                skeleton_role: node?.role ?? "unknown",
                rejected_paths: rejectedPaths.paths.map(p => ({ path: p.path, reason: p.reason })),
                open_questions: openQuestions,
                pitfalls,
            });
        }

        const challenges: Challenge[] = [];
        for (const domain of domains) {
            const domainChallenges = await this.challengeEngine.detectConflicts({
                task: input.task,
                domain,
            });
            for (const c of domainChallenges) {
                if (!challenges.some(existing => existing.conflict_with === c.conflict_with)) {
                    challenges.push(c);
                }
            }
        }

        const resultObj: CairnContextResult = {
            stage: {
                phase: state.stage.phase,
                confidence: state.stage.confidence,
                status: state.stage.status,
                guidance: state.stage.guidance,
            },
            dna: {
                relevant_traits: dnaActivation.traits,
                ...(dnaActivation.reevaluationMode
                    ? {
                          reevaluation_mode: true,
                          paused_traits: dnaActivation.pausedTraits,
                      }
                    : {}),
            },
            constraints: {
                no_go: noGo,
                accepted_debt: allAcceptedDebt,
                stage_constraints: stageConstraints,
            },
            relevant_domains: relevantDomains,
            challenges,
            meta: {
                skeleton_nodes_activated: matchedNodes.map(n => n.domain),
                blood_events_scanned: scannedCount,
                context_token_estimate: approxTokens(JSON.stringify({
                    noGo,
                    allAcceptedDebt,
                    stageConstraints,
                    relevantDomains,
                    dnaActivation,
                })),
            },
        };

        return resultObj;
    }
}
