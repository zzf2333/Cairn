import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const MARKER_START = "<!-- cairn:start -->";
const MARKER_END = "<!-- cairn:end -->";

const PROTOCOL_BLOCK = `${MARKER_START}
## Cairn 认知运行时（强制协议）

当项目根目录存在 \`.cairn/\` 目录时，以下规则**强制执行**。\`.cairn/\` 不存在则忽略本节。

### 生命周期

每次技术会话必须按顺序执行：

1. **开始** — 任何技术工作前运行 \`cairn context --task "<任务>" --json\`。未加载 context 禁止给出技术建议。返回 \`recovery_required\` 时先 \`cairn session-recover --json\` 再重新 context。
2. **架构决策前** — 运行 \`cairn plan --task "<任务>" --json\`，检查历史冲突。涉及框架选型、模块边界、基础设施变更时必须调用。
3. **认知捕获** — 用户拒绝方案、声明约束、接受技术债、做出架构选择时，运行 \`cairn signal --type <type> --what "<描述>" --json\`。口头确认但不 signal = 认知丢失。
4. **提交前** — git commit 前运行 \`cairn observe --summary "<摘要>" --json\`，捕获会话中未显式 signal 的隐式决策。
5. **结束** — 任务完成或话题切换时运行 \`cairn session-end --summary "<摘要>" --json\`。跳过此步将导致 git 扫描、衰减检查、DNA 压缩全部缺失。

### 约束

context 返回的约束在整个会话期间有效：

- \`no_go\` → 绝对禁止该方向
- \`accepted_debt\` → 不修复，在约束内工作
- \`challenges\` → suggestion 可继续；reflective_challenge 必须书面论证再决定；hard_constraint 禁止继续

### 何时跳过

修 typo、改格式、纯问答、非技术对话 → 跳过全部。判断标准：未来会话是否需要知道此次发生了什么。

**违反任何强制步骤 = 任务未完成。**
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
