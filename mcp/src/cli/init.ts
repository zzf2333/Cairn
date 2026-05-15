import { bootstrapEmpty } from "../bootstrap.js";

export async function runInit(args: string[]): Promise<void> {
    const hasEmpty = args.includes("--empty");

    if (!hasEmpty) {
        console.error("Usage: cairn init --empty");
        process.exit(1);
    }

    await bootstrapEmpty(process.cwd());
    console.log("Cairn V3 initialized (empty structure)");
}
