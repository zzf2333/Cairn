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
    console.log("Next: configure cairn-mcp-server in your AI tool's MCP settings:");
    console.log("");
    console.log('  { "mcpServers": { "cairn": { "command": "cairn-mcp-server" } } }');
    console.log("");
    console.log("  Claude Code  — ~/.claude/mcp.json");
    console.log("  Cursor       — .cursor/mcp.json");
    console.log("  Codex CLI    — ~/.codex/config.toml");
    console.log("");
    console.log("Then open your AI tool — it will call cairn_init_status() and begin");
    console.log("AI-native initialization automatically.");
}
