import { readFile } from "node:fs/promises";
import { parse as yamlParse } from "yaml";
import type {
    AssertionResult,
    ExpectedSpec,
    RunRecord,
    ToolCallAssertion,
    ToolCallRecord,
    TextPatternAssertion,
} from "./types.js";

export async function loadExpected(path: string): Promise<ExpectedSpec> {
    const raw = await readFile(path, "utf8");
    return yamlParse(raw) as ExpectedSpec;
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
            if (!new RegExp(pattern).test(actual)) return false;
        } catch {
            // invalid regex — treat as literal contains
            if (!actual.includes(pattern)) return false;
        }
    }
    return true;
}

function findMatchingCalls(calls: ToolCallRecord[], a: ToolCallAssertion): ToolCallRecord[] {
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
    const re = new RegExp(a.pattern, "i");
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
        if (!new RegExp(a.near_pattern, "i").test(window)) {
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
    if (new RegExp(a.pattern, "i").test(text)) {
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

    return out;
}

export function allPassed(results: AssertionResult[]): boolean {
    return results.every((r) => r.passed);
}
