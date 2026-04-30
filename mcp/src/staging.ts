export interface HistoryEntryInput {
    type: string;
    domain: string;
    scope?: string;
    status?: string;
    behavior_effect?: string;
    confidence?: string;
    decision_date: string;
    summary: string;
    rejected: string;
    chosen?: string;
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

export function defaultBehaviorEffect(type: string): string {
    switch (type) {
        case "rejection":
            return "never_suggest";
        case "debt":
            return "preserve";
        case "transition":
        case "decision":
            return "prefer";
        case "experiment":
            return "avoid";
        default:
            return "revisit";
    }
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
    appendField("scope", entry.scope ?? "domain");
    appendField("status", entry.status ?? "active");
    appendField(
        "behavior_effect",
        entry.behavior_effect ?? defaultBehaviorEffect(entry.type),
    );
    appendField("confidence", entry.confidence ?? "high");
    appendField("decision_date", entry.decision_date);
    appendField("recorded_date", recordedDate);
    appendField("summary", entry.summary);
    appendField("rejected", entry.rejected);
    if (entry.chosen !== undefined) {
        appendField("chosen", entry.chosen);
    }
    appendField("reason", entry.reason);
    appendField("revisit_when", entry.revisit_when ?? "");

    return lines.join("\n") + "\n";
}
