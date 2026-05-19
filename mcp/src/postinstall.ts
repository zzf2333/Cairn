#!/usr/bin/env node
import { platform, homedir } from "node:os";
import { join } from "node:path";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

function getMcpConfigPaths(): { tool: string; path: string }[] {
    const home = homedir();
    const os = platform();

    const paths: { tool: string; path: string }[] = [
        { tool: "Claude Code", path: join(home, ".claude", "mcp.json") },
        { tool: "Cursor", path: ".cursor/mcp.json (project)" },
    ];

    if (os === "darwin") {
        paths.push({
            tool: "Claude Desktop",
            path: join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
        });
    } else if (os === "win32") {
        paths.push({
            tool: "Claude Desktop",
            path: join(home, "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
        });
    }

    paths.push({ tool: "Codex CLI", path: join(home, ".codex", "config.toml") });

    return paths;
}

function main() {
    const paths = getMcpConfigPaths();

    console.log("");
    console.log(`${BOLD}${CYAN}cairn-mcp-server${RESET} installed successfully.`);
    console.log("");
    console.log(`${BOLD}Next step:${RESET} Add cairn to your AI tool's MCP configuration:`);
    console.log("");
    console.log(`${DIM}  {`);
    console.log(`    "mcpServers": {`);
    console.log(`      "cairn": { "command": "cairn-mcp-server" }`);
    console.log(`    }`);
    console.log(`  }${RESET}`);
    console.log("");
    console.log("  Config file locations:");
    for (const { tool, path } of paths) {
        console.log(`    ${BOLD}${tool}${RESET} — ${path}`);
    }
    console.log("");
    console.log(`  Then open your AI tool in a project — it will auto-initialize on first use.`);
    console.log("");
    console.log(`${BOLD}Optional:${RESET} Install the Cairn protocol into your project instructions:`);
    console.log("");
    console.log(`  cairn skill install              ${DIM}# auto-detect platform${RESET}`);
    console.log(`  cairn skill install claude-code   ${DIM}# → CLAUDE.md${RESET}`);
    console.log(`  cairn skill install codex          ${DIM}# → AGENTS.md${RESET}`);
    console.log(`  cairn skill install cursor         ${DIM}# → .cursorrules${RESET}`);
    console.log("");
    console.log(`  This installs the Cognitive Runtime Protocol — the rules that make`);
    console.log(`  your AI tool actively use Cairn instead of ignoring it.`);
    console.log("");
}

main();
