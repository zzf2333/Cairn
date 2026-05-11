#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCairnServer } from "./server.js";

const server = createCairnServer();
const transport = new StdioServerTransport();
await server.connect(transport);
