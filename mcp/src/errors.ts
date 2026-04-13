export enum CairnErrorCode {
    NO_CAIRN_DIR = "NO_CAIRN_DIR",
    NO_OUTPUT_MD = "NO_OUTPUT_MD",
    DOMAIN_NOT_FOUND = "DOMAIN_NOT_FOUND",
    INVALID_DOMAIN_NAME = "INVALID_DOMAIN_NAME",
    NO_HISTORY_ENTRIES = "NO_HISTORY_ENTRIES",
    STAGING_CONFLICT = "STAGING_CONFLICT",
    INVALID_INPUT = "INVALID_INPUT",
}

export class CairnError extends Error {
    constructor(
        public readonly code: CairnErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "CairnError";
    }
}

type TextContent = { type: "text"; text: string };

export function formatToolError(error: unknown): {
    content: TextContent[];
    isError: true;
} {
    const message = error instanceof Error ? error.message : String(error);
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}

export const NO_CAIRN_DIR_MSG =
    "No .cairn/ directory found in this directory or any parent.\n\n" +
    "This project has not been initialized with Cairn. To set up:\n" +
    "  1. Run `cairn init` for interactive setup, or\n" +
    "  2. Create .cairn/ manually (see spec/FORMAT.md)";
