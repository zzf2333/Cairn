export enum CairnErrorCode {
    NO_CAIRN_DIR = "NO_CAIRN_DIR",
    NOT_INITIALIZED = "NOT_INITIALIZED",
    NO_CONFIG = "NO_CONFIG",
    NO_STATE = "NO_STATE",
    SCHEMA_VALIDATION = "SCHEMA_VALIDATION",
    DOMAIN_NOT_FOUND = "DOMAIN_NOT_FOUND",
    EVENT_NOT_FOUND = "EVENT_NOT_FOUND",
    SKELETON_NOT_FOUND = "SKELETON_NOT_FOUND",
    SIGNAL_NOT_FOUND = "SIGNAL_NOT_FOUND",
    STAGED_NOT_FOUND = "STAGED_NOT_FOUND",
    GOVERNANCE_VIOLATION = "GOVERNANCE_VIOLATION",
    INVALID_INPUT = "INVALID_INPUT",
    FILE_IO = "FILE_IO",
    DUPLICATE_ID = "DUPLICATE_ID",
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

export function toolResult(text: string): { content: TextContent[] } {
    return { content: [{ type: "text", text }] };
}
