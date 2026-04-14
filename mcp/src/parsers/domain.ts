import { extractFrontmatter } from "./frontmatter.js";
import { extractSection } from "../tokens.js";

export interface DomainFrontmatter {
    domain: string;
    hooks: string[];
    updated: string;
    status: string;
    related: string[];
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

    const rawRelated = fm["related"];
    const related = Array.isArray(rawRelated) ? rawRelated.map(String) : [];

    return {
        frontmatter: {
            domain: String(fm["domain"] ?? ""),
            hooks,
            updated: String(fm["updated"] ?? ""),
            status: String(fm["status"] ?? ""),
            related,
        },
        body: result.body,
        raw: content,
    };
}

/**
 * Extract the trajectory section from a domain file body.
 * Returns the raw `## trajectory` section content, or empty string if not found.
 */
export function extractTrajectory(body: string): string {
    return extractSection(body, "trajectory");
}
