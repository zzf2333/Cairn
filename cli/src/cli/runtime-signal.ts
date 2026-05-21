import { createContext } from "../context.js";
import { signalAction } from "../actions/signal-action.js";

export async function runRuntimeSignal(args: string[]): Promise<void> {
    const flags = parseFlags(args);
    if (!flags.type || !flags.what) {
        console.error("Usage: cairn signal --type <signal_type> --what <description> [--domain <d>] [--reason <r>] [--user-said <s>] [--json]");
        process.exit(1);
    }

    const ctx = await createContext(process.env.CAIRN_ROOT ?? process.cwd());

    const result = await signalAction(ctx, {
        signal_type: flags.type,
        domain: flags.domain,
        details: {
            what: flags.what,
            reason: flags.reason,
        },
        evidence: {
            user_said: flags.userSaid,
        },
    });

    if (flags.json) {
        console.log(JSON.stringify(result));
        return;
    }

    const r = result as any;
    console.log(`Signal accepted: ${r.routing.destination} (${r.routing.level})`);
    if (r.warning) console.log(`Warning: ${r.warning}`);
    if (r.challenges?.length) {
        for (const c of r.challenges) {
            console.log(`[${c.level}] ${c.description}`);
        }
    }
}

function parseFlags(args: string[]): {
    type?: string; what?: string; domain?: string;
    reason?: string; userSaid?: string; json: boolean;
} {
    let type: string | undefined;
    let what: string | undefined;
    let domain: string | undefined;
    let reason: string | undefined;
    let userSaid: string | undefined;
    let json = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--type" && args[i + 1]) type = args[++i];
        else if (args[i] === "--what" && args[i + 1]) what = args[++i];
        else if (args[i] === "--domain" && args[i + 1]) domain = args[++i];
        else if (args[i] === "--reason" && args[i + 1]) reason = args[++i];
        else if (args[i] === "--user-said" && args[i + 1]) userSaid = args[++i];
        else if (args[i] === "--json") json = true;
    }

    return { type, what, domain, reason, userSaid, json };
}
