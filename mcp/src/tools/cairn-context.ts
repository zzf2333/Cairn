import type { CairnContext } from "../server.js";
import { toolResult } from "../errors.js";

export function handleCairnContext(
    ctx: CairnContext,
    args: { task?: string; files?: string[] },
) {
    const memories = ctx.memoryStore.findActive();
    const state = ctx.stateStore.load();

    // Determine relevant domains
    let relevantDomains: string[] = [];
    if (args.task || args.files) {
        const allDomains = [...new Set(memories.map((m) => m.domain))];
        const keywords = [
            ...(args.task?.toLowerCase().split(/\s+/) ?? []),
            ...(args.files?.map((f) => f.toLowerCase()) ?? []),
        ];

        relevantDomains = allDomains.filter((d) =>
            keywords.some(
                (k) =>
                    d.includes(k) ||
                    k.includes(d) ||
                    memories.some(
                        (m) =>
                            m.domain === d &&
                            m.subject.name.toLowerCase().includes(k),
                    ),
            ),
        );

        if (relevantDomains.length === 0) {
            relevantDomains = allDomains;
        }
    } else {
        relevantDomains = [...new Set(memories.map((m) => m.domain))];
    }

    // No-go list
    const noGo = memories
        .filter(
            (m) =>
                m.scope === "global" ||
                m.behavior_effect.type === "avoid_suggestion",
        )
        .map((m) => ({
            subject: m.subject.name,
            instruction: m.behavior_effect.instruction,
            domain: m.domain,
        }));

    // Domain summaries
    const domainSummaries = relevantDomains.map((d) => {
        const domainMemories = memories.filter((m) => m.domain === d);
        return {
            domain: d,
            memory_count: domainMemories.length,
            rejections: domainMemories.filter((m) => m.type === "rejection").length,
            decisions: domainMemories.filter((m) => m.type === "decision").length,
        };
    });

    // Active debts
    const debts = memories
        .filter((m) => m.type === "debt")
        .map((m) => ({
            subject: m.subject.name,
            summary: m.summary,
            domain: m.domain,
        }));

    // Warnings
    const warnings: string[] = [];
    const conflicts = ctx.memoryStore.findConflicts();
    if (conflicts.length > 0) {
        warnings.push(
            `${conflicts.length} conflicted memory entries detected`,
        );
    }
    const staged = ctx.stagedStore.loadPending();
    if (staged.length > 0) {
        warnings.push(
            `${staged.length} staged entries pending review (run 'cairn review')`,
        );
    }

    const result = {
        stage: {
            phase: state.stage.phase,
            confidence: state.stage.confidence,
            status: state.stage.status,
            guidance: state.stage.guidance,
        },
        no_go: noGo,
        relevant_domains: domainSummaries,
        active_debt: debts,
        warnings,
    };

    return toolResult(JSON.stringify(result, null, 2));
}
