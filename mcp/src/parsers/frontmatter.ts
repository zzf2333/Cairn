import { parse as parseYAML } from "yaml";

export interface FrontmatterResult {
    frontmatter: Record<string, unknown>;
    body: string;
}

/**
 * Extract YAML frontmatter from a file containing --- delimiters.
 *
 * Domain files start with:
 *   ---
 *   domain: api-layer
 *   hooks: ["api", "endpoint"]
 *   updated: 2024-03
 *   status: stable
 *   ---
 *
 * History files do NOT have frontmatter — returns null for those.
 */
export function extractFrontmatter(content: string): FrontmatterResult | null {
    // Must start with --- (optional leading whitespace before first ---)
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return null;

    const yamlStr = match[1]!;
    const body = match[2]!;

    try {
        const frontmatter = parseYAML(yamlStr) as Record<string, unknown>;
        if (frontmatter === null || typeof frontmatter !== "object") return null;
        return { frontmatter, body };
    } catch {
        return null;
    }
}
