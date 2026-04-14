/**
 * Token estimation utilities.
 *
 * Uses the chars/4 heuristic (consistent with the CLI's count_tokens_approx).
 * This is a rough estimate; do not use for billing calculations.
 */

/**
 * Estimate token count for a string using the chars/4 heuristic.
 */
export function approxTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Extract a specific H2 section from a markdown body.
 *
 * Finds the first `## <heading>` (case-insensitive) and returns the content
 * from that heading through the next `## ` heading or end of file.
 * Returns empty string if the section is not found.
 */
export function extractSection(body: string, heading: string): string {
    const headingPattern = new RegExp(
        `^##\\s+${heading}\\s*$`,
        "im",
    );
    const match = headingPattern.exec(body);
    if (!match) {
        return "";
    }

    const startIndex = match.index;
    // Find the next H2 heading after the matched one
    const nextH2Pattern = /^##\s+/im;
    const afterStart = body.slice(startIndex + match[0].length);
    const nextMatch = nextH2Pattern.exec(afterStart);

    if (nextMatch) {
        return body.slice(startIndex, startIndex + match[0].length + nextMatch.index).trimEnd();
    }
    return body.slice(startIndex).trimEnd();
}
