import { bootstrapEmpty } from "../bootstrap.js";

export async function runInit(args: string[]): Promise<void> {
    const silent = args.includes("--empty");

    await bootstrapEmpty(process.cwd());

    if (silent) {
        console.log("Cairn initialized (empty structure)");
        return;
    }

    console.log("Cairn initialized — .cairn/ scaffold created.");
    console.log("");
    console.log("Note: the cairn CLI auto-bootstraps .cairn/ on first use,");
    console.log("so this step is optional. It is useful for pre-creating the");
    console.log("directory structure before your first AI session.");
    console.log("");
    console.log("Next: install the protocol skill if you haven't already:");
    console.log("");
    console.log("  npx skills add zzf2333/Cairn           # Claude Code");
    console.log("  cairn skill show codex >> AGENTS.md     # Codex");
    console.log("  cairn skill show cursor >> .cursorrules  # Cursor");
    console.log("");
    console.log("Then tell your AI tool: Initialize Cairn for this project");
}
