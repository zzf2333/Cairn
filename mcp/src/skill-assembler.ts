import { loadProtocolFiles, loadAdapter, loadMode } from "./skill-paths.js";

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

    return parts.join("\n");
}
