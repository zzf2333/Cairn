import { readdirSync, readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NO_CAIRN_DIR_MSG, formatToolError } from "../errors.js";
import { resolvePaths } from "../paths.js";
import {
    parseHistoryEntry,
    sortHistoryEntries,
    type HistoryEntry,
} from "../parsers/history.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

/**
 * cairn_sync_domain — Generate context to regenerate a domain file from history.
 *
 * Returns a structured context block containing:
 * 1. Current domain file content (or "not yet created" if missing)
 * 2. All history entries for this domain in full (chronological)
 * 3. The domain file format template with writing rules
 *
 * This tool does NOT call an LLM or write any files. It returns the materials
 * for the calling AI to process and generate an updated domain file.
 * The AI should present the generated content to a human for confirmation
 * before writing it to .cairn/domains/<name>.md.
 *
 * This mirrors the CLI's `cairn sync` command — same information, returned
 * as a tool result instead of printed to stdout.
 */
export function handleCairnSyncDomain(args: { name: string }): ToolResult {
    const { name } = args;

    try {
        const paths = resolvePaths();
        const domainFile = join(paths.domainsDir, `${name}.md`);

        // Collect history entries for this domain
        const entries = loadDomainHistoryEntries(paths.historyDir, name);

        if (entries.length === 0) {
            return formatToolError(
                new Error(
                    `No history entries found for domain '${name}'.\n` +
                        "Record some decisions first with `cairn log` or `cairn_propose`, then sync.",
                ),
            );
        }

        const sorted = sortHistoryEntries(entries);
        const latestDate = sorted[sorted.length - 1]!.decision_date;

        // Current domain file content
        const currentFileSection = buildCurrentFileSection(domainFile, name);

        // History entries block
        const historyBlock = sorted
            .map((e) => `### ${e.filename}\n${e.raw.trim()}`)
            .join("\n\n");

        const prompt = buildSyncPrompt(
            name,
            currentFileSection,
            historyBlock,
            sorted.length,
            latestDate,
        );

        return { content: [{ type: "text", text: prompt }] };
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

function loadDomainHistoryEntries(
    historyDir: string,
    domain: string,
): HistoryEntry[] {
    let files: string[];
    try {
        files = readdirSync(historyDir)
            .filter((f) => f.endsWith(".md") && f !== "_TEMPLATE.md")
            .sort();
    } catch {
        return [];
    }

    return files
        .map((filename) => {
            const content = readFileSync(join(historyDir, filename), "utf-8");
            return parseHistoryEntry(content, filename);
        })
        .filter((e) => e.domain === domain);
}

function buildCurrentFileSection(
    domainFile: string,
    domainName: string,
): string {
    if (existsSync(domainFile)) {
        const content = readFileSync(domainFile, "utf-8");
        return (
            `## Current domain file (.cairn/domains/${domainName}.md)\n\n` +
            content
        );
    }
    return (
        "## Current domain file\n\n" +
        "This domain file does not exist yet. Create it from scratch."
    );
}

function buildSyncPrompt(
    domain: string,
    currentFileSection: string,
    historyBlock: string,
    entryCount: number,
    latestDate: string,
): string {
    return `You are updating a Cairn domain file based on accumulated history entries.
Cairn is an AI path-dependency constraint system. Domain files provide
pre-compressed design context that is injected when the AI works on related tasks.

${currentFileSection}

## History entries for domain: ${domain} (${entryCount} entr${entryCount === 1 ? "y" : "ies"}, chronological)

${historyBlock}

## Your task

Generate an updated domain file for \`${domain}\` using EXACTLY this structure:

\`\`\`markdown
---
domain: ${domain}
hooks: ["keyword1", "keyword2", "..."]
updated: ${latestDate}
status: active
---

# ${domain}

## current design

[1–3 sentences: current design state, primary choice in use, any unresolved boundary]

## trajectory

[Chronological. One line per event. Format: YYYY-MM <description> → <reason if changed>]

## rejected paths

- <option>: <rejection reason, one sentence>
  Re-evaluate when: <condition for reconsideration>

## known pitfalls

- <name>: <trigger> / <why it happens> / <what NOT to do>

## open questions

- <unresolved design question>
\`\`\`

## Rules

1. OVERWRITE the entire file — do not append to the existing content
2. Keep the total file length within 200–400 tokens
3. Every line MUST change AI behavior — if removing a line wouldn't change AI suggestions, delete it
4. The \`rejected\` fields in history entries are the most critical content — include ALL rejected alternatives in "rejected paths"
5. "known pitfalls" are operational traps, NOT accepted debts or direction exclusions
6. Set \`updated:\` in frontmatter to the latest history entry's \`decision_date\`: ${latestDate}
7. Choose \`status: active\` if the domain is still evolving, \`status: stable\` if settled

When done, save the output to: .cairn/domains/${domain}.md
Then run: cairn status`;
}
