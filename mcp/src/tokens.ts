export function approxTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export function extractSection(body: string, heading: string): string {
    const headingPattern = new RegExp(
        `^##\\s+${heading}\\s*$`,
        "im",
    );
    const match = headingPattern.exec(body);
    if (!match) return "";

    const startIndex = match.index;
    const afterStart = body.slice(startIndex + match[0].length);
    const nextH2Pattern = /^##\s+/im;
    const nextMatch = nextH2Pattern.exec(afterStart);

    if (nextMatch) {
        return body.slice(startIndex, startIndex + match[0].length + nextMatch.index).trimEnd();
    }
    return body.slice(startIndex).trimEnd();
}
