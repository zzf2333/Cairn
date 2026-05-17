import type { CairnContext } from "../context.js";
import { toolResult, formatToolError } from "../errors.js";
import { VERSION } from "../constants.js";
import { checkVersionMismatch } from "../utils/version.js";

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

        return toolResult(JSON.stringify({
            status: state.initialization_status,
            has_cairn_dir: hasConfig,
            cairn_version: state.cairn_version ?? null,
            runtime_version: VERSION,
            next_action: nextAction,
            warnings,
        }));
    } catch (error) {
        return formatToolError(error);
    }
}
