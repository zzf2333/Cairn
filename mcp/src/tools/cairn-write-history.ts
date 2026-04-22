import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NO_CAIRN_DIR_MSG, formatToolError } from "../errors.js";
import { resolvePaths } from "../paths.js";
import { slugify, serializeHistoryEntry } from "../staging.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

/**
 * cairn_write_history — Directly write a history entry to .cairn/history/.
 *
 * In v0.0.12, AI writes history entries directly using file tools (Write/Edit).
 * This MCP tool serves pure-MCP clients that cannot use file tools directly.
 * No staging, no human gate — the entry is written directly to history/.
 *
 * The `rejected` field is the most critical field — it records what alternatives
 * were considered and not chosen. This is what prevents AI from re-proposing
 * already-evaluated options.
 */
export async function handleCairnWriteHistory(args: {
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

        // Build filename: YYYY-MM_<slug>.md
        const filename = `${decision_date}_${slugify(summary)}.md`;
        const historyPath = join(paths.historyDir, filename);

        if (existsSync(historyPath)) {
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `A history entry already exists at .cairn/history/${filename}\n` +
                            "Use a different summary or decision_date to avoid the conflict.",
                    },
                ],
                isError: true,
            };
        }

        mkdirSync(paths.historyDir, { recursive: true });

        const now = new Date();
        const recordedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        const content = serializeHistoryEntry(
            { type, domain, decision_date, summary, rejected, reason, revisit_when },
            recordedDate,
        );

        writeFileSync(historyPath, content, "utf-8");

        return {
            content: [
                {
                    type: "text",
                    text: [
                        `cairn: recorded 1 event: history/${filename}`,
                        "",
                        "Entry written directly to .cairn/history/ (no staging).",
                        "",
                        "Entry content:",
                        "---",
                        content.trim(),
                    ].join("\n"),
                },
            ],
        };
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
