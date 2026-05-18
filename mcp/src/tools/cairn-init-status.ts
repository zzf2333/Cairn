import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { VERSION, KNOWN_DNA_TRAITS } from "../constants.js";
import { checkVersionMismatch } from "../utils/version.js";
import { EVENT_TYPES } from "../schemas/evolution-event.js";
import { BEHAVIOR_EFFECT_TYPES, VALIDITY_LEVELS, SOURCE_TYPES, GRAVITY_LEVELS } from "../schemas/shared.js";
import { COGNITIVE_MODES } from "../schemas/config.js";
import { PROJECT_PHASES, INIT_STEPS, type InitStep } from "../schemas/state.js";

function buildStepGuide(step: InitStep | null) {
    switch (step) {
        case "config":
            return {
                step: "config",
                description: "Set project identity and cognitive mode.",
                analysis_tips: [
                    "Read README.md for project name and purpose",
                    "Check package.json / Cargo.toml / go.mod for tech stack",
                    "Examine directory structure for domain boundaries (src/, lib/, services/)",
                ],
                schema_reference: {
                    cognitive_modes: [...COGNITIVE_MODES],
                },
                tips: [
                    "cognitive_mode controls governance strictness: lightweight (G3-only approval), standard (G2+), institutional (G1+)",
                    "domains should match major module boundaries — aim for 3-10 domains",
                    "Include tech_stack for frameworks and libraries: [{name, domain, summary}]",
                ],
            };
        case "skeleton":
            return {
                step: "skeleton",
                description: "Map domain boundaries, ownership, and causal keywords.",
                analysis_tips: [
                    "Each domain should own specific directories (owns) and not own others (does_not_own)",
                    "causal_keywords are terms that activate this domain during cairn_context",
                    "dependencies track which domains depend on which",
                ],
                tips: [
                    "One skeleton node per domain from the config step",
                    "owns/does_not_own use relative paths from project root",
                    "causal_keywords should include module names, key class names, and domain terms",
                ],
            };
        case "blood":
            return {
                step: "blood",
                description: "Capture key decisions, rejections, and constraints as evolution events.",
                analysis_tips: [
                    "Cross-reference ALL FOUR sources — missing any one produces blind spots:",
                    "① Git history: 'git log --oneline -30', reverts, dependency changes, major version transitions",
                    "② Code structure: architecture constants, key abstractions, schema invariants, CI/CD config",
                    "③ Team memory: user auto-memory files, lessons-learned docs, past incident records, feedback logs",
                    "④ Project instructions: CLAUDE.md, .cursorrules, README philosophy sections, ADRs (docs/adr/)",
                    "Sources ③④ often contain trauma and constraints invisible in git — prioritize them for rejection and trauma events",
                ],
                schema_reference: {
                    event_types: [...EVENT_TYPES],
                    behavior_effect_types: [...BEHAVIOR_EFFECT_TYPES],
                    validity_levels: [...VALIDITY_LEVELS],
                    source_types: [...SOURCE_TYPES],
                    gravity_levels: [...GRAVITY_LEVELS],
                },
                tips: [
                    "Aim for 5-15 blood candidates covering: constraints, historical lessons (trauma), decision boundaries, and architecture philosophy",
                    "All candidates auto-confirm to blood during init (no staging needed)",
                    "Use 'rejection' type for known anti-patterns, 'architecture_decision' for chosen directions",
                    "behavior_effect.type: 'avoid_suggestion' creates no-go zones; 'prefer_approach' creates preferences",
                    "lifecycle.validity: 'identity' for permanent decisions, 'strategic' for long-term, 'tactical' for short-term",
                    "Use dry_run: true first to preview gravity assignments",
                ],
            };
        case "dna":
            return {
                step: "dna",
                description: "Define emergent personality traits (optional).",
                schema_reference: {
                    known_dna_traits: [...KNOWN_DNA_TRAITS],
                },
                tips: [
                    "Only two traits currently influence routing: simplicity_bias and infra_aggressiveness",
                    "Skip this step if insufficient evidence — DNA traits can emerge later via compression",
                    "confidence should reflect how strongly the pattern appears (0-1)",
                ],
            };
        case "stage":
            return {
                step: "stage",
                description: "Assess project lifecycle phase (optional).",
                schema_reference: {
                    project_phases: [...PROJECT_PHASES],
                },
                tips: [
                    "exploration: new project, many unknowns, rapid changes",
                    "growth: established direction, adding features, expanding scope",
                    "maturity: stable, focus on reliability and docs over new features",
                    "maintenance: minimal changes, bug fixes only",
                    "Stage can be inferred automatically by session_end if not set here",
                ],
            };
        default:
            return null;
    }
}

export async function handleInitStatus(ctx: CairnContext) {
    try {
        const state = await ctx.stateStore.load();
        const hasConfig = await ctx.configStore.exists();

        const warnings: string[] = [];
        const versionStatus = checkVersionMismatch(state.cairn_version, VERSION);
        if (versionStatus.kind === "missing" && hasConfig) {
            warnings.push(
                `cairn_version_missing: .cairn/ exists but state.yaml has no cairn_version. Run 'cairn migrate' to stamp the current version (${VERSION}).`
            );
        } else if (versionStatus.kind === "older") {
            warnings.push(
                `cairn_version_older: .cairn/ was last touched by ${versionStatus.recorded}, runtime is ${versionStatus.runtime}. Run 'cairn migrate' to apply any pending migrations.`
            );
        } else if (versionStatus.kind === "newer") {
            warnings.push(
                `cairn_version_newer: .cairn/ was written by ${versionStatus.recorded} but runtime is ${versionStatus.runtime}. Upgrade the runtime to avoid schema surprises.`
            );
        }

        if (state.session_in_progress) {
            warnings.push(
                `incomplete_session: a previous cairn_session_end started at ${state.session_in_progress.started_at} did not finish (last step: ${state.session_in_progress.step}). Run 'cairn doctor --recover' to clean up.`
            );
        }

        const completedSteps = state.init_progress?.completed_steps ?? [];
        const currentStep: InitStep | null = INIT_STEPS.find(s => !completedSteps.includes(s)) ?? null;

        let nextAction: string;
        if (state.initialization_status === "complete") {
            nextAction = "ready";
        } else if (completedSteps.length > 0) {
            nextAction = `continue initialization — next step: ${currentStep}`;
        } else if (hasConfig) {
            nextAction = "begin initialization — start with config step";
        } else {
            nextAction = "run cairn_init_commit({ step: \"config\", config: {...} }) to begin";
        }

        const result: Record<string, unknown> = {
            status: state.initialization_status,
            has_cairn_dir: hasConfig,
            cairn_version: state.cairn_version ?? null,
            runtime_version: VERSION,
            next_action: nextAction,
            warnings,
            completed_steps: completedSteps,
            current_step: currentStep,
        };

        if (state.initialization_status !== "complete") {
            result.guide = buildStepGuide(currentStep);
        }

        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
