import { createContext } from "../context.js";

export async function runStage(args: string[]): Promise<void> {
    const sub = args[0];
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);

    if (sub === "confirm") {
        const state = await ctx.stateStore.load();
        state.stage.status = "confirmed";
        await ctx.stateStore.save(state);
        await ctx.governanceEngine.logAudit({
            time: new Date().toISOString(),
            action: "stage_confirmed",
            target: state.stage.phase,
            actor: "human",
        });
        console.log(`Stage confirmed: ${state.stage.phase}`);
        return;
    }

    console.log("Usage: cairn stage confirm");
    process.exit(1);
}
