import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NO_CAIRN_DIR_MSG, formatToolError } from "../errors.js";
import { resolvePaths } from "../paths.js";
import {
    parseHistoryEntry,
    sortHistoryEntries,
    type HistoryEntry,
} from "../parsers/history.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

const VALID_TYPES = [
    "decision",
    "rejection",
    "transition",
    "debt",
    "experiment",
] as const;

type EntryType = (typeof VALID_TYPES)[number];

/**
 * cairn_query — Search Cairn Layer 3 history entries.
 *
 * Returns full history entries matching the given filters.
 * Entries are sorted chronologically by decision_date (oldest first).
 *
 * Use this when you need to:
 * - Understand what decisions were made in a domain
 * - Look up specific rejected alternatives
 * - Find all accepted debts or experiments
 */
export function handleCairnQuery(args: {
    domain?: string;
    type?: string;
}): ToolResult {
    const { domain, type } = args;

    // Validate type if provided
    if (type && !VALID_TYPES.includes(type as EntryType)) {
        return formatToolError(
            new Error(
                `Invalid type '${type}'. Valid types: ${VALID_TYPES.join(", ")}`,
            ),
        );
    }

    try {
        const paths = resolvePaths();
        const entries = loadAllHistoryEntries(paths.historyDir);

        // Apply filters
        let filtered = entries;
        if (domain) {
            filtered = filtered.filter((e) => e.domain === domain);
        }
        if (type) {
            filtered = filtered.filter((e) => e.type === type);
        }

        const sorted = sortHistoryEntries(filtered);

        if (sorted.length === 0) {
            const filterDesc = buildFilterDesc(domain, type);
            return {
                content: [
                    {
                        type: "text",
                        text: `No history entries found${filterDesc}.`,
                    },
                ],
            };
        }

        const filterDesc = buildFilterDesc(domain, type);
        const header = `Found ${sorted.length} history entr${sorted.length === 1 ? "y" : "ies"}${filterDesc}:\n\n`;
        const body = sorted
            .map((e) => `---\nFile: ${e.filename}\n${e.raw.trim()}`)
            .join("\n\n");

        return { content: [{ type: "text", text: header + body }] };
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

function loadAllHistoryEntries(historyDir: string): HistoryEntry[] {
    let files: string[];
    try {
        files = readdirSync(historyDir)
            .filter((f) => f.endsWith(".md") && f !== "_TEMPLATE.md")
            .sort();
    } catch {
        return [];
    }

    return files.map((filename) => {
        const content = readFileSync(join(historyDir, filename), "utf-8");
        return parseHistoryEntry(content, filename);
    });
}

function buildFilterDesc(domain?: string, type?: string): string {
    const parts: string[] = [];
    if (domain) parts.push(`domain=${domain}`);
    if (type) parts.push(`type=${type}`);
    return parts.length > 0 ? ` matching ${parts.join(", ")}` : "";
}
