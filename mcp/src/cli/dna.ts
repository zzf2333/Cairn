import { createContext } from "../context.js";

export async function runDna(args: string[]): Promise<void> {
    const sub = args[0];
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);

    if (sub === "show") {
        const identity = await ctx.dnaStore.loadIdentity();
        if (Object.keys(identity.traits).length === 0) {
            console.log("No DNA traits defined");
            return;
        }
        for (const [name, trait] of Object.entries(identity.traits)) {
            console.log(`${name}: level=${trait.level} confidence=${trait.confidence}`);
        }
        return;
    }

    if (sub === "reevaluate") {
        const identity = await ctx.dnaStore.loadIdentity();
        identity.reevaluation_mode = !identity.reevaluation_mode;
        await ctx.dnaStore.saveIdentity(identity);
        const mode = identity.reevaluation_mode ? "active" : "passive";
        console.log(`DNA reevaluation mode: ${mode}`);
        return;
    }

    console.log("Usage: cairn dna <show|reevaluate>");
    process.exit(1);
}
