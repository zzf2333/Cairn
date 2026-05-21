import { createContext } from "../context.js";
import { contextAction } from "../actions/context-action.js";

export async function runRuntimeContext(args: string[]): Promise<void> {
    const flags = parseFlags(args);
    const ctx = await createContext(process.env.CAIRN_ROOT ?? process.cwd());

    const result = await contextAction(ctx, {
        task: flags.task,
        files: flags.files,
    });

    if (flags.json) {
        console.log(JSON.stringify(result));
        return;
    }

    const session = result.session as any;
    console.log(`Session: ${session.id} (${session.status})`);
    if (session.recovery_required) {
        console.log(`⚠ Recovery required: ${session.required_action}`);
        return;
    }
    if (result.interaction_hint) console.log(`Hint: ${result.interaction_hint}`);
    if (result.observe_reminder) console.log(result.observe_reminder);

    const constraints = result.constraints as any;
    if (constraints) {
        if (constraints.no_go?.length) console.log(`No-go: ${constraints.no_go.map((n: any) => n.what).join(", ")}`);
        if (constraints.accepted_debt?.length) console.log(`Accepted debt: ${constraints.accepted_debt.length}`);
    }

    const challenges = result.challenges as any[];
    if (challenges?.length) {
        for (const c of challenges) {
            console.log(`[${c.level}] ${c.description}`);
        }
    }
}

function parseFlags(args: string[]): { task?: string; files?: string[]; json: boolean } {
    let task: string | undefined;
    let files: string[] | undefined;
    let json = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--task" && args[i + 1]) task = args[++i];
        else if (args[i] === "--files" && args[i + 1]) files = args[++i].split(",");
        else if (args[i] === "--json") json = true;
    }

    return { task, files, json };
}
