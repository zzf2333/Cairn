import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { VERSION, KNOWN_DNA_TRAITS } from "../constants.js";
import { checkVersionMismatch } from "../utils/version.js";
import { EVENT_TYPES } from "../schemas/evolution-event.js";
import { BEHAVIOR_EFFECT_TYPES, VALIDITY_LEVELS, SOURCE_TYPES, GRAVITY_LEVELS } from "../schemas/shared.js";
import { COGNITIVE_MODES } from "../schemas/config.js";
import { PROJECT_PHASES } from "../schemas/state.js";

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

        let nextAction: string;
        if (state.initialization_status === "complete") {
            nextAction = "ready";
        } else if (hasConfig) {
            nextAction = "resume initialization — config exists but state incomplete";
        } else {
            nextAction = "run cairn_init_commit to initialize project";
        }

        const result: Record<string, unknown> = {
            status: state.initialization_status,
            has_cairn_dir: hasConfig,
            cairn_version: state.cairn_version ?? null,
            runtime_version: VERSION,
            next_action: nextAction,
            warnings,
        };

        if (state.initialization_status !== "complete") {
            result.guide = {
                analysis_steps: [
                    "Read README.md and any docs/ directory for project purpose and conventions",
                    "Check package.json / Cargo.toml / go.mod / requirements.txt for tech stack and dependencies",
                    "Run 'git log --oneline -20' to see recent activity and project maturity",
                    "Examine directory structure for domain boundaries (src/, lib/, services/, etc.)",
                    "Look for CI/CD config (.github/workflows/, Makefile, docker-compose.yml)",
                    "Check for existing architectural docs (ADRs, ARCHITECTURE.md, etc.)",
                ],
                schema_reference: {
                    event_types: [...EVENT_TYPES],
                    behavior_effect_types: [...BEHAVIOR_EFFECT_TYPES],
                    validity_levels: [...VALIDITY_LEVELS],
                    source_types: [...SOURCE_TYPES],
                    gravity_levels: [...GRAVITY_LEVELS],
                    cognitive_modes: [...COGNITIVE_MODES],
                    project_phases: [...PROJECT_PHASES],
                    known_dna_traits: [...KNOWN_DNA_TRAITS],
                },
                tips: [
                    "Always call cairn_init_commit with dry_run: true first to preview TrustRouter routing",
                    "Aim for 5-15 blood_candidates — only signal-worthy decisions, not every detail",
                    "G0 events are dropped by TrustRouter — use G1+ for meaningful decisions",
                    "G2+ events in 'standard' cognitive_mode route to staged (requires human review)",
                    "Use 'rejection' type for known anti-patterns, 'architecture_decision' for chosen directions",
                    "behavior_effect.type: 'avoid_suggestion' creates no-go zones; 'prefer_approach' creates preferences",
                    "lifecycle.validity: 'identity' for permanent decisions, 'strategic' for long-term, 'tactical' for short-term",
                ],
            };
        }

        return toolResult(JSON.stringify(result));
    } catch (error) {
        return formatToolError(error);
    }
}
