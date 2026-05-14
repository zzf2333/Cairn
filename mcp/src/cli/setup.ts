import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

interface SetupResult {
    tool: string;
    status: "registered" | "already" | "not_found" | "error";
    message: string;
}

function getConfigPaths() {
    const home = homedir();
    const p = platform();
    return {
        claudeCode: join(home, ".claude", "mcp.json"),
        claudeDesktop:
            p === "darwin"
                ? join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
                : p === "win32"
                    ? join(process.env["APPDATA"] || join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
                    : join(home, ".config", "Claude", "claude_desktop_config.json"),
        cursor: join(home, ".cursor", "mcp.json"),
        windsurf: join(home, ".codeium", "windsurf", "mcp_config.json"),
    };
}

async function hasClaudeCli(): Promise<boolean> {
    try {
        await execFileP("claude", ["--version"]);
        return true;
    } catch {
        return false;
    }
}

async function registerClaudeCode(): Promise<SetupResult> {
    const tool = "Claude Code";
    try {
        if (await hasClaudeCli()) {
            try {
                await execFileP("claude", ["mcp", "add", "cairn", "--", "cairn-mcp-server"]);
                return { tool, status: "registered", message: "via claude mcp add" };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (msg.includes("already exists")) {
                    return { tool, status: "already", message: "already configured" };
                }
            }
        }
        return registerViaConfigFile(getConfigPaths().claudeCode, tool, "claudeCode", ENTRY_NPX);
    } catch {
        return { tool, status: "error", message: "registration failed" };
    }
}

interface McpEntry {
    command: string;
    args?: string[];
}

const ENTRY_NPX: McpEntry = { command: "npx", args: ["-y", "cairn-mcp-server"] };

function registerViaConfigFile(
    configPath: string,
    toolName: string,
    toolKey: string,
    entry: McpEntry = ENTRY_NPX,
): SetupResult {
    const parentDir = dirname(configPath);
    if (toolKey !== "claudeCode" && !existsSync(parentDir)) {
        return { tool: toolName, status: "not_found", message: "not installed" };
    }

    try {
        let config: Record<string, unknown> = {};
        if (existsSync(configPath)) {
            config = JSON.parse(readFileSync(configPath, "utf-8"));
        }

        const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
        if (servers.cairn) {
            return { tool: toolName, status: "already", message: "already configured" };
        }

        servers.cairn = entry;
        config.mcpServers = servers;

        mkdirSync(parentDir, { recursive: true });
        writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
        return { tool: toolName, status: "registered", message: configPath };
    } catch {
        return { tool: toolName, status: "error", message: "write failed" };
    }
}

export async function runSetup(args: string[]): Promise<void> {
    const quiet = args.includes("--quiet");
    const paths = getConfigPaths();

    const results: SetupResult[] = [];

    results.push(await registerClaudeCode());
    results.push(registerViaConfigFile(paths.claudeDesktop, "Claude Desktop", "claudeDesktop", ENTRY_NPX));
    results.push(registerViaConfigFile(paths.cursor, "Cursor", "cursor", ENTRY_NPX));
    results.push(registerViaConfigFile(paths.windsurf, "Windsurf", "windsurf", ENTRY_NPX));

    if (quiet) {
        const registered = results.filter((r) => r.status === "registered");
        if (registered.length > 0) {
            const names = registered.map((r) => r.tool).join(", ");
            console.log(`cairn: MCP server registered with ${names}`);
        }
        return;
    }

    console.log("\nCairn MCP Setup\n");
    for (const r of results) {
        const icon =
            r.status === "registered" ? "✓" :
            r.status === "already" ? "✓" :
            r.status === "not_found" ? "-" : "✗";
        const label =
            r.status === "registered" ? "registered" :
            r.status === "already" ? "already configured" :
            r.status === "not_found" ? "not found" : "error";
        console.log(`  ${icon} ${r.tool.padEnd(18)} ${label}`);
    }

    const anyRegistered = results.some((r) => r.status === "registered" || r.status === "already");
    if (anyRegistered) {
        console.log("\nCairn MCP server is ready. Open your AI tool to start using it.");
    } else {
        console.log("\nNo AI tools detected. Configure manually:");
        console.log('  { "mcpServers": { "cairn": { "command": "cairn-mcp-server" } } }');
    }
}
