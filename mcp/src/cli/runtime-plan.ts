import { createContext } from "../context.js";
import { planAction, ContextNotLoadedError } from "../actions/plan-action.js";

export async function runRuntimePlan(args: string[]): Promise<void> {
    const flags = parseFlags(args);
    if (!flags.task) {
        console.error("Usage: cairn plan --task <description> [--json]");
        process.exit(1);
    }

    const ctx = await createContext(process.env.CAIRN_ROOT ?? process.cwd());

    try {
        const result = await planAction(ctx, { task: flags.task });

        if (flags.json) {
            console.log(JSON.stringify(result));
            return;
        }

        const r = result as any;
        console.log(`Task: ${r.task}`);
        console.log(`Stage: ${r.stage_guidance.phase} (confidence: ${r.stage_guidance.confidence})`);
        if (r.dna_guidance.length) console.log(`DNA: ${r.dna_guidance.join(", ")}`);
        if (r.warnings.length) {
            console.log("Warnings:");
            for (const w of r.warnings) console.log(`  ${w}`);
        }
        if (r.historical_constraints.length) {
            console.log("Historical constraints:");
            for (const c of r.historical_constraints) console.log(`  ${c}`);
        }
    } catch (error) {
        if (error instanceof ContextNotLoadedError) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
        throw error;
    }
}

function parseFlags(args: string[]): { task?: string; json: boolean } {
    let task: string | undefined;
    let json = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--task" && args[i + 1]) task = args[++i];
        else if (args[i] === "--json") json = true;
    }

    return { task, json };
}
