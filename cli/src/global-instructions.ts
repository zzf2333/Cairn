import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const MARKER_START = "<!-- cairn:start -->";
const MARKER_END = "<!-- cairn:end -->";

const PROTOCOL_BLOCK = `${MARKER_START}
## Cairn Skill Bootstrap

If the project root contains \`.cairn/\`, Cairn is active.

Use the Cairn Skill for all technical work. The Skill owns lifecycle semantics, constraints, review queues, DNA, recovery, and session closure. The \`cairn\` CLI is only the runtime actuator invoked by the Skill.

Required behavior:

- Before technical work: activate/use the Cairn Skill and load context.
- Before architecture decisions: follow the Skill planning flow.
- When user decisions or constraints appear: capture them through the Skill.
- Before commits and at session end: follow the Skill observation/closure flow.

If the Cairn Skill is unavailable, fall back to \`cairn context --task "<task>" --json\` and read \`.cairn/views/*.md\`.

Bypassing the Cairn Skill when it is available means the task is incomplete.
${MARKER_END}`;

export function getGlobalInstructionBlock(): string {
    return PROTOCOL_BLOCK;
}

interface InjectTarget {
    name: string;
    dir: string;
    file: string;
}

function getTargets(): InjectTarget[] {
    const home = homedir();
    return [
        { name: "Claude Code", dir: join(home, ".claude"), file: join(home, ".claude", "CLAUDE.md") },
        { name: "Codex CLI", dir: join(home, ".codex"), file: join(home, ".codex", "AGENTS.md") },
    ];
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

export interface InjectResult {
    target: string;
    action: "injected" | "updated" | "skipped";
    path: string;
}

function stripLegacyBlocks(content: string): string {
    const legacyMarkers = [
        ["<!-- cairn:global-protocol:start -->", "<!-- cairn:global-protocol:end -->"],
    ];
    let result = content;
    for (const [start, end] of legacyMarkers) {
        const s = result.indexOf(start);
        const e = result.indexOf(end);
        if (s !== -1 && e !== -1) {
            const before = result.slice(0, s).replace(/\n+$/, "\n");
            const after = result.slice(e + end.length);
            result = before + after;
        }
    }
    return result;
}

export async function injectGlobalInstructions(): Promise<InjectResult[]> {
    const results: InjectResult[] = [];

    for (const target of getTargets()) {
        if (!(await exists(target.dir))) {
            results.push({ target: target.name, action: "skipped", path: target.file });
            continue;
        }

        let content = "";
        if (await exists(target.file)) {
            content = await readFile(target.file, "utf-8");
        }

        content = stripLegacyBlocks(content);

        const startIdx = content.indexOf(MARKER_START);
        const endIdx = content.indexOf(MARKER_END);

        if (startIdx !== -1 && endIdx !== -1) {
            const before = content.slice(0, startIdx);
            const after = content.slice(endIdx + MARKER_END.length);
            await writeFile(target.file, before + PROTOCOL_BLOCK + after, "utf-8");
            results.push({ target: target.name, action: "updated", path: target.file });
        } else {
            const separator = content.length > 0 && !content.endsWith("\n\n") ? "\n\n" : "";
            await writeFile(target.file, content + separator + PROTOCOL_BLOCK + "\n", "utf-8");
            results.push({ target: target.name, action: "injected", path: target.file });
        }
    }

    return results;
}

export async function removeGlobalInstructions(): Promise<InjectResult[]> {
    const results: InjectResult[] = [];

    for (const target of getTargets()) {
        if (!(await exists(target.file))) {
            results.push({ target: target.name, action: "skipped", path: target.file });
            continue;
        }

        const content = await readFile(target.file, "utf-8");
        const startIdx = content.indexOf(MARKER_START);
        const endIdx = content.indexOf(MARKER_END);

        if (startIdx === -1 || endIdx === -1) {
            results.push({ target: target.name, action: "skipped", path: target.file });
            continue;
        }

        let before = content.slice(0, startIdx);
        const after = content.slice(endIdx + MARKER_END.length);

        if (before.endsWith("\n\n")) {
            before = before.slice(0, -1);
        }

        const cleaned = (before + after).trim();
        await writeFile(target.file, cleaned.length > 0 ? cleaned + "\n" : "", "utf-8");
        results.push({ target: target.name, action: "updated", path: target.file });
    }

    return results;
}
