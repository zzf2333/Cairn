import { VERSION } from "./constants.js";
import { loadProtocolFiles, loadAdapter, loadMode, loadAssemblyOrder, getTargetFile } from "./skill-paths.js";

export interface AssemblyOptions {
    platform: string;
    mode: string;
}

export async function assembleProtocol(options: AssemblyOptions): Promise<string> {
    const { platform, mode } = options;

    const protocolFiles = await loadProtocolFiles();
    const adapter = await loadAdapter(platform);
    const modeAddendum = await loadMode(mode);

    const parts: string[] = [];

    parts.push(`<!-- cairn:start -->`);
    parts.push(`<!-- cairn:protocol v${VERSION} mode=${mode} -->`);
    parts.push("");
    parts.push("# Cairn Cognitive Runtime Protocol");
    parts.push("");

    for (const { content } of protocolFiles) {
        parts.push(content);
        parts.push("");
        parts.push("---");
        parts.push("");
    }

    if (modeAddendum) {
        parts.push(modeAddendum);
        parts.push("");
        parts.push("---");
        parts.push("");
    }

    parts.push(adapter);
    parts.push("");
    parts.push("<!-- cairn:end -->");

    return parts.join("\n");
}

const MARKER_START = "<!-- cairn:start -->";
const MARKER_END = "<!-- cairn:end -->";
const VERSION_RE = /<!-- cairn:protocol v([\d.]+)/;

export function parseInstalledVersion(content: string): string | null {
    const match = content.match(VERSION_RE);
    return match ? match[1] : null;
}

export function hasProtocolBlock(content: string): boolean {
    return content.includes(MARKER_START) && content.includes(MARKER_END);
}

export function replaceProtocolBlock(existing: string, newBlock: string): string {
    const startIdx = existing.indexOf(MARKER_START);
    const endIdx = existing.indexOf(MARKER_END);
    if (startIdx === -1 || endIdx === -1) return existing;

    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx + MARKER_END.length).trimStart();

    const parts: string[] = [];
    if (before) {
        parts.push(before);
        parts.push("");
    }
    parts.push(newBlock);
    if (after) {
        parts.push("");
        parts.push(after);
    }
    return parts.join("\n") + "\n";
}

export function appendProtocolBlock(existing: string, newBlock: string): string {
    const trimmed = existing.trimEnd();
    if (trimmed) {
        return trimmed + "\n\n" + newBlock + "\n";
    }
    return newBlock + "\n";
}

export async function getTargetFileName(platform: string): Promise<string> {
    const order = await loadAssemblyOrder();
    return getTargetFile(platform, order);
}
