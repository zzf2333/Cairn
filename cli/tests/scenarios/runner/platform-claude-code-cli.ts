import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { RunRecord, ToolCallRecord } from "./types.js";

const DEFAULT_MODEL = process.env.CAIRN_SCENARIO_MODEL_CC ?? "sonnet";
const MAX_TURNS = Number(process.env.CAIRN_SCENARIO_MAX_TURNS ?? 24);
const VERBOSE = process.env.CAIRN_SCENARIO_VERBOSE === "1";
const CLAUDE_BIN = process.env.CAIRN_SCENARIO_CLAUDE_BIN ?? "claude";

const PLATFORM_LABEL = "claude-code";

const MCP_PREFIX = "mcp__cairn__";

function stripMcpPrefix(name: string): string {
    return name.startsWith(MCP_PREFIX) ? name.slice(MCP_PREFIX.length) : name;
}

interface DriverArgs {
    scenarioId: string;
    userTurns: string[];
    /** Absolute path to the fixture project root (we set Claude's cwd here so it won't pick up the cairn repo's CLAUDE.md). */
    projectRoot: string;
    /** Absolute path to `mcp/dist/index.js`. */
    mcpServerPath: string;
}

/**
 * Run a scenario end-to-end through the real Claude Code CLI in print mode.
 * Spawns one `claude -p ...` per user turn; multi-turn scenarios chain via
 * `--continue` (resume the prior session in the same cwd).
 */
export async function runClaudeCodeCli({
    scenarioId,
    userTurns,
    projectRoot,
    mcpServerPath,
}: DriverArgs): Promise<RunRecord> {
    const startedAt = new Date();

    // Build a per-run MCP config that pins the server to the fixture root.
    const mcpConfigDir = await mkdtemp(join(tmpdir(), "cairn-cc-mcp-"));
    const mcpConfigPath = join(mcpConfigDir, "mcp.json");
    await writeFile(
        mcpConfigPath,
        JSON.stringify(
            {
                mcpServers: {
                    cairn: {
                        command: process.execPath,
                        args: [mcpServerPath],
                        env: { CAIRN_ROOT: projectRoot },
                    },
                },
            },
            null,
            2,
        ),
        "utf8",
    );

    // Inject the Cairn SKILL as the appended system prompt so the model sees the protocol.
    const skillPath = resolve(import.meta.dirname, "../../../../skills/cairn/SKILL.md");
    const skillText = await readFile(skillPath, "utf8");

    // All 16 cairn tools, behind the mcp__cairn__ prefix Claude Code uses.
    const cairnToolNames = [
        "cairn_init_status", "cairn_init_commit", "cairn_context", "cairn_signal",
        "cairn_observe", "cairn_session_end", "cairn_session_recover",
        "cairn_status", "cairn_plan",
        "cairn_stage_list", "cairn_stage_accept", "cairn_stage_reject",
        "cairn_doctor", "cairn_dna_list", "cairn_dna_accept", "cairn_dna_reject",
    ];
    const allowedTools = cairnToolNames.map((n) => `${MCP_PREFIX}${n}`).join(",");

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
                "--mcp-config", mcpConfigPath,
                "--strict-mcp-config",
                "--output-format", "stream-json",
                "--verbose",
                "--include-partial-messages",
                "--tools", "",
                "--allowed-tools", allowedTools,
                "--permission-mode", "bypassPermissions",
                "--append-system-prompt", skillText,
                "--model", DEFAULT_MODEL,
                "--no-session-persistence",
                "--exclude-dynamic-system-prompt-sections",
                "--disable-slash-commands",
            ];
            if (turnIdx > 0) {
                // Continue the prior turn's session so the model sees full history.
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

            // Parse JSON Lines, harvest tool calls and assistant text.
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

                // Assistant messages: tool_use and text blocks. We use the
                // FULL assistant message (not stream_event deltas) because
                // it has the complete, parsed content array.
                if (ev.type === "assistant" && typeof ev.message === "object" && ev.message) {
                    const msg = ev.message as { content?: unknown[] };
                    if (Array.isArray(msg.content)) {
                        for (const block of msg.content) {
                            if (typeof block !== "object" || block == null) continue;
                            const b = block as { type?: string; text?: string; name?: string; input?: unknown; id?: string };
                            if (b.type === "text" && typeof b.text === "string") {
                                assistantText += b.text + "\n";
                                if (VERBOSE) console.log(`  [CC-CLI][asst] ${b.text.slice(0, 200)}`);
                            } else if (b.type === "tool_use" && b.name) {
                                // de-dup: assistant messages may be emitted both
                                // mid-stream and at end-of-message; we keyed by tool_use id.
                                if (toolCalls.some((c) => (c as ToolCallRecord & { _id?: string })._id === b.id)) continue;
                                order += 1;
                                const argsObj = (b.input as Record<string, unknown>) ?? {};
                                const record: ToolCallRecord & { _id?: string } = {
                                    name: stripMcpPrefix(b.name),
                                    args: argsObj,
                                    result_text: "",
                                    result_is_error: false,
                                    order,
                                };
                                record._id = b.id;
                                toolCalls.push(record);
                                if (VERBOSE) console.log(`  [CC-CLI][tool] ${record.name} ${JSON.stringify(argsObj).slice(0, 200)}`);
                            }
                        }
                    }
                    continue;
                }

                // Tool results arrive as type=user with content[].type=tool_result.
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
                            matched.result_is_error = Boolean(b.is_error);
                        }
                    }
                    continue;
                }

                if (ev.type === "result") {
                    // Final result block — end-of-turn summary, also includes the final assistant text.
                    if (typeof ev.is_error === "boolean" && ev.is_error) {
                        const text = typeof ev.result === "string" ? ev.result : JSON.stringify(ev.result);
                        if (text.toLowerCase().includes("not logged in") || text.toLowerCase().includes("authentication")) {
                            driverError = `Claude CLI auth failed: ${text}`;
                        }
                    }
                }
            }

            if (driverError) break;
            if (turnIdx + 1 >= MAX_TURNS) break;
        }
    } catch (e) {
        driverError = (e as Error).message;
    } finally {
        await rm(mcpConfigDir, { recursive: true, force: true });
    }

    // Drop the internal _id we attached for matching.
    for (const c of toolCalls as Array<ToolCallRecord & { _id?: string }>) {
        delete c._id;
    }

    const finishedAt = new Date();
    return {
        scenarioId,
        platform: PLATFORM_LABEL,
        model: actualModel || DEFAULT_MODEL,
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
