#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createContext } from "./context.js";

async function main(): Promise<void> {
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);
    const server = createServer(ctx);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    process.stderr.write(`cairn: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
