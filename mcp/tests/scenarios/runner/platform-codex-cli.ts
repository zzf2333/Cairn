import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RunRecord, ToolCallRecord } from "./types.js";

// Empty default: respect the user's ~/.codex/config.toml `model` setting.
// Override via `CAIRN_SCENARIO_MODEL_CODEX=…` to pin a specific model.
const DEFAULT_MODEL = process.env.CAIRN_SCENARIO_MODEL_CODEX ?? "";
const MAX_TURNS = Number(process.env.CAIRN_SCENARIO_MAX_TURNS ?? 24);
const VERBOSE = process.env.CAIRN_SCENARIO_VERBOSE === "1";
const CODEX_BIN = process.env.CAIRN_SCENARIO_CODEX_BIN ?? "codex";

const PLATFORM_LABEL = "codex";
const CAIRN_SERVER = "cairn";

interface DriverArgs {
    scenarioId: string;
    userTurns: string[];
    /** Absolute path to the fixture project root. */
    projectRoot: string;
    /** Absolute path to `mcp/dist/index.js`. */
    mcpServerPath: string;
}

/**
 * Run a scenario through the real Codex CLI in non-interactive `exec` mode.
 * Injects the Cairn MCP server via inline `-c mcp_servers.cairn.*=…` overrides
 * so we don't disturb the user's global config.
 */
export async function runCodexCli({
    scenarioId,
    userTurns,
    projectRoot,
    mcpServerPath,
}: DriverArgs): Promise<RunRecord> {
    const startedAt = new Date();

    // Inject the Cairn SKILL block as the appended instructions so the model sees the protocol.
    const skillPath = resolve(import.meta.dirname, "../../../../skills/codex.md");
    const skillText = await readFile(skillPath, "utf8");

    const toolCalls: ToolCallRecord[] = [];
    let order = 0;
    let assistantText = "";
    const rawMessages: unknown[] = [];
    let actualModel = "";
    let threadId: string | undefined;
    let driverError: string | undefined;

    try {
        for (let turnIdx = 0; turnIdx < userTurns.length; turnIdx++) {
            const turn = userTurns[turnIdx];

            const args: string[] = [];
            const isResume = turnIdx > 0 && threadId;
            if (isResume) {
                args.push("exec", "resume", threadId as string);
            } else {
                args.push("exec");
            }
            args.push("--json");
            args.push("--skip-git-repo-check");
            args.push("--ephemeral");
            args.push("-C", projectRoot);
            args.push("-s", "read-only");
            args.push("--dangerously-bypass-approvals-and-sandbox");
            if (DEFAULT_MODEL) {
                args.push("-m", DEFAULT_MODEL);
            }
            // Inject Cairn MCP server (inline TOML override, doesn't touch ~/.codex/config.toml)
            args.push("-c", `mcp_servers.cairn.command="${process.execPath}"`);
            args.push("-c", `mcp_servers.cairn.args=["${mcpServerPath.replace(/\\/g, "\\\\")}"]`);
            args.push("-c", `mcp_servers.cairn.env={ CAIRN_ROOT = "${projectRoot.replace(/\\/g, "\\\\")}" }`);
            // Inject the Cairn protocol as additional instructions only on the first turn.
            if (!isResume) {
                const escaped = JSON.stringify(skillText);
                args.push("-c", `instructions=${escaped}`);
            }

            args.push(turn);

            if (VERBOSE) {
                console.log(`  [Cdx-CLI] turn ${turnIdx + 1}/${userTurns.length}${isResume ? ` (resume thread ${threadId})` : ""} starting`);
            }

            const { stdout, stderr, code } = await runCodex(args, projectRoot);
            if (code !== 0 && code !== null) {
                if (VERBOSE) {
                    console.log(`  [Cdx-CLI] exit code ${code}, stderr (last 500): ${stderr.slice(-500)}`);
                }
            }

            for (const line of stdout.split(/\r?\n/)) {
                if (!line.trim() || !line.startsWith("{")) continue;
                let ev: { [k: string]: unknown };
                try {
                    ev = JSON.parse(line);
                } catch {
                    continue;
                }
                rawMessages.push(ev);

                if (ev.type === "thread.started" && typeof ev.thread_id === "string") {
                    threadId = ev.thread_id;
                    continue;
                }

                if (ev.type === "item.completed" && typeof ev.item === "object" && ev.item) {
                    const item = ev.item as {
                        type?: string;
                        text?: string;
                        server?: string;
                        tool?: string;
                        arguments?: Record<string, unknown> | string;
                        result?: { content?: unknown[]; error?: unknown } | null;
                        error?: unknown;
                    };

                    if (item.type === "agent_message" && typeof item.text === "string") {
                        assistantText += item.text + "\n";
                        if (VERBOSE) console.log(`  [Cdx-CLI][asst] ${item.text.slice(0, 200)}`);
                        continue;
                    }

                    if (item.type === "mcp_tool_call" && item.server === CAIRN_SERVER && item.tool) {
                        order += 1;
                        let argsObj: Record<string, unknown> = {};
                        if (typeof item.arguments === "string") {
                            try {
                                argsObj = JSON.parse(item.arguments);
                            } catch {
                                argsObj = {};
                            }
                        } else if (item.arguments && typeof item.arguments === "object") {
                            argsObj = item.arguments;
                        }

                        let resultText = "";
                        let isError = false;
                        if (item.error) {
                            resultText = typeof item.error === "string" ? item.error : JSON.stringify(item.error);
                            isError = true;
                        } else if (item.result && Array.isArray(item.result.content)) {
                            for (const part of item.result.content) {
                                if (typeof part === "object" && part && (part as { type?: string }).type === "text") {
                                    resultText += (part as { text?: string }).text ?? "";
                                }
                            }
                        }

                        toolCalls.push({
                            name: item.tool,
                            args: argsObj,
                            result_text: resultText,
                            result_is_error: isError,
                            order,
                        });
                        if (VERBOSE) console.log(`  [Cdx-CLI][tool] ${item.tool} ${JSON.stringify(argsObj).slice(0, 200)}`);
                    }
                }
            }

            if (driverError) break;
            if (turnIdx + 1 >= MAX_TURNS) break;
        }
    } catch (e) {
        driverError = (e as Error).message;
    }

    if (!actualModel) actualModel = DEFAULT_MODEL || "(codex-default)";

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

function runCodex(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolveP, rejectP) => {
        const child = spawn(CODEX_BIN, args, {
            cwd,
            env: process.env,
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
