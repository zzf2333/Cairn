// Shared types for the scenario runner.

export type Platform = "claude-code" | "codex";

export interface ScenarioSpec {
    id: string;
    title: string;
    category: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
    fixtureDir: string;
    promptPath: string;
    expectedPath: string;
    fixturePath: string;
    rootDir: string;
}

export interface FixtureSpec {
    config?: {
        project_name?: string;
        domains?: string[];
        cognitive_mode?: "lightweight" | "standard" | "institutional";
        tech_stack?: Record<string, unknown>;
    };
    state?: {
        stage?: { phase: string; confidence: number; status?: string; last_updated?: string };
        last_session?: string;
        activation_log?: { recent_hits?: Record<string, number> };
    };
    skeleton?: Array<{
        domain: string;
        role: string;
        owns: string[];
        does_not_own?: string[];
        causal_keywords?: string[];
        dependencies?: string[];
    }>;
    blood?: Array<Record<string, unknown>>;
    staged?: Array<Record<string, unknown>>;
    domains?: Record<
        string,
        {
            constraints?: { no_go?: Array<Record<string, unknown>> };
            accepted_debt?: Array<Record<string, unknown>>;
            rejected_paths?: Array<Record<string, unknown>>;
        }
    >;
    dna?: {
        identity?: Record<string, unknown>;
        imprint?: Record<string, unknown>;
        staged?: Array<Record<string, unknown>>;
    };
    governance?: {
        policy?: Record<string, unknown>;
        audit?: Array<Record<string, unknown>>;
    };
    sessions?: Array<Record<string, unknown>>;
}

export interface ToolCallRecord {
    name: string;
    args: Record<string, unknown>;
    result_text: string;
    result_is_error: boolean;
    order: number;
}

export interface RunRecord {
    scenarioId: string;
    platform: Platform;
    model: string;
    started_at: string;
    finished_at: string;
    duration_ms: number;
    tool_calls: ToolCallRecord[];
    assistant_text: string;
    user_turns: string[];
    raw_messages: unknown[];
    error?: string;
}

export interface PlatformOverride {
    allow_fail?: boolean;
    allow_fail_reason?: string;
    skip?: boolean;
    skip_reason?: string;
    assertion_overrides?: Record<string, { allow_fail?: boolean; allow_fail_reason?: string }>;
}

export interface ExpectedSpec {
    description?: string;
    required_tool_calls?: ToolCallAssertion[];
    forbidden_tool_calls?: ToolCallAssertion[];
    required_text_patterns?: TextPatternAssertion[];
    forbidden_text_patterns?: TextPatternAssertion[];
    required_tool_result_patterns?: ToolResultPatternAssertion[];
    required_final_decision?: FinalDecisionAssertion;
    required_sequence?: SequenceAssertion[];
    min_total_tool_calls?: number;
    max_total_tool_calls?: number;
    platform_overrides?: Record<Platform, PlatformOverride>;
}

export interface ToolCallAssertion {
    tool: string;
    must_be_called?: boolean;
    order?: number;
    args_match?: Record<string, string>;
    description?: string;
}

export interface TextPatternAssertion {
    pattern: string;
    near_pattern?: string;
    description?: string;
}

export interface ToolResultPatternAssertion {
    tool: string;
    args_match?: Record<string, string>;
    result_pattern: string;
    description?: string;
}

export interface FinalDecisionAssertion {
    prefer?: string[];
    avoid?: string[];
    description?: string;
}

export interface SequenceAssertion {
    steps: Array<{ tool: string; args_match?: Record<string, string> }>;
    description?: string;
}

export interface AssertionResult {
    name: string;
    passed: boolean;
    detail: string;
    allowed_fail?: boolean;
    allowed_fail_reason?: string;
}

export interface ScenarioResult {
    scenarioId: string;
    platform: Platform;
    passed: boolean;
    assertions: AssertionResult[];
    run: RunRecord;
    allowed_fail?: boolean;
    allowed_fail_reason?: string;
    skipped?: boolean;
    skip_reason?: string;
}
