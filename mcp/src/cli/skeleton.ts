import { createContext } from "../context.js";

export async function runSkeleton(args: string[]): Promise<void> {
    const sub = args[0];
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);

    if (sub === "show") {
        const nodes = await ctx.skeletonStore.loadAll();
        if (nodes.length === 0) {
            console.log("No skeleton nodes defined");
            return;
        }
        for (const node of nodes) {
            console.log(`Domain: ${node.domain}`);
            console.log(`Role: ${node.role}`);
            console.log(`Owns: ${node.owns.join(", ") || "(none)"}`);
            console.log(`Does not own: ${node.does_not_own.join(", ") || "(none)"}`);
            console.log(`Stability: ${node.stability}`);
            console.log(`Dependencies: ${node.dependencies.join(", ") || "(none)"}`);
            console.log("");
        }
        return;
    }

    console.log("Usage: cairn skeleton show");
    process.exit(1);
}
