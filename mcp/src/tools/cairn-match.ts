import { NO_CAIRN_DIR_MSG, formatToolError } from "../errors.js";
import { resolvePaths } from "../paths.js";
import { buildHooksIndex, matchKeywords } from "../hooks.js";
import { resolveRelated } from "../related.js";
import { approxTokens } from "../tokens.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

type Confidence = "high" | "medium" | "low";

/**
 * Compute a path-match score for a domain against a list of file paths.
 *
 * Scoring:
 *   +2 per file if any path segment equals the domain name (exact or contains)
 *   +1 per file per unique hook keyword found in any segment or basename
 *
 * @param domainName  e.g. "api-layer"
 * @param hooks       the domain's hook keywords array
 * @param files       list of file paths (absolute or repo-relative)
 * @param repoRoot    repo root used to normalise absolute paths
 */
function computePathScore(
    domainName: string,
    hooks: string[],
    files: string[],
    repoRoot: string,
): number {
    let score = 0;
    const domainNorm = domainName.toLowerCase();
    // Also match simple prefix (e.g. "api-layer" matches "api")
    const domainParts = domainNorm.split("-");

    for (const rawFile of files) {
        let filePath = rawFile;
        if (isAbsolute(filePath)) {
            if (filePath.startsWith(repoRoot)) {
                filePath = filePath.slice(repoRoot.length);
            } else {
                // Outside repo root: use basename only
                filePath = filePath.split("/").pop() ?? filePath;
            }
        }
        const segments = filePath.toLowerCase().split(/[\\/]+/).filter(Boolean);
        const basename = segments[segments.length - 1] ?? "";

        let fileScore = 0;

        // +2 if any segment matches the domain name exactly or contains it
        for (const seg of segments) {
            if (seg === domainNorm || seg.includes(domainNorm) || seg.includes(domainParts[0] ?? "")) {
                fileScore = Math.max(fileScore, 2);
                break;
            }
        }

        // +1 per unique hook keyword found in segments or basename
        const hitsInFile = new Set<string>();
        for (const hook of hooks) {
            const hookNorm = hook.toLowerCase();
            for (const seg of [...segments, basename]) {
                if (seg.includes(hookNorm) && !hitsInFile.has(hookNorm)) {
                    hitsInFile.add(hookNorm);
                    fileScore += 1;
                    break;
                }
            }
        }

        score += fileScore;
    }

    return score;
}

/**
 * Determine confidence level for a matched domain.
 *
 * - high:   keyword hit AND file-path score ≥ 2
 * - medium: keyword hit only, OR file-path score ≥ 2 without keyword hit (if files provided)
 * - low:    keyword hit but files were provided and path score is 0
 *           (hooks matched but files look unrelated → treat as optional injection)
 */
function computeConfidence(
    keywordHit: boolean,
    pathScore: number,
    filesProvided: boolean,
): Confidence {
    if (keywordHit && pathScore >= 2) return "high";
    if (keywordHit && (!filesProvided || pathScore > 0)) return "medium";
    if (!keywordHit && pathScore >= 2) return "medium";
    // keyword hit but files provided and path score is 0 → low
    return "low";
}

/**
 * cairn_match — Match keywords and file paths against domain hooks.
 *
 * Enhanced in v0.0.4:
 *   - Optional `files` parameter for file-path-based matching
 *   - Confidence scoring: high / medium / low
 *   - Related domain suggestions from domain `related:` frontmatter field
 *   - Combined injection budget advisory (≤ 1200 tokens)
 *
 * Workflow:
 *   1. Extract keywords from the user's request
 *   2. Optionally provide files currently being edited
 *   3. Call cairn_match(keywords, files) to find relevant domains with confidence
 *   4. Call cairn_domain(name) for high/medium confidence domains
 *   5. Optionally load trajectory sections of related domains if token budget allows
 */
export function handleCairnMatch(args: {
    keywords: string[];
    files?: string[];
}): ToolResult {
    const { keywords, files } = args;

    if (!keywords || keywords.length === 0) {
        return formatToolError(new Error("At least one keyword is required."));
    }

    try {
        const paths = resolvePaths();
        const index = buildHooksIndex(paths.domainsDir);
        const keywordMatches = matchKeywords(index, keywords);

        // Also check file-path matches against all domains (for files-only match)
        const filesProvided = Array.isArray(files) && files.length > 0;
        const allDomains = new Set([
            ...keywordMatches.keys(),
            ...(filesProvided ? [...index.domainHooks.keys()] : []),
        ]);

        // Determine the repo root for path normalisation
        const repoRoot = paths.root;

        interface DomainResult {
            domain: string;
            confidence: Confidence;
            matchedKeywords: string[];
            pathScore: number;
            related: string[];
            warnings: string[];
        }

        const results: DomainResult[] = [];

        for (const domainName of allDomains) {
            const matchedKws = keywordMatches.get(domainName) ?? [];
            const keywordHit = matchedKws.length > 0;
            const domainHooks = index.domainHooks.get(domainName) ?? [];

            const pathScore = filesProvided
                ? computePathScore(domainName, domainHooks, files!, repoRoot)
                : 0;

            const confidence = computeConfidence(keywordHit, pathScore, filesProvided);

            // Skip domains that only appeared in domainHooks but had no keyword or path hit
            if (!keywordHit && pathScore === 0) continue;

            const { related, warnings } = resolveRelated(domainName, index);

            results.push({
                domain: domainName,
                confidence,
                matchedKeywords: matchedKws,
                pathScore,
                related,
                warnings,
            });
        }

        if (results.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `No domains matched the given keywords: ${keywords.join(", ")}.\n` +
                            "This topic may not have Cairn domain coverage, or domain files have not been created yet.",
                    },
                ],
            };
        }

        // Sort: high > medium > low, then alphabetical
        const confidenceOrder: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
        results.sort((a, b) => {
            const diff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
            return diff !== 0 ? diff : a.domain.localeCompare(b.domain);
        });

        // Build output text
        const lines: string[] = ["Matched domains:", ""];
        const highMedium = results.filter((r) => r.confidence !== "low");
        const lowResults = results.filter((r) => r.confidence === "low");

        const allWarnings: string[] = [];

        for (const r of results) {
            const matchInfo: string[] = [];
            if (r.matchedKeywords.length > 0) {
                matchInfo.push(`matched: ${r.matchedKeywords.join(", ")}`);
            }
            if (filesProvided && r.pathScore > 0) {
                const hitFiles = files!
                    .filter((f) => {
                        const norm = f.toLowerCase();
                        return (
                            norm.includes(r.domain.toLowerCase()) ||
                            r.matchedKeywords.some((k) => norm.includes(k.toLowerCase()))
                        );
                    })
                    .map((f) => f.split(/[\\/]/).pop())
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(", ");
                if (hitFiles) matchInfo.push(`files: ${hitFiles}`);
            }

            const infoStr = matchInfo.length > 0 ? ` (confidence: ${r.confidence}, ${matchInfo.join("; ")})` : ` (confidence: ${r.confidence})`;
            lines.push(`- ${r.domain}${infoStr}`);

            if (r.related.length > 0) {
                lines.push(`  Related: ${r.related.join(", ")}`);
            }

            allWarnings.push(...r.warnings);
        }

        lines.push("");

        // Recommendations
        const callLines: string[] = [];
        const optionalLines: string[] = [];

        for (const r of highMedium) {
            callLines.push(`cairn_domain("${r.domain}")`);
        }
        for (const r of lowResults) {
            optionalLines.push(`cairn_domain("${r.domain}")`);
        }

        if (callLines.length > 0) {
            lines.push(`Recommendation: call ${callLines.join(" and ")} to load context.`);
        }

        // Related domain advisory
        const relatedForAdvisory = new Set<string>();
        for (const r of highMedium) {
            for (const rel of r.related) {
                if (!highMedium.some((x) => x.domain === rel)) {
                    relatedForAdvisory.add(rel);
                }
            }
        }
        if (relatedForAdvisory.size > 0) {
            const relList = [...relatedForAdvisory].slice(0, 2);
            // Estimate token budget
            let budgetNote = "";
            try {
                const outputText = existsSync(paths.outputMd)
                    ? readFileSync(paths.outputMd, "utf-8")
                    : "";
                const outputTokens = approxTokens(outputText);

                // Estimate primary domain tokens
                const primaryDomain = highMedium[0]?.domain ?? "";
                const primaryFile = join(paths.domainsDir, `${primaryDomain}.md`);
                const primaryText = existsSync(primaryFile)
                    ? readFileSync(primaryFile, "utf-8")
                    : "";
                const primaryTokens = approxTokens(primaryText);

                const usedTokens = outputTokens + primaryTokens;
                const remaining = 1200 - usedTokens;
                if (remaining > 0) {
                    budgetNote = ` (≈${remaining} tokens remaining of 1200 budget)`;
                }
            } catch {
                // Non-fatal: skip budget note
            }
            lines.push(
                `Optionally load only the \`## trajectory\` section of ${relList.map((r) => `${r}.md`).join(" and ")} if token budget allows${budgetNote}.`,
            );
        }

        if (optionalLines.length > 0) {
            lines.push(`Optional (low confidence): ${optionalLines.join(", ")}`);
        }

        // Warnings from missing related domains
        if (allWarnings.length > 0) {
            lines.push("");
            for (const w of allWarnings) {
                lines.push(`Note: ${w}`);
            }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("No .cairn/ directory found")
        ) {
            return formatToolError(new Error(NO_CAIRN_DIR_MSG));
        }
        return formatToolError(error);
    }
}
