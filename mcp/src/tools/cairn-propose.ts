import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { NO_CAIRN_DIR_MSG, formatToolError } from "../errors.js";
import { resolvePaths } from "../paths.js";
import { extractLockedDomains } from "../parsers/output.js";
import { stageEntry, generateFilename } from "../staging.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

/**
 * cairn_propose — Draft a new history entry to the staging area for human review.
 *
 * This is the write-path tool. The AI proposes; the human approves.
 * Staged entries are written to .cairn/staged/ and must be manually moved
 * to .cairn/history/ by a human before they become canonical.
 *
 * The `rejected` field is the most critical field — it records what alternatives
 * were considered and not chosen. Even for decision entries, this MUST capture
 * alternatives that were evaluated and discarded.
 *
 * Human approval workflow:
 *   cat .cairn/staged/<filename>
 *   mv .cairn/staged/<filename> .cairn/history/
 */
export async function handleCairnPropose(args: {
    type: string;
    domain: string;
    decision_date: string;
    summary: string;
    rejected: string;
    reason: string;
    revisit_when?: string;
}): Promise<ToolResult> {
    const { type, domain, decision_date, summary, rejected, reason, revisit_when } =
        args;

    try {
        const paths = resolvePaths();

        // Check if domain is in the locked list — warn but don't block
        let domainWarning = "";
        if (existsSync(paths.outputMd)) {
            try {
                const outputContent = readFileSync(paths.outputMd, "utf-8");
                const lockedDomains = extractLockedDomains(outputContent);
                if (
                    lockedDomains.length > 0 &&
                    !lockedDomains.includes(domain)
                ) {
                    domainWarning =
                        `\n\nWarning: '${domain}' is not in the locked domain list from output.md.\n` +
                        `Locked domains: ${lockedDomains.join(", ")}\n` +
                        "The entry has been staged anyway. Verify the domain name before approving.";
                }
            } catch {
                // If we can't read output.md, skip domain validation
            }
        }

        const entry = {
            type,
            domain,
            decision_date,
            summary,
            rejected,
            reason,
            revisit_when,
        };

        const { filepath, content } = await stageEntry(
            paths.stagedDir,
            paths.historyDir,
            entry,
        );

        const filename = generateFilename(decision_date, summary);
        const relativePath = `.cairn/staged/${filename}`;

        // Strip history-candidate_ prefix to get the canonical history filename
        const historyFilename = filename.replace(/^history-candidate_/, "");
        const message = [
            `Proposed entry staged at ${relativePath}`,
            "",
            "To review and approve (cairn stage review strips prefix automatically):",
            "  cairn stage review",
            "",
            "To approve manually (strip prefix, move to history):",
            `  mv ${relativePath} .cairn/history/${historyFilename}`,
            "",
            "To discard:",
            `  rm ${relativePath}`,
            "",
            "To edit before approving:",
            `  $EDITOR ${relativePath}`,
            `  mv ${relativePath} .cairn/history/${historyFilename}`,
            "",
            "Entry content:",
            "---",
            content.trim(),
            domainWarning,
        ]
            .filter((l) => l !== undefined)
            .join("\n");

        return { content: [{ type: "text", text: message }] };
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
