export interface HistoryEntry {
    type: string;
    domain: string;
    decision_date: string;
    recorded_date: string;
    summary: string;
    rejected: string;
    reason: string;
    revisit_when: string;
    raw: string;
    filename: string;
}

/**
 * Parse a history file in bare key:value format (no --- frontmatter delimiters).
 *
 * Format:
 *   type: experiment
 *   domain: api-layer
 *   decision_date: 2023-09
 *   recorded_date: 2025-01
 *   summary: Rejected tRPC after a 2-week trial
 *   rejected: tRPC — type-safe RPC layer...
 *     continuation line (2-space indent)
 *     another continuation line
 *   reason: Six or more clients...
 *     continuation...
 *   revisit_when: New greenfield service...
 *
 * Multi-line values use exactly 2-space indent for continuation lines.
 */
export function parseHistoryEntry(
    content: string,
    filename: string,
): HistoryEntry {
    const lines = content.split("\n");
    const fields: Record<string, string> = {};
    let currentField = "";
    let currentValue = "";

    const FIELD_RE = /^([a-z_]+): (.*)/;
    const CONTINUATION_RE = /^  (.*)$/;

    for (const line of lines) {
        const fieldMatch = line.match(FIELD_RE);
        if (fieldMatch) {
            // Save previous field
            if (currentField) {
                fields[currentField] = currentValue.trimEnd();
            }
            currentField = fieldMatch[1]!;
            currentValue = fieldMatch[2]!;
        } else if (currentField) {
            const contMatch = line.match(CONTINUATION_RE);
            if (contMatch) {
                // 2-space indented continuation line — strip the 2-space prefix
                currentValue += "\n" + contMatch[1];
            }
            // Lines with no indent and no field: skip (blank lines between fields)
        }
    }

    // Save last field
    if (currentField) {
        fields[currentField] = currentValue.trimEnd();
    }

    return {
        type: fields["type"] ?? "",
        domain: fields["domain"] ?? "",
        decision_date: fields["decision_date"] ?? "",
        recorded_date: fields["recorded_date"] ?? "",
        summary: fields["summary"] ?? "",
        rejected: fields["rejected"] ?? "",
        reason: fields["reason"] ?? "",
        revisit_when: fields["revisit_when"] ?? "",
        raw: content,
        filename,
    };
}

/** Sort history entries chronologically (oldest first) by decision_date. */
export function sortHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
    return [...entries].sort((a, b) =>
        a.decision_date.localeCompare(b.decision_date),
    );
}
