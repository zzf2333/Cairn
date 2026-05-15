import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { CairnContext } from "../server.js";
import { toolResult } from "../errors.js";
import type { SessionRecord } from "../schemas/index.js";

interface SessionEndArgs {
    summary: string;
    changed_domains?: string[];
    decisions_made?: string[];
    unresolved?: string[];
}

export async function handleCairnSessionEnd(
    ctx: CairnContext,
    args: SessionEndArgs,
) {
    const now = new Date().toISOString();
    const dateSlug = now.slice(0, 10).replace(/-/g, "_");

    // 1. Process L1 signals — check for accumulation upgrades
    const signals = ctx.signalStore.loadAll();
    let newStaged = 0;
    let newMemory = 0;

    // Group by domain+subject for accumulation check
    const groups = new Map<string, typeof signals>();
    for (const signal of signals) {
        const key = `${signal.inferred.probable_domain ?? "unknown"}::${(signal.raw_data as Record<string, unknown>)["subject"] ?? signal.signal_type}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(signal);
    }

    // Load config
    let config;
    try {
        config = ctx.stateStore.loadConfig(ctx.paths.configYaml);
    } catch {
        config = {
            version: "2.0",
            project: { name: "unknown", created: now.slice(0, 7) },
            domains: { locked: [] },
            trust_policy: {
                L3_auto_write: [
                    "source.kind == 'conversation' AND type == 'rejection'",
                    "source.kind == 'conversation' AND type == 'decision'",
                    "source.kind == 'conversation' AND type == 'debt'",
                ],
                L2_staged: [],
                never_auto: [],
            },
            stage: { override: null, auto_constraint: false },
        };
    }

    const routedCounts = { L0: 0, L1: 0, L2: 0, L3: 0 };

    for (const [, groupSignals] of groups) {
        if (groupSignals.length >= 3) {
            // Accumulated enough — re-route the latest
            const latest = groupSignals[groupSignals.length - 1];
            const result = ctx.trustRouter.route(latest, config);
            routedCounts[result.level]++;
            if (result.route === "staged") newStaged++;
            if (result.route === "memory") newMemory++;
        }
    }

    // 2. Generate session record
    mkdirSync(ctx.paths.sessionsDir, { recursive: true });
    const session: SessionRecord = {
        id: `sess_${dateSlug}_${Date.now().toString(36)}`,
        started_at: ctx.stateStore.load().last_session_at ?? now,
        ended_at: now,
        summary: args.summary,
        signals_captured: signals.length,
        signals_routed: routedCounts,
        domains_touched: args.changed_domains ?? [],
        decisions_made: args.decisions_made ?? [],
        unresolved: args.unresolved ?? [],
        context_injections: [],
    };

    writeFileSync(
        join(ctx.paths.sessionsDir, `${session.id}.yaml`),
        yamlStringify(session),
        "utf-8",
    );

    // 3. Regenerate views
    ctx.viewsEngine.regenerate();

    // 4. Update state
    const state = ctx.stateStore.load();
    state.last_session_at = now;
    try {
        const head = await ctx.gitEar.getHeadCommit();
        if (head) state.last_session_commit = head;
    } catch {}
    ctx.stateStore.save(state);

    return toolResult(
        JSON.stringify(
            {
                signals_processed: signals.length,
                new_staged: newStaged,
                new_memory: newMemory,
                views_regenerated: true,
            },
            null,
            2,
        ),
    );
}
