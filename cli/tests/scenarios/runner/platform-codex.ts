import OpenAI from "openai";
import type { McpBridge, McpTool } from "./mcp-bridge.js";
import type { RunRecord, ToolCallRecord } from "./types.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_MODEL = process.env.CAIRN_SCENARIO_MODEL_CODEX ?? "gpt-5";
const MAX_TURNS = Number(process.env.CAIRN_SCENARIO_MAX_TURNS ?? 24);
const VERBOSE = process.env.CAIRN_SCENARIO_VERBOSE === "1";

const PLATFORM_LABEL = "codex";

function buildPlatformSystemPrompt(skillText: string, mcpInstructions: string): string {
    return [
        "You are GPT running inside the **OpenAI Codex CLI**. The user is a software engineer working on a real project.",
        "Codex sessions follow the instructions in `AGENTS.md` at the project root; the relevant Cairn block from that file is included below.",
        "You have access to a set of Cairn MCP tools as OpenAI function tools. Use them according to the Cairn protocol below.",
        "Behave like Codex: be precise, action-oriented, use the tools when the protocol calls for it, communicate succinctly.",
        "",
        "When the Cairn protocol says 'call cairn_context before responding', that means: emit a function call for cairn_context BEFORE producing your textual answer. Do the same for cairn_session_end at the end of a session.",
        "Always respect every constraint returned by cairn_context for the remainder of this session.",
        "",
        "==== AGENTS.md — CAIRN BLOCK (from skills/codex.md) ====",
        skillText,
        ...(mcpInstructions
            ? ["", "==== MCP SERVER INSTRUCTIONS ====", mcpInstructions]
            : []),
    ].join("\n");
}

function toOpenAiTool(t: McpTool): OpenAI.Chat.Completions.ChatCompletionTool {
    return {
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: (t.inputSchema as Record<string, unknown>) ?? {
                type: "object",
                properties: {},
            },
        },
    };
}

interface DriverArgs {
    bridge: McpBridge;
    scenarioId: string;
    userTurns: string[];
}

export async function runCodex({ bridge, scenarioId, userTurns }: DriverArgs): Promise<RunRecord> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    const client = new OpenAI({ apiKey });

    const skillPath = resolve(import.meta.dirname, "../../../../skills/codex.md");
    const skillText = await readFile(skillPath, "utf8");
    const systemPrompt = buildPlatformSystemPrompt(skillText, bridge.instructions);

    const tools = bridge.tools.map(toOpenAiTool);
    const startedAt = new Date();
    const toolCalls: ToolCallRecord[] = [];
    let order = 0;
    let assistantText = "";

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
    ];

    for (let turnIdx = 0; turnIdx < userTurns.length; turnIdx++) {
        messages.push({ role: "user", content: userTurns[turnIdx] });

        for (let step = 0; step < MAX_TURNS; step++) {
            const response = await client.chat.completions.create({
                model: DEFAULT_MODEL,
                messages,
                tools,
                tool_choice: "auto",
            });

            const choice = response.choices[0];
            const msg = choice.message;
            messages.push(msg);

            if (msg.content) {
                assistantText += msg.content + "\n";
                if (VERBOSE) console.log(`  [Cdx][asst] ${msg.content.slice(0, 200)}`);
            }

            const calls = msg.tool_calls ?? [];
            if (calls.length === 0) break;

            for (const call of calls) {
                if (call.type !== "function") continue;
                order += 1;
                let parsed: Record<string, unknown> = {};
                try {
                    parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
                } catch {
                    parsed = {};
                }
                if (VERBOSE) console.log(`  [Cdx][tool] ${call.function.name} ${JSON.stringify(parsed).slice(0, 200)}`);
                let resultText = "";
                let isError = false;
                try {
                    const r = await bridge.callTool(call.function.name, parsed);
                    resultText = r.text;
                    isError = r.isError;
                } catch (e) {
                    resultText = `tool error: ${(e as Error).message}`;
                    isError = true;
                }
                toolCalls.push({
                    name: call.function.name,
                    args: parsed,
                    result_text: resultText,
                    result_is_error: isError,
                    order,
                });
                messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: resultText,
                });
            }

            if (choice.finish_reason && choice.finish_reason !== "tool_calls") break;
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
