import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import {
    CairnErrorCode,
    NO_CAIRN_DIR_MSG,
    formatToolError,
} from "../errors.js";
import { resolvePaths } from "../paths.js";

type TextContent = { type: "text"; text: string };
type ToolResult = { content: TextContent[]; isError?: true };

/**
 * cairn_output — Read the Cairn Layer 1 global constraints.
 *
 * Returns the full contents of .cairn/output.md, which contains:
 * - stage: current project phase and reasoning mode
 * - no-go: technology directions to never suggest
 * - hooks: keywords that trigger domain file injection
 * - stack: active technology choices
 * - debt: accepted technical debts to not fix
 *
 * This file should be read at the start of every AI session.
 */
export function handleCairnOutput(): ToolResult {
    try {
        const paths = resolvePaths();

        if (!existsSync(paths.outputMd)) {
            return formatToolError(
                new Error(
                    "No .cairn/output.md found. The .cairn/ directory exists but output.md is missing.\n" +
                        "Run `cairn init` to populate it.",
                ),
            );
        }

        const content = readFileSync(paths.outputMd, "utf-8");

        if (!content.trim()) {
            return {
                content: [
                    {
                        type: "text",
                        text:
                            content +
                            "\n\nWarning: output.md is empty. Run `cairn init` to populate it.",
                    },
                ],
            };
        }

        return { content: [{ type: "text", text: content }] };
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
