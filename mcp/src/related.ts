import { HooksIndex } from "./hooks.js";

/**
 * Resolve related domains for a primary domain using BFS 1-hop traversal.
 *
 * Reads the `related` field from the primary domain's frontmatter and returns
 * validated domain names (those that exist in the hooks index), up to maxRelated.
 * Produces warnings for any declared related domains that cannot be found.
 */
export function resolveRelated(
    primary: string,
    index: HooksIndex,
    maxRelated = 2,
): { related: string[]; warnings: string[] } {
    const visited = new Set([primary]);
    const related: string[] = [];
    const warnings: string[] = [];

    const declared = index.domainRelated.get(primary) ?? [];

    for (const name of declared) {
        if (related.length >= maxRelated) {
            break;
        }
        if (visited.has(name)) {
            continue;
        }
        visited.add(name);
        if (index.domainHooks.has(name)) {
            related.push(name);
        } else {
            warnings.push(
                `related domain "${name}" referenced by ${primary} not found — skipped`,
            );
        }
    }

    return { related, warnings };
}
