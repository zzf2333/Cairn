export const VERSION = "0.4.12";

export const STATE_FILE_FORMAT_VERSION = "1";

export type CognitiveMode = "lightweight" | "standard" | "institutional";
export type GravityLevel = "G0" | "G1" | "G2" | "G3";
export type ProjectPhase = "exploration" | "growth" | "maturity" | "maintenance";

export const COGNITIVE_MODE_PARAMS = {
    lightweight: {
        governanceApprovalMinGravity: "G3" as GravityLevel,
        challengeTriggerThreshold: "hard_constraint_only",
        decayStaleDays: 30,
        decayUnusedDays: 60,
        dnaMinEvidence: 5,
        calibrationDepth: "no_go_only",
        auditDetail: "minimal",
    },
    standard: {
        governanceApprovalMinGravity: "G2" as GravityLevel,
        challengeTriggerThreshold: "suggestion_and_challenge",
        decayStaleDays: 90,
        decayUnusedDays: 120,
        dnaMinEvidence: 3,
        calibrationDepth: "no_go_and_skeleton",
        auditDetail: "medium",
    },
    institutional: {
        governanceApprovalMinGravity: "G1" as GravityLevel,
        challengeTriggerThreshold: "all",
        decayStaleDays: 180,
        decayUnusedDays: 240,
        dnaMinEvidence: 3,
        calibrationDepth: "full",
        auditDetail: "full",
    },
} as const;

export const GRAVITY_ORDER: Record<GravityLevel, number> = {
    G0: 0,
    G1: 1,
    G2: 2,
    G3: 3,
};

export function upgradeGravity(level: GravityLevel): GravityLevel {
    if (level === "G0") return "G1";
    if (level === "G1") return "G2";
    if (level === "G2") return "G3";
    return "G3";
}

export function downgradeGravity(level: GravityLevel): GravityLevel {
    if (level === "G3") return "G2";
    if (level === "G2") return "G1";
    if (level === "G1") return "G0";
    return "G0";
}

export function gravityAtLeast(level: GravityLevel, threshold: GravityLevel): boolean {
    return GRAVITY_ORDER[level] >= GRAVITY_ORDER[threshold];
}

export const DNA_MIN_TIMESPAN_MONTHS = 3;
export const DNA_MIN_CONFIDENCE = 0.6;

export const KNOWN_DNA_TRAITS = ["simplicity_bias", "infra_aggressiveness"] as const;
export type KnownDnaTrait = typeof KNOWN_DNA_TRAITS[number];

export const RESURRECTION_THRESHOLD = 5; // hits in 30 days
export const SESSION_STALE_AFTER_MINUTES = 120;

export const VIEWS_TOKEN_TARGETS = {
    output: { target: 500, hardLimit: 800 },
    domain: { target: 300, hardLimit: 500 },
} as const;
