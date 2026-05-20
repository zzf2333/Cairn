#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createContext } from "./context.js";
import { loadMcpInstructions } from "./skill-paths.js";

async function main(): Promise<void> {
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);
    const instructions = await loadMcpInstructions();
    const server = createServer(ctx, instructions);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    ctx.hostName = server.server.getClientVersion()?.name ?? "unknown";
}

main().catch((error) => {
    process.stderr.write(`cairn: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
