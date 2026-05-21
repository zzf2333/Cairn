import { createContext } from "../context.js";
import { sessionEndAction } from "../actions/session-end-action.js";

export async function runRuntimeSessionEnd(args: string[]): Promise<void> {
    const flags = parseFlags(args);
    if (!flags.summary) {
        console.error("Usage: cairn session-end --summary <description> [--domains <d1,d2>] [--decisions <d1,d2>] [--unresolved <u1,u2>] [--json]");
        process.exit(1);
    }

    const ctx = await createContext(process.env.CAIRN_ROOT ?? process.cwd());

    const result = await sessionEndAction(ctx, {
        summary: flags.summary,
        changed_domains: flags.domains,
        decisions_made: flags.decisions,
        unresolved: flags.unresolved,
    });

    if (flags.json) {
        console.log(JSON.stringify(result));
        return;
    }

    const r = result as any;
    console.log(`Session ${r.session.id} ended`);
    console.log(`Signals processed: ${r.signals_processed}`);
    if (r.highlights.length) {
        for (const h of r.highlights) console.log(`  ${h}`);
    }
}

function parseFlags(args: string[]): {
    summary?: string; domains?: string[]; decisions?: string[];
    unresolved?: string[]; json: boolean;
} {
    let summary: string | undefined;
    let domains: string[] | undefined;
    let decisions: string[] | undefined;
    let unresolved: string[] | undefined;
    let json = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--summary" && args[i + 1]) summary = args[++i];
        else if (args[i] === "--domains" && args[i + 1]) domains = args[++i].split(",");
        else if (args[i] === "--decisions" && args[i + 1]) decisions = args[++i].split(",");
        else if (args[i] === "--unresolved" && args[i + 1]) unresolved = args[++i].split(",");
        else if (args[i] === "--json") json = true;
    }

    return { summary, domains, decisions, unresolved, json };
}
