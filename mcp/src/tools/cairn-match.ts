import { NO_CAIRN_DIR_MSG, formatToolError } from "../errors.js";
import { resolvePaths } from "../paths.js";
import { buildHooksIndex, matchKeywords } from "../hooks.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

/**
 * cairn_match — Match keywords against domain hooks for precise intent detection.
 *
 * This tool implements the core architectural benefit of Cairn's Frontmatter
 * hooks: instead of relying on AI inference to decide which domain files to
 * read, the MCP server performs deterministic keyword matching against the
 * `hooks` field in each domain file's YAML frontmatter.
 *
 * Workflow:
 *   1. Extract keywords from the user's request
 *   2. Call cairn_match(keywords) to find relevant domains
 *   3. Call cairn_domain(name) for each matched domain
 *   4. Use the domain context to improve your response
 *
 * Matching is case-insensitive. Returns matched domains and which keywords
 * triggered each match.
 */
export function handleCairnMatch(args: { keywords: string[] }): ToolResult {
    const { keywords } = args;

    if (!keywords || keywords.length === 0) {
        return formatToolError(new Error("At least one keyword is required."));
    }

    try {
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        const matches = matchKeywords(index, keywords);

        if (matches.size === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `No domains matched the given keywords: ${keywords.join(", ")}.\n` +
                            "This topic may not have Cairn domain coverage, or domain files have not been created yet.",
                    },
                ],
            };
        }

        const lines: string[] = ["Matched domains:"];
        const callLines: string[] = [];

        for (const [domain, matched] of matches.entries()) {
            lines.push(`- ${domain} (matched: ${matched.join(", ")})`);
            callLines.push(`cairn_domain("${domain}")`);
        }

        lines.push("");
        lines.push(
            `Recommendation: call ${callLines.join(" and ")} to load context for these domains.`,
        );

        return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("No .cairn/ directory found")
        ) {
            return formatToolError(new Error(NO_CAIRN_DIR_MSG));
        }
        return formatToolError(error);
    }
}
