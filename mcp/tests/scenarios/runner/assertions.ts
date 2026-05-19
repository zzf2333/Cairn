import { readFile } from "node:fs/promises";
import { parse as yamlParse } from "yaml";
import type {
    AssertionResult,
    ExpectedSpec,
    FinalDecisionAssertion,
    Platform,
    PlatformOverride,
    RunRecord,
    SequenceAssertion,
    ToolCallAssertion,
    ToolCallRecord,
    ToolMatchSpec,
    ToolResultPatternAssertion,
    TextPatternAssertion,
} from "./types.js";

export async function loadExpected(path: string): Promise<ExpectedSpec> {
    const raw = await readFile(path, "utf8");
    return yamlParse(raw) as ExpectedSpec;
}

/**
 * Strip the `(?i)` inline-flag prefix used in our expected.yaml files —
 * JavaScript regex doesn't support inline flags. We always use the `i`
 * flag in `new RegExp(_, "i")` so the behavior is preserved.
 */
function sanitizePattern(pattern: string): string {
    return pattern.replace(/^\(\?i\)/, "").replace(/\(\?i\)/g, "");
}

function makeRegex(pattern: string, flags = "i"): RegExp {
    return new RegExp(sanitizePattern(pattern), flags);
}

function getNested(obj: Record<string, unknown>, dottedPath: string): string | undefined {
    const parts = dottedPath.split(".");
    let cur: unknown = obj;
    for (const p of parts) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[p];
    }
    if (cur == null) return undefined;
    if (typeof cur === "string") return cur;
    return JSON.stringify(cur);
}

function argsMatch(call: ToolCallRecord, matchSpec: Record<string, string> | undefined): boolean {
    if (!matchSpec) return true;
    for (const [path, pattern] of Object.entries(matchSpec)) {
        const actual = getNested(call.args, path);
        if (actual === undefined) return false;
        try {
            if (!makeRegex(pattern).test(actual)) return false;
        } catch {
            // invalid regex — treat as literal contains
            if (!actual.includes(pattern)) return false;
        }
    }
    return true;
}

function findMatchingCalls(calls: ToolCallRecord[], a: ToolMatchSpec): ToolCallRecord[] {
    return calls.filter((c) => c.name === a.tool && argsMatch(c, a.args_match));
}

function checkRequiredCall(calls: ToolCallRecord[], a: ToolCallAssertion): AssertionResult {
    const matches = findMatchingCalls(calls, a);
    if (matches.length === 0) {
        return {
            name: `required tool_call: ${a.tool}${a.description ? ` (${a.description})` : ""}`,
            passed: false,
            detail: `no matching call found (args_match=${JSON.stringify(a.args_match ?? {})})`,
        };
    }
    if (a.order !== undefined) {
        const earliest = matches.reduce((m, c) => (c.order < m.order ? c : m), matches[0]);
        if (earliest.order !== a.order) {
            return {
                name: `required tool_call order: ${a.tool}`,
                passed: false,
                detail: `expected order=${a.order}, actual earliest order=${earliest.order}`,
            };
        }
    }
    return {
        name: `required tool_call: ${a.tool}`,
        passed: true,
        detail: `${matches.length} matching call(s) at order [${matches.map((m) => m.order).join(", ")}]`,
    };
}

function checkForbiddenCall(calls: ToolCallRecord[], a: ToolCallAssertion): AssertionResult {
    const matches = findMatchingCalls(calls, a);
    if (matches.length > 0) {
        return {
            name: `forbidden tool_call: ${a.tool}${a.description ? ` (${a.description})` : ""}`,
            passed: false,
            detail: `unexpected ${matches.length} matching call(s), args=${JSON.stringify(matches[0].args).slice(0, 200)}`,
        };
    }
    return {
        name: `forbidden tool_call: ${a.tool}`,
        passed: true,
        detail: "no matching call (as expected)",
    };
}

function checkRequiredText(text: string, a: TextPatternAssertion): AssertionResult {
    const re = makeRegex(a.pattern);
    const m = text.match(re);
    if (!m) {
        return {
            name: `required text: ${a.pattern}`,
            passed: false,
            detail: a.description ? `(${a.description})` : "pattern not found in assistant text",
        };
    }
    if (a.near_pattern) {
        const idx = m.index ?? 0;
        const window = text.slice(Math.max(0, idx - 400), Math.min(text.length, idx + 400));
        if (!makeRegex(a.near_pattern).test(window)) {
            return {
                name: `required text: ${a.pattern}`,
                passed: false,
                detail: `pattern found but near_pattern '${a.near_pattern}' missing within ±400 chars`,
            };
        }
    }
    return {
        name: `required text: ${a.pattern}`,
        passed: true,
        detail: "matched",
    };
}

function checkForbiddenText(text: string, a: TextPatternAssertion): AssertionResult {
    if (makeRegex(a.pattern).test(text)) {
        return {
            name: `forbidden text: ${a.pattern}`,
            passed: false,
            detail: a.description ? `(${a.description})` : "pattern matched (should not appear)",
        };
    }
    return {
        name: `forbidden text: ${a.pattern}`,
        passed: true,
        detail: "absent",
    };
}

export function getPlatformOverride(expected: ExpectedSpec, platform: Platform): PlatformOverride | undefined {
    return expected.platform_overrides?.[platform];
}

function checkToolResultPattern(calls: ToolCallRecord[], a: ToolResultPatternAssertion): AssertionResult {
    const matches = findMatchingCalls(calls, { tool: a.tool, args_match: a.args_match });
    if (matches.length === 0) {
        return {
            name: `tool_result_pattern: ${a.tool}${a.description ? ` (${a.description})` : ""}`,
            passed: false,
            detail: "no matching tool call found",
        };
    }
    const re = makeRegex(a.result_pattern);
    const hit = matches.some((c) => re.test(c.result_text));
    return {
        name: `tool_result_pattern: ${a.tool}${a.description ? ` (${a.description})` : ""}`,
        passed: hit,
        detail: hit
            ? "matched"
            : `pattern '${a.result_pattern}' not found in result_text of ${matches.length} call(s)`,
    };
}

function checkFinalDecision(text: string, a: FinalDecisionAssertion): AssertionResult[] {
    const results: AssertionResult[] = [];
    for (const pattern of a.prefer ?? []) {
        const matched = makeRegex(pattern).test(text);
        results.push({
            name: `final_decision prefer: ${pattern}`,
            passed: matched,
            detail: matched ? "matched" : "pattern not found",
        });
    }
    for (const pattern of a.avoid ?? []) {
        const matched = makeRegex(pattern).test(text);
        results.push({
            name: `final_decision avoid: ${pattern}`,
            passed: !matched,
            detail: matched ? "pattern matched (should not appear)" : "absent",
        });
    }
    return results;
}

function checkSequence(calls: ToolCallRecord[], a: SequenceAssertion): AssertionResult {
    let minOrder = -1;
    for (let i = 0; i < a.steps.length; i++) {
        const step = a.steps[i];
        const candidates = findMatchingCalls(calls, { tool: step.tool, args_match: step.args_match }).filter(
            (c) => c.order > minOrder,
        );
        if (candidates.length === 0) {
            return {
                name: `sequence${a.description ? ` (${a.description})` : ""}`,
                passed: false,
                detail: `step ${i + 1} (${step.tool}) not found after order ${minOrder}`,
            };
        }
        minOrder = Math.min(...candidates.map((c) => c.order));
    }
    return {
        name: `sequence${a.description ? ` (${a.description})` : ""}`,
        passed: true,
        detail: "all steps matched in order",
    };
}

export function evaluate(run: RunRecord, expected: ExpectedSpec): AssertionResult[] {
    const out: AssertionResult[] = [];

    if (expected.min_total_tool_calls !== undefined) {
        out.push({
            name: `min total tool_calls >= ${expected.min_total_tool_calls}`,
            passed: run.tool_calls.length >= expected.min_total_tool_calls,
            detail: `actual=${run.tool_calls.length}`,
        });
    }
    if (expected.max_total_tool_calls !== undefined) {
        out.push({
            name: `max total tool_calls <= ${expected.max_total_tool_calls}`,
            passed: run.tool_calls.length <= expected.max_total_tool_calls,
            detail: `actual=${run.tool_calls.length}`,
        });
    }
    for (const a of expected.required_tool_calls ?? []) {
        out.push(checkRequiredCall(run.tool_calls, a));
    }
    for (const a of expected.forbidden_tool_calls ?? []) {
        out.push(checkForbiddenCall(run.tool_calls, a));
    }
    for (const a of expected.required_text_patterns ?? []) {
        out.push(checkRequiredText(run.assistant_text, a));
    }
    for (const a of expected.forbidden_text_patterns ?? []) {
        out.push(checkForbiddenText(run.assistant_text, a));
    }
    for (const a of expected.required_tool_result_patterns ?? []) {
        out.push(checkToolResultPattern(run.tool_calls, a));
    }
    if (expected.required_final_decision) {
        out.push(...checkFinalDecision(run.assistant_text, expected.required_final_decision));
    }
    for (const a of expected.required_sequence ?? []) {
        out.push(checkSequence(run.tool_calls, a));
    }

    return out;
}

export function allPassed(results: AssertionResult[]): boolean {
    return results.every((r) => r.passed || r.allowed_fail);
}
