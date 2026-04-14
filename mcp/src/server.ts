import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { handleCairnOutput } from "./tools/cairn-output.js";
import { handleCairnDomain } from "./tools/cairn-domain.js";
import { handleCairnQuery } from "./tools/cairn-query.js";
import { handleCairnPropose } from "./tools/cairn-propose.js";
import { handleCairnSyncDomain } from "./tools/cairn-sync-domain.js";
import { handleCairnMatch } from "./tools/cairn-match.js";
import { resolvePaths, findCairnRoot } from "./paths.js";

const VALID_ENTRY_TYPES = [
    "decision",
    "rejection",
    "transition",
    "debt",
    "experiment",
] as const;

/**
 * Create and configure the Cairn MCP server.
 *
 * Registers 6 tools + 2 resources:
 *
 * Tools:
 *   cairn_output        — Read Layer 1 global constraints (output.md)
 *   cairn_domain        — Read a Layer 2 domain design context file
 *   cairn_query         — Search Layer 3 history entries
 *   cairn_propose       — Draft a history entry to staging for human review
 *   cairn_sync_domain   — Generate context to regenerate a domain file
 *   cairn_match         — Match keywords against domain hooks (precise intent detection)
 *
 * Resources:
 *   cairn://output               — Static read of output.md
 *   cairn://domain/{name}        — Template read of a domain file
 */
export function createCairnServer(): McpServer {
    const server = new McpServer({
        name: "cairn",
        version: "0.0.2",
    });

    // =========================================================================
    // Tools
    // =========================================================================

    server.registerTool(
        "cairn_output",
        {
            title: "Read Cairn Global Constraints",
            description:
                "Read .cairn/output.md — the Layer 1 global constraint file. " +
                "Contains: stage (project phase), no-go (banned directions), " +
                "hooks (domain keywords), stack (active tech), debt (accepted debts). " +
                "Read this at the start of every session.",
        },
        () => handleCairnOutput(),
    );

    server.registerTool(
        "cairn_domain",
        {
            title: "Read Cairn Domain Context",
            description:
                "Read a specific .cairn/domains/<name>.md file — Layer 2 domain design context. " +
                "Contains: current design, trajectory, rejected paths (with re-evaluate conditions), " +
                "known pitfalls, and open questions. " +
                "Read this when the user's request matches a domain's hook keywords.",
            inputSchema: {
                name: z
                    .string()
                    .describe(
                        "Domain name in kebab-case (e.g., 'api-layer', 'auth', 'state-management')",
                    ),
            },
        },
        (args) => handleCairnDomain(args),
    );

    server.registerTool(
        "cairn_query",
        {
            title: "Search Cairn History Entries",
            description:
                "Search .cairn/history/ entries — Layer 3 raw decision events. " +
                "Returns full history entries sorted chronologically by decision_date. " +
                "Use this to look up specific past decisions, rejected alternatives, or accepted debts.",
            inputSchema: {
                domain: z
                    .string()
                    .optional()
                    .describe("Filter by domain name (e.g., 'api-layer')"),
                type: z
                    .enum(VALID_ENTRY_TYPES)
                    .optional()
                    .describe(
                        "Filter by entry type: decision, rejection, transition, debt, or experiment",
                    ),
            },
        },
        (args) => handleCairnQuery(args),
    );

    server.registerTool(
        "cairn_propose",
        {
            title: "Propose a New Cairn History Entry",
            description:
                "Draft a new history entry to .cairn/staged/ for human review. " +
                "The entry must be manually moved to .cairn/history/ by a human before " +
                "it becomes canonical. The 'rejected' field is the most critical — " +
                "it records what alternatives were considered and not chosen.",
            inputSchema: {
                type: z
                    .enum(VALID_ENTRY_TYPES)
                    .describe("Entry type: decision, rejection, transition, debt, or experiment"),
                domain: z
                    .string()
                    .describe("Domain name from the project's locked domain list"),
                decision_date: z
                    .string()
                    .regex(/^\d{4}-\d{2}$/)
                    .describe("When the decision happened (YYYY-MM format)"),
                summary: z.string().describe("One-sentence summary of what happened"),
                rejected: z
                    .string()
                    .describe(
                        "MOST CRITICAL: What alternatives were considered and not chosen. " +
                        "Even for 'decision' types, record what was evaluated and discarded.",
                    ),
                reason: z.string().describe("Why this path was taken"),
                revisit_when: z
                    .string()
                    .optional()
                    .describe("Condition under which this decision should be reconsidered"),
            },
        },
        (args) => handleCairnPropose(args),
    );

    server.registerTool(
        "cairn_sync_domain",
        {
            title: "Generate Domain File Sync Context",
            description:
                "Generate context to regenerate a .cairn/domains/<name>.md file from history. " +
                "Returns the current domain file + all matching history entries + the format template. " +
                "Use the returned context to write an updated domain file, then confirm with the human.",
            inputSchema: {
                name: z
                    .string()
                    .describe("Domain name to sync (e.g., 'api-layer', 'auth')"),
            },
        },
        (args) => handleCairnSyncDomain(args),
    );

    server.registerTool(
        "cairn_match",
        {
            title: "Match Keywords to Cairn Domains",
            description:
                "Match keywords from the user's request against domain file hooks — " +
                "precise machine-level intent detection without AI inference. " +
                "Call this with keywords from the user's request, then call cairn_domain() " +
                "for each matched domain to load relevant design context.",
            inputSchema: {
                keywords: z
                    .array(z.string())
                    .describe(
                        "Keywords from the user's request (e.g., ['api', 'endpoint', 'design'])",
                    ),
            },
        },
        (args) => handleCairnMatch(args),
    );

    // =========================================================================
    // Resources
    // =========================================================================

    // Static resource: cairn://output → output.md
    server.registerResource(
        "cairn-output",
        "cairn://output",
        {
            title: "Cairn Global Constraints",
            description:
                "Layer 1: global constraints from .cairn/output.md. " +
                "Should be loaded at the start of every AI session.",
            mimeType: "text/markdown",
        },
        () => {
            try {
                const paths = resolvePaths();
                if (!existsSync(paths.outputMd)) {
                    return {
                        contents: [
                            {
                                uri: "cairn://output",
                                mimeType: "text/markdown",
                                text: "# output.md not found\n\nRun `cairn init` to initialize.",
                            },
                        ],
                    };
                }
                const content = readFileSync(paths.outputMd, "utf-8");
                return {
                    contents: [
                        {
                            uri: "cairn://output",
                            mimeType: "text/markdown",
                            text: content,
                        },
                    ],
                };
            } catch {
                return {
                    contents: [
                        {
                            uri: "cairn://output",
                            mimeType: "text/markdown",
                            text: "# Error\n\nNo .cairn/ directory found.",
                        },
                    ],
                };
            }
        },
    );

    // Template resource: cairn://domain/{name} → domains/<name>.md
    server.registerResource(
        "cairn-domain",
        new ResourceTemplate("cairn://domain/{name}", {
            list: () => {
                try {
                    const root = findCairnRoot();
                    if (!root) return { resources: [] };

                    const domainsDir = join(root, ".cairn", "domains");
                    const files = existsSync(domainsDir)
                        ? readdirSync(domainsDir).filter((f) => f.endsWith(".md"))
                        : [];

                    return {
                        resources: files.map((f) => {
                            const name = f.replace(/\.md$/, "");
                            return {
                                uri: `cairn://domain/${name}`,
                                name: `Cairn domain: ${name}`,
                                mimeType: "text/markdown",
                            };
                        }),
                    };
                } catch {
                    return { resources: [] };
                }
            },
        }),
        {
            title: "Cairn Domain Context",
            description:
                "Layer 2: domain design context from .cairn/domains/<name>.md",
            mimeType: "text/markdown",
        },
        (uri, { name }) => {
            try {
                const root = findCairnRoot();
                if (!root) {
                    return {
                        contents: [
                            {
                                uri: uri.href,
                                mimeType: "text/markdown",
                                text: "# Error\n\nNo .cairn/ directory found.",
                            },
                        ],
                    };
                }

                const domainFile = join(root, ".cairn", "domains", `${name}.md`);
                if (!existsSync(domainFile)) {
                    return {
                        contents: [
                            {
                                uri: uri.href,
                                mimeType: "text/markdown",
                                text: `# Domain '${name}' not found\n\nThis domain file has not been created yet.`,
                            },
                        ],
                    };
                }

                const content = readFileSync(domainFile, "utf-8");
                return {
                    contents: [
                        {
                            uri: uri.href,
                            mimeType: "text/markdown",
                            text: content,
                        },
                    ],
                };
            } catch {
                return {
                    contents: [
                        {
                            uri: uri.href,
                            mimeType: "text/markdown",
                            text: `# Error reading domain '${name}'`,
                        },
                    ],
                };
            }
        },
    );

    return server;
}
