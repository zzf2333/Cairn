import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CairnContext } from "../server.js";
import { toolResult } from "../errors.js";
import { approxTokens } from "../tokens.js";

export function handleCairnDoctor(ctx: CairnContext) {
    const issues: string[] = [];
    const memories = ctx.memoryStore.loadAll();
    const staged = ctx.stagedStore.loadPending();

    // 1. Output token budget check
    const outputPath = join(ctx.paths.viewsDir, "output.md");
    let outputTokens = 0;
    let outputStatus: "ok" | "warning" | "over_limit" | "missing" = "missing";
    if (existsSync(outputPath)) {
        const content = readFileSync(outputPath, "utf-8");
        outputTokens = approxTokens(content);
        if (outputTokens > 800) {
            outputStatus = "over_limit";
            issues.push(
                `views/output.md exceeds 800 token hard limit (${outputTokens} tokens)`,
            );
        } else if (outputTokens > 500) {
            outputStatus = "warning";
            issues.push(
                `views/output.md exceeds 500 token target (${outputTokens} tokens)`,
            );
        } else {
            outputStatus = "ok";
        }
    } else {
        issues.push("views/output.md not found — run views regeneration");
    }

    // 2. Orphan no-go check
    const noGoMemories = memories.filter(
        (m) =>
            m.behavior_effect.type === "avoid_suggestion" &&
            m.status === "active",
    );
    const orphanNoGo: string[] = [];
    for (const m of noGoMemories) {
        if (!m.source.refs || m.source.refs.length === 0) {
            orphanNoGo.push(m.id);
            issues.push(`Orphan no-go: ${m.id} has no source references`);
        }
    }

    // 3. Stale domains
    const domainUpdates = new Map<string, string>();
    for (const m of memories) {
        const existing = domainUpdates.get(m.domain);
        if (!existing || m.updated_at > existing) {
            domainUpdates.set(m.domain, m.updated_at);
        }
    }
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const staleDomains: Array<{ domain: string; last_updated: string }> = [];
    for (const [domain, lastUpdate] of domainUpdates) {
        if (new Date(lastUpdate) < threeMonthsAgo) {
            staleDomains.push({ domain, last_updated: lastUpdate });
            issues.push(
                `Stale domain: ${domain} (last updated ${lastUpdate})`,
            );
        }
    }

    // 4. Conflicts
    const conflicts = ctx.memoryStore.findConflicts();
    for (const c of conflicts) {
        issues.push(
            `Conflict: ${c.id} — ${c.health.reason ?? "unknown reason"}`,
        );
    }

    // 5. Staged backlog
    const stagedBacklog = staged.length;
    if (stagedBacklog > 5) {
        issues.push(
            `Staged backlog: ${stagedBacklog} entries pending review`,
        );
    }

    // 6. TODO entries in memory
    const todosInMemory = memories.filter(
        (m) =>
            m.summary.includes("[TODO]") ||
            m.rejected?.reason.includes("[TODO]") ||
            m.behavior_effect.instruction.includes("[TODO]"),
    ).length;
    if (todosInMemory > 0) {
        issues.push(`${todosInMemory} memory entries contain [TODO] markers`);
    }

    // 7. Config check
    let configStatus = "ok";
    if (!existsSync(ctx.paths.configYaml)) {
        configStatus = "missing";
        issues.push("config.yaml not found");
    }

    const result = {
        issues_count: issues.length,
        issues,
        output_tokens: {
            count: outputTokens,
            status: outputStatus,
        },
        orphan_no_go: orphanNoGo,
        stale_domains: staleDomains,
        conflicts: conflicts.map((c) => ({
            id: c.id,
            domain: c.domain,
            reason: c.health.reason,
        })),
        staged_backlog: stagedBacklog,
        todos_in_memory: todosInMemory,
        config_status: configStatus,
    };

    return toolResult(JSON.stringify(result, null, 2));
}
