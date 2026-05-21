import { createContext } from "../context.js";
import { VERSION } from "../constants.js";
import { checkVersionMismatch } from "../utils/version.js";

export async function runMigrate(): Promise<void> {
    const ctx = await createContext(process.env.CAIRN_ROOT ?? process.cwd());
    const state = await ctx.stateStore.load();
    const versionStatus = checkVersionMismatch(state.cairn_version, VERSION);

    switch (versionStatus.kind) {
        case "none":
            console.log(`Already at ${VERSION}. Nothing to migrate.`);
            return;
        case "missing":
            console.log(`Stamping .cairn/state.yaml with cairn_version: ${VERSION}`);
            await ctx.stateStore.setCairnVersion(VERSION);
            console.log("Done.");
            return;
        case "older":
            console.log(`Migrating .cairn/ from ${versionStatus.recorded} → ${VERSION}`);
            // 0.3.x → 0.4.0: no breaking schema changes, only stamp version.
            await ctx.stateStore.setCairnVersion(VERSION);
            console.log("Done. No data changes required between 0.3.x and 0.4.0.");
            return;
        case "newer":
            console.error(
                `.cairn/ was written by ${versionStatus.recorded}, but runtime is ${versionStatus.runtime}. Upgrade the runtime instead of migrating down.`
            );
            process.exit(2);
    }
}
