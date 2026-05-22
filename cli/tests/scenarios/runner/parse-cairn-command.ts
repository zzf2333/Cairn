export interface ParsedCairnCall {
    tool: string;
    args: Record<string, string>;
}

const SUBCOMMAND_TO_TOOL: Record<string, string> = {
    "context": "cairn_context",
    "plan": "cairn_plan",
    "signal": "cairn_signal",
    "observe": "cairn_observe",
    "session-end": "cairn_session_end",
    "session-recover": "cairn_session_recover",
    "status": "cairn_status",
    "doctor": "cairn_doctor",
    "init": "cairn_init_status",
    "stage": "cairn_stage",
    "dna": "cairn_dna",
    "review": "cairn_review",
};

const SKIP_FLAGS = new Set(["--json", "--candidates-file"]);

function tokenize(input: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < input.length) {
        if (input[i] === " " || input[i] === "\t") { i++; continue; }

        if (input[i] === '"' || input[i] === "'") {
            const quote = input[i];
            let val = "";
            i++;
            while (i < input.length && input[i] !== quote) {
                if (input[i] === "\\" && i + 1 < input.length) {
                    val += input[i + 1];
                    i += 2;
                } else {
                    val += input[i];
                    i++;
                }
            }
            if (i < input.length) i++;
            tokens.push(val);
            continue;
        }

        let val = "";
        while (i < input.length && input[i] !== " " && input[i] !== "\t") {
            if (input[i] === "\\" && i + 1 < input.length) {
                val += input[i + 1];
                i += 2;
            } else {
                val += input[i];
                i++;
            }
        }
        tokens.push(val);
    }
    return tokens;
}

export function parseCairnCommand(bashCmd: string): ParsedCairnCall | null {
    const tokens = tokenize(bashCmd.replace(/\\\n/g, " "));

    let cairnIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === "cairn" || t.endsWith("/cairn") || t.endsWith("/cairn-rt")) {
            cairnIdx = i;
            break;
        }
        if (t.includes("=")) continue;
        if (t === "env" || t === "npx" || t === "node") continue;
        break;
    }
    if (cairnIdx < 0 || cairnIdx + 1 >= tokens.length) return null;

    const subcommand = tokens[cairnIdx + 1];
    const toolName = SUBCOMMAND_TO_TOOL[subcommand];
    if (!toolName) return null;

    const args: Record<string, string> = {};
    let i = cairnIdx + 2;
    while (i < tokens.length) {
        const t = tokens[i];
        if (!t.startsWith("--")) { i++; continue; }

        const flag = t;
        if (SKIP_FLAGS.has(flag)) { i++; continue; }

        if (i + 1 < tokens.length && !tokens[i + 1].startsWith("--")) {
            const key = flag.slice(2);
            args[key] = tokens[i + 1];
            i += 2;
        } else {
            i++;
        }
    }

    return { tool: toolName, args };
}
