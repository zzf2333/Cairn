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
    console.log("Note: the MCP server auto-bootstraps on startup if .cairn/ is missing,");
    console.log("so this step is optional. It is useful for pre-creating the directory");
    console.log("structure before configuring your AI tool.");
    console.log("");
    console.log("Next: configure cairn-rt in your AI tool's MCP settings:");
    console.log("");
    console.log('  { "mcpServers": { "cairn": { "command": "cairn-rt" } } }');
    console.log("");
    console.log("  Claude Code  — .claude/mcp.json");
    console.log("  Cursor       — .cursor/mcp.json");
    console.log("  Codex CLI    — codex --mcp-server cairn=cairn-rt");
    console.log("");
    console.log("On first use, the AI will call cairn_init_status() to get a structured");
    console.log("initialization guide with analysis steps and valid enum values.");
}
