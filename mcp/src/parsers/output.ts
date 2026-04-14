export interface OutputSections {
    stage: string;
    nogo: string;
    hooks: string;
    stack: string;
    debt: string;
    raw: string;
}

/**
 * Parse output.md into its five required sections.
 *
 * Sections are delimited by ## headings:
 *   ## stage
 *   ## no-go
 *   ## hooks
 *   ## stack
 *   ## debt
 */
export function parseOutput(content: string): OutputSections {
    const sections: Record<string, string> = {};
    const lines = content.split("\n");
    let currentSection = "";
    let currentLines: string[] = [];

    const SECTION_RE = /^## ([a-z-]+)/;

    for (const line of lines) {
        const match = line.match(SECTION_RE);
        if (match) {
            if (currentSection) {
                sections[currentSection] = currentLines.join("\n").trim();
            }
            currentSection = match[1]!;
            currentLines = [];
        } else if (currentSection) {
            currentLines.push(line);
        }
    }

    // Save last section
    if (currentSection) {
        sections[currentSection] = currentLines.join("\n").trim();
    }

    return {
        stage: sections["stage"] ?? "",
        nogo: sections["no-go"] ?? "",
        hooks: sections["hooks"] ?? "",
        stack: sections["stack"] ?? "",
        debt: sections["debt"] ?? "",
        raw: content,
    };
}

/**
 * Extract locked domain names from output.md's hooks section.
 * Matches both formats (language-agnostic — only the path matters):
 *   - New format: → domains/<name>.md
 *   - Old format: → read domains/<name>.md first (backward-compatible)
 *
 * Mirrors cli/cairn's parse_domain_list() function.
 */
export function extractLockedDomains(content: string): string[] {
    const DOMAIN_RE = /→\s+(?:read\s+)?domains\/([a-z][a-z0-9-]+)\.md/g;
    const matches = [...content.matchAll(DOMAIN_RE)];
    return matches.map((m) => m[1]!);
}
