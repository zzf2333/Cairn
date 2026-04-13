import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { NO_CAIRN_DIR_MSG, formatToolError } from "../errors.js";
import { resolvePaths } from "../paths.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

/**
 * cairn_domain — Read a specific Cairn Layer 2 domain design context file.
 *
 * Domain files contain pre-compressed design context for a specific area of
 * the codebase: current design, trajectory, rejected paths (with re-evaluate
 * conditions), known pitfalls, and open questions.
 *
 * Read this when the user's request matches keywords in the hooks section of
 * output.md, or when cairn_match() returns this domain.
 */
export function handleCairnDomain(args: { name: string }): ToolResult {
    const { name } = args;

    // Validate domain name format (kebab-case)
    if (!/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)?$/.test(name)) {
        return formatToolError(
            new Error(
                `Invalid domain name '${name}'. Domain names must be kebab-case (e.g., 'api-layer', 'auth').`,
            ),
        );
    }

    try {
        const paths = resolvePaths();
        const domainFile = join(paths.domainsDir, `${name}.md`);

        if (!existsSync(domainFile)) {
            // List available domains to help the caller
            let available: string[] = [];
            try {
                available = readdirSync(paths.domainsDir)
                    .filter((f) => f.endsWith(".md"))
                    .map((f) => f.replace(/\.md$/, ""));
            } catch {
                // domainsDir doesn't exist
            }

            const hint =
                available.length > 0
                    ? `\n\nAvailable domains: ${available.join(", ")}`
                    : "\n\nNo domain files have been created yet. Record history entries first, then run `cairn sync` to generate domain files.";

            return formatToolError(
                new Error(`Domain file '${name}' not found.${hint}`),
            );
        }

        const content = readFileSync(domainFile, "utf-8");
        return { content: [{ type: "text", text: content }] };
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
