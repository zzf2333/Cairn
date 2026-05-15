#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { createCairnServer } from "./server.js";

const { server, runStartupScan, setProjectRoot } = createCairnServer();
const transport = new StdioServerTransport();
await server.connect(transport);

try {
    const { roots } = await server.server.listRoots();
    if (roots.length > 0 && roots[0].uri.startsWith("file://")) {
        setProjectRoot(fileURLToPath(roots[0].uri));
    }
} catch {
    // Client doesn't support roots — fall back to process.cwd()
}

runStartupScan();
