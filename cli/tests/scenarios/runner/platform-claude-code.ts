import Anthropic from "@anthropic-ai/sdk";
import type { McpBridge, McpTool } from "./mcp-bridge.js";
import type { RunRecord, ToolCallRecord } from "./types.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_MODEL = process.env.CAIRN_SCENARIO_MODEL_CC ?? "claude-sonnet-4-5";
const MAX_TURNS = Number(process.env.CAIRN_SCENARIO_MAX_TURNS ?? 24);
const VERBOSE = process.env.CAIRN_SCENARIO_VERBOSE === "1";

const PLATFORM_LABEL = "claude-code";

function buildPlatformSystemPrompt(skillText: string, mcpInstructions: string): string {
    return [
        "You are Claude running inside the **Claude Code** CLI. The user is a software engineer working on a real project.",
        "You have access to a set of Cairn tools. Use them according to the Cairn protocol below.",
        "Behave like Claude Code: be direct, terse, take action via tools when appropriate, communicate succinctly.",
        "",
        "When the Cairn protocol says 'call cairn_context before responding', that means: emit a tool_use for cairn_context BEFORE producing your textual answer. Do the same for cairn_session_end at the end of a session.",
        "Always respect every constraint returned by cairn_context for the remainder of this session.",
        "",
        "==== CAIRN PROTOCOL (from skills/cairn/SKILL.md) ====",
        skillText,
        ...(mcpInstructions
            ? ["", "==== MCP SERVER INSTRUCTIONS ====", mcpInstructions]
            : []),
    ].join("\n");
}

function toAnthropicTool(t: McpTool): Anthropic.Tool {
    return {
        name: t.name,
        description: t.description,
        input_schema: (t.inputSchema as Anthropic.Tool.InputSchema) ?? {
            type: "object",
            properties: {},
        },
    };
}

interface DriverArgs {
    bridge: McpBridge;
    scenarioId: string;
    userTurns: string[];
}

export async function runClaudeCode({ bridge, scenarioId, userTurns }: DriverArgs): Promise<RunRecord> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const client = new Anthropic({ apiKey });

    const skillPath = resolve(import.meta.dirname, "../../../../skills/cairn/SKILL.md");
    const skillText = await readFile(skillPath, "utf8");
    const systemPrompt = buildPlatformSystemPrompt(skillText, bridge.instructions);

    const tools = bridge.tools.map(toAnthropicTool);
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
                order += 1;
                const args = (tu.input as Record<string, unknown>) ?? {};
                if (VERBOSE) console.log(`  [CC][tool] ${tu.name} ${JSON.stringify(args).slice(0, 200)}`);
                let resultText = "";
                let isError = false;
                try {
                    const r = await bridge.callTool(tu.name, args);
                    resultText = r.text;
                    isError = r.isError;
                } catch (e) {
                    resultText = `tool error: ${(e as Error).message}`;
                    isError = true;
                }
                toolCalls.push({ name: tu.name, args, result_text: resultText, result_is_error: isError, order });
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
