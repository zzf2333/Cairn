import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDomainFile } from "./parsers/domain.js";

export interface HooksIndex {
    /** Map from lowercase keyword → array of domain names that have this keyword */
    keywordToDomains: Map<string, string[]>;
    /** Map from domain name → its hooks array */
    domainHooks: Map<string, string[]>;
    /** Map from domain name → its related domains array */
    domainRelated: Map<string, string[]>;
}

/**
 * Build a keyword-to-domain index by scanning all domain files in domainsDir.
 * Reads the YAML frontmatter `hooks` field from each domain file.
 *
 * This enables precise machine-level keyword matching without AI inference —
 * the key architectural benefit of the Frontmatter hooks field.
 */
export function buildHooksIndex(domainsDir: string): HooksIndex {
    const keywordToDomains = new Map<string, string[]>();
    const domainHooks = new Map<string, string[]>();
    const domainRelated = new Map<string, string[]>();

    let entries: string[];
    try {
        entries = readdirSync(domainsDir).filter((f) => f.endsWith(".md"));
    } catch {
        // domains/ directory doesn't exist or can't be read
        return { keywordToDomains, domainHooks, domainRelated };
    }

    for (const filename of entries) {
        const filepath = join(domainsDir, filename);
        try {
            const content = readFileSync(filepath, "utf-8");
            const domainFile = parseDomainFile(content);
            const domainName = domainFile.frontmatter.domain;
            const hooks = domainFile.frontmatter.hooks;

            domainHooks.set(domainName, hooks);
            domainRelated.set(domainName, domainFile.frontmatter.related);

            for (const hook of hooks) {
                const key = hook.toLowerCase();
                const existing = keywordToDomains.get(key) ?? [];
                if (!existing.includes(domainName)) {
                    existing.push(domainName);
                }
                keywordToDomains.set(key, existing);
            }
        } catch {
            // Skip malformed domain files
        }
    }

    return { keywordToDomains, domainHooks, domainRelated };
}

/**
 * Match input keywords against the hooks index.
 * Returns a map of domain name → array of matched keywords for that domain.
 * Case-insensitive matching.
 */
export function matchKeywords(
    index: HooksIndex,
    keywords: string[],
): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const keyword of keywords) {
        const key = keyword.toLowerCase();
        const domains = index.keywordToDomains.get(key);
        if (domains) {
            for (const domain of domains) {
                const matched = result.get(domain) ?? [];
                if (!matched.includes(keyword)) {
                    matched.push(keyword);
                }
                result.set(domain, matched);
            }
        }
    }

    return result;
}
