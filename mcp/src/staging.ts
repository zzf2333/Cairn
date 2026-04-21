import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CairnError, CairnErrorCode } from "./errors.js";

export interface HistoryEntryInput {
    type: string;
    domain: string;
    decision_date: string;
    summary: string;
    rejected: string;
    reason: string;
    revisit_when?: string;
}

/**
 * Convert text to a kebab-case filename slug (max 40 chars).
 * Mirrors cli/cmd/log.sh's _log_slugify() function.
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40)
        .replace(/-+$/, "");
}

/** Generate the staged candidate filename from decision_date and summary.
 *  Prefixed with history-candidate_ so cairn stage review routes it correctly. */
export function generateFilename(
    decisionDate: string,
    summary: string,
): string {
    return `history-candidate_${decisionDate}_${slugify(summary)}.md`;
}

/**
 * Serialize a history entry to bare key:value format (no --- delimiters).
 * Multi-line values use 2-space indent continuation lines.
 *
 * This format matches spec/FORMAT.md Layer 3 requirements.
 */
export function serializeHistoryEntry(
    entry: HistoryEntryInput,
    recordedDate: string,
): string {
    const lines: string[] = [];

    const appendField = (key: string, value: string) => {
        const valueLines = value.split("\n");
        lines.push(`${key}: ${valueLines[0]}`);
        for (const line of valueLines.slice(1)) {
            lines.push(`  ${line}`);
        }
    };

    appendField("type", entry.type);
    appendField("domain", entry.domain);
    appendField("decision_date", entry.decision_date);
    appendField("recorded_date", recordedDate);
    appendField("summary", entry.summary);
    appendField("rejected", entry.rejected);
    appendField("reason", entry.reason);
    appendField("revisit_when", entry.revisit_when ?? "");

    return lines.join("\n") + "\n";
}

/**
 * Write a proposed history entry to the staging area (.cairn/staged/).
 *
 * The staged entry must be reviewed and manually moved to .cairn/history/
 * by a human before it becomes part of the canonical record.
 */
export async function stageEntry(
    stagedDir: string,
    historyDir: string,
    entry: HistoryEntryInput,
): Promise<{ filepath: string; content: string }> {
    const filename = generateFilename(entry.decision_date, entry.summary);
    // Strip prefix to get canonical history filename for conflict detection
    const historyFilename = filename.replace(/^history-candidate_/, "");

    // Check for conflicts in history/ (using stripped filename)
    const historyPath = join(historyDir, historyFilename);
    if (existsSync(historyPath)) {
        throw new CairnError(
            CairnErrorCode.STAGING_CONFLICT,
            `A history entry with this filename already exists: .cairn/history/${historyFilename}\n` +
                `Use a different summary or decision_date to avoid the conflict.`,
        );
    }

    // Check for conflicts in staged/ (using full prefixed filename)
    const stagedPath = join(stagedDir, filename);
    if (existsSync(stagedPath)) {
        throw new CairnError(
            CairnErrorCode.STAGING_CONFLICT,
            `A staged entry with this filename already exists: .cairn/staged/${filename}\n` +
                `Review or discard the existing staged entry first:\n` +
                `  cat .cairn/staged/${filename}\n` +
                `  rm .cairn/staged/${filename}`,
        );
    }

    // Ensure staged/ directory exists
    mkdirSync(stagedDir, { recursive: true });

    // Generate recorded_date as current YYYY-MM
    const now = new Date();
    const recordedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const content = serializeHistoryEntry(entry, recordedDate);
    writeFileSync(stagedPath, content, "utf-8");

    return { filepath: stagedPath, content };
}
