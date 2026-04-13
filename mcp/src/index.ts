#!/usr/bin/env node
/**
 * Cairn MCP Server — stdio entry point
 *
 * Usage:
 *   node dist/index.js
 *
 * Configuration:
 *   CAIRN_ROOT env var — path to the project root containing .cairn/
 *   If not set, walks up from process.cwd() to find .cairn/
 *
 * MCP client configuration (Claude Code, Cursor, Claude Desktop):
 *   {
 *     "mcpServers": {
 *       "cairn": {
 *         "command": "node",
 *         "args": ["/path/to/cairn/mcp/dist/index.js"]
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCairnServer } from "./server.js";

const server = createCairnServer();
const transport = new StdioServerTransport();
await server.connect(transport);
