import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const MARKER_START = "<!-- cairn:start -->";
const MARKER_END = "<!-- cairn:end -->";

const PROTOCOL_BLOCK = `${MARKER_START}
## Cairn Cognitive Runtime (Mandatory Protocol)

When the project root contains a \`.cairn/\` directory, the rules below are **mandatory**. If \`.cairn/\` does not exist, ignore this section entirely.

### Lifecycle

Every technical session MUST follow these steps in order:

1. **Start** — Before any technical work, run \`cairn context --task "<task>" --json\`. No context loaded = no technical advice allowed. If the response contains \`recovery_required\`, run \`cairn session-recover --json\` first, then re-run context.
2. **Before architecture decisions** — Run \`cairn plan --task "<task>" --json\` to check for conflicts with historical decisions. Required for framework selection, module boundary changes, and infrastructure work.
3. **Capture cognition** — When the user rejects a proposal, declares a constraint, accepts technical debt, or makes an architectural choice, run \`cairn signal --type <type> --what "<description>" --json\`. Acknowledging verbally without signaling = cognition lost.
4. **Before commit** — Run \`cairn observe --summary "<summary>" --json\` before git commit to capture implicit decisions not explicitly signaled during the session.
5. **End** — When the task completes or the topic changes, run \`cairn session-end --summary "<summary>" --json\`. Skipping this causes git scanning, decay checks, and DNA compression to be missed entirely.

### Constraints

Constraints returned by context remain in effect for the entire session:

- \`no_go\` → never suggest this direction
- \`accepted_debt\` → do not fix; work within the constraint
- \`challenges\` → \`suggestion\`: may proceed; \`reflective_challenge\`: must justify in writing before proceeding; \`hard_constraint\`: do not proceed

### When to skip

Typo fixes, formatting, pure Q&A, non-technical conversation → skip the entire lifecycle. The test: would a future AI session benefit from knowing what happened here?

**Violating any mandatory step = task incomplete.**
${MARKER_END}`;

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
