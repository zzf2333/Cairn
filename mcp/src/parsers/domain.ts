import { extractFrontmatter } from "./frontmatter.js";

export interface DomainFrontmatter {
    domain: string;
    hooks: string[];
    updated: string;
    status: string;
}

export interface DomainFile {
    frontmatter: DomainFrontmatter;
    body: string;
    raw: string;
}

/**
 * Parse a domain file containing YAML frontmatter + markdown body.
 *
 * Format:
 *   ---
 *   domain: api-layer
 *   hooks: ["api", "endpoint", "tRPC", "GraphQL"]
 *   updated: 2024-03
 *   status: stable
 *   ---
 *
 *   # api-layer
 *   ...
 */
export function parseDomainFile(content: string): DomainFile {
    const result = extractFrontmatter(content);
    if (!result) {
        throw new Error(
            "Domain file is missing YAML frontmatter. Domain files must start with ---.",
        );
    }

    const fm = result.frontmatter;
    const rawHooks = fm["hooks"];
    const hooks = Array.isArray(rawHooks) ? rawHooks.map(String) : [];

    return {
        frontmatter: {
            domain: String(fm["domain"] ?? ""),
            hooks,
            updated: String(fm["updated"] ?? ""),
            status: String(fm["status"] ?? ""),
        },
        body: result.body,
        raw: content,
    };
}
