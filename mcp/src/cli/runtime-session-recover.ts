import { createContext } from "../context.js";
import { sessionRecoverAction } from "../actions/session-recover-action.js";

export async function runRuntimeSessionRecover(args: string[]): Promise<void> {
    const json = args.includes("--json");
    const ctx = await createContext(process.env.CAIRN_ROOT ?? process.cwd());

    const result = await sessionRecoverAction(ctx);

    if (json) {
        console.log(JSON.stringify(result));
        return;
    }

    if (result.recovered) {
        console.log(`Session recovered${result.legacy ? " (legacy)" : ""}`);
    } else {
        console.log(`No stale session to recover`);
    }
}
