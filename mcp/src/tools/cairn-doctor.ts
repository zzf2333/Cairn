import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { formatToolError } from "../errors.js";
import { findCairnRoot } from "../paths.js";
import { fileURLToPath } from "node:url";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

/**
 * cairn_doctor — Run health checks on .cairn/ and return structured JSON results.
 *
 * Shells out to `cairn doctor --json` so the AI can parse the results without
 * screen-scraping human-readable output. Useful for self-check at session start
 * or after writing history/domain files.
 *
 * Returns a JSON object with:
 *   issues: number          — count of issues found
 *   output.status: string   — "ok" | "missing" | "invalid"
 *   output.tokens: number   — approximate token count of output.md
 *   domains_stale: string[] — stale domain names
 *   skill_guide: string     — "ok" | "missing" | "old-format"
 *   skill_md: string        — "ok" | "missing" | "stale"
 *   v0011_residue: string[] — directories found: "staged" | "audits" | "reflections"
 */
export function handleCairnDoctor(): ToolResult {
    const root = findCairnRoot();
    if (!root) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        issues: ["No .cairn/ directory found — run cairn init"],
                        output_status: "missing",
                        domains_stale: [],
                        skill_guide: "missing",
                        skill_md: "missing",
                        v0011_residue: [],
                    }),
                },
            ],
        };
    }

    // Locate the cairn CLI relative to this file (mcp/src/tools/ or mcp/dist/tools/ → repo root)
    const thisFile = fileURLToPath(import.meta.url);
    const repoRoot = join(dirname(thisFile), "..", "..", "..");
    const cairnBin = join(repoRoot, "cli", "cairn");

    if (!existsSync(cairnBin)) {
        return formatToolError(
            new Error(
                `cairn CLI not found at ${cairnBin}. ` +
                    "Ensure the Cairn repo is intact and the CLI is at cli/cairn.",
            ),
        );
    }

    try {
        // doctor exits 1 when issues found — that's valid output, not an error.
        // Use spawnSync to capture stdout regardless of exit code.
        const result = spawnSync("bash", [cairnBin, "doctor", "--json"], {
            cwd: root,
            encoding: "utf-8",
            timeout: 15000,
        });

        if (result.error) {
            return formatToolError(result.error);
        }

        const output = result.stdout ?? "";
        // Validate it's valid JSON before returning
        JSON.parse(output);
        return { content: [{ type: "text", text: output.trim() }] };
    } catch (error) {
        return formatToolError(
            new Error(
                "cairn doctor --json failed: " +
                    (error instanceof Error ? error.message : String(error)),
            ),
        );
    }
}
