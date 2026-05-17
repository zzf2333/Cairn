import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

export interface McpBridge {
    client: Client;
    transport: StdioClientTransport;
    tools: McpTool[];
    instructions: string;
    callTool: (name: string, args: Record<string, unknown>) => Promise<{ text: string; isError: boolean }>;
    close: () => Promise<void>;
}

/**
 * Spawn a fresh MCP server process pinned to the given project root.
 * Returns an MCP client and the list of tools the server exposes.
 */
export async function startMcp(projectRoot: string): Promise<McpBridge> {
    const serverPath = resolve(import.meta.dirname, "../../../dist/index.js");
    const transport = new StdioClientTransport({
        command: process.execPath, // node binary
        args: [serverPath],
        env: {
            ...process.env,
            CAIRN_ROOT: resolve(projectRoot),
        } as Record<string, string>,
        stderr: "ignore",
    });

    const client = new Client(
        { name: "scenario-runner", version: "0.1.0" },
        { capabilities: {} },
    );

    await client.connect(transport);

    const listed = await client.listTools();
    const tools: McpTool[] = listed.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
    }));

    // MCP server.instructions is on the server info; we read it from a separate call result if present.
    const instructions = ""; // not strictly needed — drivers inject their own platform prompt

    async function callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
        const res = await client.callTool({ name, arguments: args });
        const isError = Boolean(res.isError);
        let text = "";
        if (Array.isArray(res.content)) {
            for (const block of res.content) {
                if ((block as { type?: string }).type === "text") {
                    text += (block as { text?: string }).text ?? "";
                }
            }
        }
        return { text, isError };
    }

    async function close(): Promise<void> {
        try {
            await client.close();
        } catch {
            // ignore
        }
    }

    return { client, transport, tools, instructions, callTool, close };
}
