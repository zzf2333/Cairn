import Anthropic from "@anthropic-ai/sdk";
import type { CliBridge } from "./cli-bridge.js";
import { parseCairnCommand } from "./parse-cairn-command.js";
import type { RunRecord, ToolCallRecord } from "./types.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_MODEL = process.env.CAIRN_SCENARIO_MODEL_CC ?? "claude-sonnet-4-5";
const MAX_TURNS = Number(process.env.CAIRN_SCENARIO_MAX_TURNS ?? 24);
const VERBOSE = process.env.CAIRN_SCENARIO_VERBOSE === "1";

const PLATFORM_LABEL = "claude-code";

function buildPlatformSystemPrompt(skillText: string): string {
    return [
        "You are Claude running inside the **Claude Code** CLI. The user is a software engineer working on a real project.",
        "You have a Bash tool. Use it to run cairn CLI commands according to the Cairn protocol below.",
        "Behave like Claude Code: be direct, terse, take action via tools when appropriate, communicate succinctly.",
        "",
        "When the Cairn protocol says 'call cairn_context before responding', that means: run `cairn context --task \"<task>\" --json` via the Bash tool BEFORE producing your textual answer.",
        "Always respect every constraint returned by cairn context for the remainder of this session.",
        "",
        "==== CAIRN PROTOCOL (from skills/cairn/SKILL.md) ====",
        skillText,
    ].join("\n");
}

const BASH_TOOL: Anthropic.Tool = {
    name: "Bash",
    description: "Execute a bash command. Use this to run cairn CLI commands (e.g. `cairn context --task \"...\" --json`).",
    input_schema: {
        type: "object",
        properties: {
            command: { type: "string", description: "The bash command to execute" },
        },
        required: ["command"],
    },
};

interface DriverArgs {
    bridge: CliBridge;
    scenarioId: string;
    userTurns: string[];
}

export async function runClaudeCode({ bridge, scenarioId, userTurns }: DriverArgs): Promise<RunRecord> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const client = new Anthropic({ apiKey });

    const skillPath = resolve(import.meta.dirname, "../../../../skills/cairn/SKILL.md");
    const skillText = await readFile(skillPath, "utf8");
    const systemPrompt = buildPlatformSystemPrompt(skillText);

    const tools = [BASH_TOOL];
    const startedAt = new Date();
    const toolCalls: ToolCallRecord[] = [];
    let order = 0;
    let assistantText = "";

    const messages: Anthropic.MessageParam[] = [];

    for (let turnIdx = 0; turnIdx < userTurns.length; turnIdx++) {
        messages.push({ role: "user", content: userTurns[turnIdx] });

        for (let step = 0; step < MAX_TURNS; step++) {
            const response = await client.messages.create({
                model: DEFAULT_MODEL,
                max_tokens: 4096,
                system: systemPrompt,
                tools,
                messages,
            });

            const assistantBlocks: Anthropic.ContentBlockParam[] = [];
            const toolUses: Anthropic.ToolUseBlock[] = [];
            for (const block of response.content) {
                assistantBlocks.push(block as Anthropic.ContentBlockParam);
                if (block.type === "text") {
                    assistantText += block.text + "\n";
                    if (VERBOSE) console.log(`  [CC][asst] ${block.text.slice(0, 200)}`);
                } else if (block.type === "tool_use") {
                    toolUses.push(block);
                }
            }
            messages.push({ role: "assistant", content: assistantBlocks });

            if (toolUses.length === 0) break;

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const tu of toolUses) {
                const input = (tu.input as Record<string, unknown>) ?? {};
                const command = typeof input.command === "string" ? input.command : "";
                if (VERBOSE) console.log(`  [CC][bash] ${command.slice(0, 200)}`);

                const parsed = parseCairnCommand(command);
                let resultText = "";
                let isError = false;

                if (parsed) {
                    order += 1;
                    try {
                        const r = await bridge.callTool(parsed.tool, parsed.args);
                        resultText = r.text;
                        isError = r.isError;
                    } catch (e) {
                        resultText = `tool error: ${(e as Error).message}`;
                        isError = true;
                    }
                    toolCalls.push({ name: parsed.tool, args: parsed.args, result_text: resultText, result_is_error: isError, order });
                } else {
                    resultText = "";
                }

                toolResults.push({
                    type: "tool_result",
                    tool_use_id: tu.id,
                    content: resultText,
                    is_error: isError,
                });
            }
            messages.push({ role: "user", content: toolResults });

            if (response.stop_reason !== "tool_use") break;
        }
    }

    const finishedAt = new Date();
    return {
        scenarioId,
        platform: PLATFORM_LABEL,
        model: DEFAULT_MODEL,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        tool_calls: toolCalls,
        assistant_text: assistantText,
        user_turns: userTurns,
        raw_messages: messages,
    };
}
