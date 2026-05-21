import { readFile } from "node:fs/promises";
import { createContext } from "../context.js";
import { observeAction } from "../actions/observe-action.js";

export async function runRuntimeObserve(args: string[]): Promise<void> {
    const flags = parseFlags(args);
    if (!flags.summary) {
        console.error("Usage: cairn observe --summary <description> [--candidates-file <path>] [--json]");
        process.exit(1);
    }

    const ctx = await createContext(process.env.CAIRN_ROOT ?? process.cwd());

    let candidates: any[] = [];
    if (flags.candidatesFile) {
        const raw = await readFile(flags.candidatesFile, "utf-8");
        candidates = JSON.parse(raw);
    }

    const result = await observeAction(ctx, {
        summary: flags.summary,
        candidates,
    });

    if (flags.json) {
        console.log(JSON.stringify(result));
        return;
    }

    const r = result as any;
    console.log(`Observed: ${r.total_candidates} candidates (${r.captured} captured, ${r.skipped} skipped, ${r.staged} staged)`);
    console.log(r.instruction);
}

function parseFlags(args: string[]): { summary?: string; candidatesFile?: string; json: boolean } {
    let summary: string | undefined;
    let candidatesFile: string | undefined;
    let json = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--summary" && args[i + 1]) summary = args[++i];
        else if (args[i] === "--candidates-file" && args[i + 1]) candidatesFile = args[++i];
        else if (args[i] === "--json") json = true;
    }

    return { summary, candidatesFile, json };
}
