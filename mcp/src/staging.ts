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
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40)
        .replace(/-+$/, "");
}

/**
 * Serialize a history entry to bare key:value format (no --- delimiters).
 * Multi-line values use 2-space indent continuation lines.
 * Matches spec/FORMAT.md Layer 3 requirements.
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
