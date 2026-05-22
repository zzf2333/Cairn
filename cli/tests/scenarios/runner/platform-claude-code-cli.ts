import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCairnCommand } from "./parse-cairn-command.js";
import type { RunRecord, ToolCallRecord } from "./types.js";

const DEFAULT_MODEL = process.env.CAIRN_SCENARIO_MODEL_CC ?? "sonnet";
const MAX_TURNS = Number(process.env.CAIRN_SCENARIO_MAX_TURNS ?? 24);
const VERBOSE = process.env.CAIRN_SCENARIO_VERBOSE === "1";
const CLAUDE_BIN = process.env.CAIRN_SCENARIO_CLAUDE_BIN ?? "claude";

const PLATFORM_LABEL = "claude-code";

interface DriverArgs {
    scenarioId: string;
    userTurns: string[];
    projectRoot: string;
}

export async function runClaudeCodeCli({
    scenarioId,
    userTurns,
    projectRoot,
}: DriverArgs): Promise<RunRecord> {
    const startedAt = new Date();

    const skillPath = resolve(import.meta.dirname, "../../../../skills/cairn/SKILL.md");
    const skillText = await readFile(skillPath, "utf8");

    const toolCalls: ToolCallRecord[] = [];
    let order = 0;
    let assistantText = "";
    const rawMessages: unknown[] = [];
    let actualModel = "";
    let driverError: string | undefined;

    try {
        for (let turnIdx = 0; turnIdx < userTurns.length; turnIdx++) {
            const turn = userTurns[turnIdx];

            const args = [
                "-p", turn,
                "--output-format", "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--allowed-tools", "Bash(*)",
                "--permission-mode", "bypassPermissions",
                "--append-system-prompt", skillText,
                "--model", DEFAULT_MODEL,
                "--no-session-persistence",
                "--exclude-dynamic-system-prompt-sections",
                "--disable-slash-commands",
            ];
            if (turnIdx > 0) {
                args.push("--continue");
            }

            if (VERBOSE) {
                console.log(`  [CC-CLI] turn ${turnIdx + 1}/${userTurns.length} starting`);
            }

            const { stdout, stderr, code } = await runClaude(args, projectRoot);
            if (code !== 0 && code !== null) {
                if (VERBOSE) {
                    console.log(`  [CC-CLI] exit code ${code}, stderr: ${stderr.slice(0, 500)}`);
                }
            }

            for (const line of stdout.split(/\r?\n/)) {
                if (!line.trim()) continue;
                let ev: { [k: string]: unknown };
                try {
                    ev = JSON.parse(line);
                } catch {
                    continue;
                }
                rawMessages.push(ev);

                if (ev.type === "system" && ev.subtype === "init") {
                    actualModel = String(ev.model ?? "");
                    continue;
                }

                if (ev.type === "assistant" && typeof ev.message === "object" && ev.message) {
                    const msg = ev.message as { content?: unknown[] };
                    if (Array.isArray(msg.content)) {
                        for (const block of msg.content) {
                            if (typeof block !== "object" || block == null) continue;
                            const b = block as { type?: string; text?: string; name?: string; input?: unknown; id?: string };
                            if (b.type === "text" && typeof b.text === "string") {
                                assistantText += b.text + "\n";
                                if (VERBOSE) console.log(`  [CC-CLI][asst] ${b.text.slice(0, 200)}`);
                            } else if (b.type === "tool_use" && b.name === "Bash") {
                                if (toolCalls.some((c) => (c as ToolCallRecord & { _id?: string })._id === b.id)) continue;
                                const input = (b.input as Record<string, unknown>) ?? {};
                                const command = typeof input.command === "string" ? input.command : "";
                                const parsed = parseCairnCommand(command);
                                if (parsed) {
                                    order += 1;
                                    const record: ToolCallRecord & { _id?: string } = {
                                        name: parsed.tool,
                                        args: parsed.args,
                                        result_text: "",
                                        result_is_error: false,
                                        order,
                                    };
                                    record._id = b.id;
                                    toolCalls.push(record);
                                    if (VERBOSE) console.log(`  [CC-CLI][cairn] ${parsed.tool} ${JSON.stringify(parsed.args).slice(0, 200)}`);
                                }
                            }
                        }
                    }
                    continue;
                }

                if (ev.type === "user" && typeof ev.message === "object" && ev.message) {
                    const msg = ev.message as { content?: unknown[] };
                    if (Array.isArray(msg.content)) {
                        for (const block of msg.content) {
                            if (typeof block !== "object" || block == null) continue;
                            const b = block as { type?: string; tool_use_id?: string; content?: unknown; is_error?: boolean };
                            if (b.type !== "tool_result") continue;
                            const matched = toolCalls.find((c) => (c as ToolCallRecord & { _id?: string })._id === b.tool_use_id);
                            if (!matched) continue;
                            let text = "";
                            if (typeof b.content === "string") {
                                text = b.content;
                            } else if (Array.isArray(b.content)) {
                                for (const part of b.content) {
                                    if (typeof part === "object" && part && (part as { type?: string }).type === "text") {
                                        text += (part as { text?: string }).text ?? "";
                                    }
                                }
                            }
                            matched.result_text = text;
                            matched.result_is_error = b.is_error ?? false;
                        }
                    }
                }
            }

            if (driverError) break;
            if (turnIdx + 1 >= MAX_TURNS) break;
        }
    } catch (e) {
        driverError = (e as Error).message;
    }

    if (!actualModel) actualModel = DEFAULT_MODEL;

    const finishedAt = new Date();
    return {
        scenarioId,
        platform: PLATFORM_LABEL,
        model: actualModel,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        tool_calls: toolCalls,
        assistant_text: assistantText,
        user_turns: userTurns,
        raw_messages: rawMessages,
        ...(driverError ? { error: driverError } : {}),
    };
}

function runClaude(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolveP, rejectP) => {
        const child = spawn(CLAUDE_BIN, args, {
            cwd,
            env: { ...process.env, CAIRN_ROOT: cwd },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d) => (stdout += d.toString()));
        child.stderr?.on("data", (d) => (stderr += d.toString()));
        child.on("error", rejectP);
        child.on("close", (code) => resolveP({ stdout, stderr, code }));
    });
}
