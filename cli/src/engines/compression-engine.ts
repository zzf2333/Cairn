import type { BloodStore } from "../stores/index.js";
import type { EvolutionEvent, SessionRecord } from "../schemas/index.js";
import type { SessionStore } from "../stores/session-store.js";
import { type KnownDnaTrait } from "../constants.js";

export interface DNACandidate {
    trait_name: string;
    level: "low" | "medium" | "high";
    confidence: number;
    evidence_events: string[];
    reasoning: string;
}

function monthsBetween(a: Date, b: Date): number {
    const earlier = a < b ? a : b;
    const later = a < b ? b : a;
    return (later.getFullYear() - earlier.getFullYear()) * 12
        + (later.getMonth() - earlier.getMonth());
}

function determineLevel(count: number): "low" | "medium" | "high" {
    if (count >= 7) return "high";
    if (count >= 5) return "medium";
    return "low";
}

const SIMPLICITY_KEYWORDS = [
    "simple", "simplicity", "straightforward", "lightweight",
    "minimal", "avoid complexity", "keep it small",
];

const INFRA_AGGRESSIVENESS_TYPES = new Set([
    "avoid_suggestion", "prefer_approach",
]);

function isInfraDomain(domain: string): boolean {
    const lower = domain.toLowerCase();
    return lower.includes("infra")
        || lower.includes("deploy")
        || lower.includes("platform")
        || lower.includes("ops");
}

function isInfraEvent(event: EvolutionEvent): boolean {
    if (isInfraDomain(event.domain)) return true;
    if (event.subject.type === "dependency") return true;
    return false;
}

function isSimplicityEvent(event: EvolutionEvent): boolean {
    const text = [event.reasoning, event.behavior_effect.instruction, event.decision_or_change]
        .join(" ").toLowerCase();
    return SIMPLICITY_KEYWORDS.some(kw => text.includes(kw));
}

function inferKnownTrait(group: EvolutionEvent[]): {
    trait_name: KnownDnaTrait;
    level: "low" | "medium" | "high";
} | null {
    const infraCount = group.filter(e =>
        isInfraEvent(e) && INFRA_AGGRESSIVENESS_TYPES.has(e.behavior_effect.type)
    ).length;
    const infraRejections = group.filter(e =>
        isInfraEvent(e) && (e.type === "rejection" || e.behavior_effect.type === "avoid_suggestion")
    ).length;

    if (infraCount >= group.length * 0.6 && infraRejections >= 3) {
        return {
            trait_name: "infra_aggressiveness",
            level: infraRejections >= 7 ? "high" : (infraRejections >= 5 ? "medium" : "low"),
        };
    }

    const simplicityCount = group.filter(isSimplicityEvent).length;
    if (simplicityCount >= 3 && simplicityCount >= group.length * 0.5) {
        return {
            trait_name: "simplicity_bias",
            level: determineLevel(simplicityCount),
        };
    }

    return null;
}

export class CompressionEngine {
    constructor(
        private readonly bloodStore: BloodStore,
        private readonly sessionStore?: SessionStore,
    ) {}

    async detectCandidates(minEvidence: number, minTimespanMonths: number): Promise<DNACandidate[]> {
        const events = await this.bloodStore.findActive();
        const groups = new Map<string, EvolutionEvent[]>();

        for (const event of events) {
            const key = `${event.domain}:${event.type}`;
            const group = groups.get(key);
            if (group) {
                group.push(event);
            } else {
                groups.set(key, [event]);
            }
        }

        const candidates: DNACandidate[] = [];

        for (const [key, group] of groups) {
            if (group.length < minEvidence) continue;

            const times = group.map(e => new Date(e.time));
            const earliest = new Date(Math.min(...times.map(t => t.getTime())));
            const latest = new Date(Math.max(...times.map(t => t.getTime())));
            const span = monthsBetween(earliest, latest);

            if (span < minTimespanMonths) continue;

            const inferred = inferKnownTrait(group);
            if (!inferred) continue;

            const sources = new Set(group.map(e => e.source.type));
            const sourceBonus = Math.min(sources.size * 0.05, 0.2);
            const countBonus = Math.min(group.length * 0.05, 0.3);
            const confidence = Math.min(0.4 + countBonus + sourceBonus, 1);

            candidates.push({
                trait_name: inferred.trait_name,
                level: inferred.level,
                confidence,
                evidence_events: group.map(e => e.id),
                reasoning: `${group.length} events over ${span} months in ${key} matched ${inferred.trait_name} pattern (${sources.size} source types)`,
            });
        }

        const fastCycleCandidates = await this.detectFastCycleCandidates(events);
        const existing = new Set(candidates.map(c => c.trait_name));
        for (const candidate of fastCycleCandidates) {
            if (!existing.has(candidate.trait_name)) {
                candidates.push(candidate);
                existing.add(candidate.trait_name);
            }
        }

        return candidates;
    }

    private async detectFastCycleCandidates(events: EvolutionEvent[]): Promise<DNACandidate[]> {
        const sessions = this.sessionStore ? await this.sessionStore.loadRecent(80) : [];
        const corpus = [
            ...events.map(event => ({
                id: event.id,
                text: [
                    event.subject.name,
                    event.trigger,
                    event.decision_or_change,
                    event.reasoning,
                    event.behavior_effect.instruction,
                ].join(" "),
            })),
            ...sessions.map(session => ({
                id: session.id,
                text: session.summary,
            })),
        ];

        const patterns: Array<{
            trait_name: string;
            keywords: string[];
            reasoning: string;
        }> = [
            {
                trait_name: "design_doc_alignment_bias",
                keywords: ["设计", "文档", "对齐", "回退", "runtime 补丁", "patch"],
                reasoning: "Repeated corrections prefer aligning with design documents over stacking runtime patches",
            },
            {
                trait_name: "leader_worker_boundary_sensitivity",
                keywords: ["Leader", "Worker", "边界", "职责", "Council Review", "@成员"],
                reasoning: "Repeated events show sensitivity around Leader/Worker role boundaries and coordination rules",
            },
            {
                trait_name: "script_based_team_chat_validation",
                keywords: ["test-chat", "脚本", "验收", "团队聊天", "回归"],
                reasoning: "Repeated evidence requires script-based validation for team chat behavior",
            },
            {
                trait_name: "cross_project_feature_contamination_caution",
                keywords: ["另一个项目", "不应加入", "当前项目", "先确认", "产业链报告"],
                reasoning: "Corrections indicate caution against importing features from other projects without confirming scope",
            },
            {
                trait_name: "agent_onboarding_context_bias",
                keywords: ["入职", "Onboarding", "Agent Profile", "公司", "团队", "业务"],
                reasoning: "Repeated design events frame agents as coworkers with onboarding context rather than role-play personas",
            },
        ];

        const candidates: DNACandidate[] = [];
        for (const pattern of patterns) {
            const evidence = corpus.filter(item => {
                const lower = item.text.toLowerCase();
                let hits = 0;
                for (const keyword of pattern.keywords) {
                    if (lower.includes(keyword.toLowerCase())) hits++;
                }
                return hits >= 2;
            });
            if (evidence.length < 3) continue;

            candidates.push({
                trait_name: pattern.trait_name,
                level: evidence.length >= 7 ? "high" : evidence.length >= 5 ? "medium" : "low",
                confidence: Math.min(0.55 + evidence.length * 0.04, 0.85),
                evidence_events: evidence.slice(0, 12).map(item => item.id),
                reasoning: `${pattern.reasoning}; ${evidence.length} supporting blood/session evidence items found in the recent runtime corpus`,
            });
        }

        return candidates;
    }
}
