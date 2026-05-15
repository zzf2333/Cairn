#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { createCairnServer } from "./server.js";

const { server, runStartupScan, setRootResolver } = createCairnServer();
const transport = new StdioServerTransport();
await server.connect(transport);

setRootResolver(async () => {
    const { roots } = await Promise.race([
        server.server.listRoots(),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("roots timeout")), 2000),
        ),
    ]);
    if (roots.length > 0 && roots[0].uri.startsWith("file://")) {
        return fileURLToPath(roots[0].uri);
    }
    return undefined;
});

runStartupScan();
