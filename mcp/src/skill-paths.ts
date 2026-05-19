import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { readFile, readdir, access } from "node:fs/promises";

interface AssemblyOrder {
    protocol: string[];
    platforms: Record<string, { adapter: string; target: string }>;
}

export function getSkillsDir(): string {
    const thisFile = fileURLToPath(import.meta.url);
    return resolve(dirname(thisFile), "..", "skills");
}

export async function loadAssemblyOrder(): Promise<AssemblyOrder> {
    const path = join(getSkillsDir(), "_assembly-order.json");
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as AssemblyOrder;
}

export async function loadProtocolFiles(): Promise<{ name: string; content: string }[]> {
    const order = await loadAssemblyOrder();
    const dir = getSkillsDir();
    const results: { name: string; content: string }[] = [];
    for (const relPath of order.protocol) {
        const content = await readFile(join(dir, relPath), "utf8");
        results.push({ name: relPath, content: content.trim() });
    }
    return results;
}

export async function loadAdapter(platform: string): Promise<string> {
    const order = await loadAssemblyOrder();
    const entry = order.platforms[platform];
    if (!entry) {
        const available = Object.keys(order.platforms).join(", ");
        throw new Error(`Unknown platform "${platform}". Available: ${available}`);
    }
    const content = await readFile(join(getSkillsDir(), entry.adapter), "utf8");
    return content.trim();
}

export async function loadMode(mode: string): Promise<string | null> {
    if (mode === "balanced") return null;
    const path = join(getSkillsDir(), "modes", `${mode}.md`);
    try {
        await access(path);
    } catch {
        throw new Error(`Unknown mode "${mode}". Available: strict, balanced, lightweight`);
    }
    const content = await readFile(path, "utf8");
    return content.trim();
}

export function getTargetFile(platform: string, order: AssemblyOrder): string {
    const entry = order.platforms[platform];
    if (!entry) throw new Error(`Unknown platform "${platform}"`);
    return entry.target;
}

export async function loadMcpInstructions(): Promise<string> {
    const path = join(getSkillsDir(), "protocol", "mcp-instructions.md");
    try {
        return (await readFile(path, "utf8")).trim();
    } catch {
        return FALLBACK_INSTRUCTIONS;
    }
}

export async function listPlatforms(): Promise<string[]> {
    const order = await loadAssemblyOrder();
    return Object.keys(order.platforms);
}

const FALLBACK_INSTRUCTIONS = [
    "Cairn is a project memory engine.",
    "You MUST call cairn_context() BEFORE any technical response.",
    "You MUST call cairn_session_end() when the task completes.",
    "You MUST call cairn_signal() when the user rejects, constrains, or decides.",
    "You MUST call cairn_observe() before every git commit.",
    "You MUST call cairn_plan() before architecture changes.",
].join("\n");
