import { createCairnContext } from "../server.js";
import { handleCairnDoctor } from "../tools/cairn-doctor.js";

export async function runDoctor(args: string[]): Promise<void> {
    try {
        const ctx = createCairnContext();
        const result = handleCairnDoctor(ctx);
        const json = JSON.parse(result.content[0].text);

        if (args.includes("--json")) {
            console.log(JSON.stringify(json, null, 2));
            return;
        }

        console.log("Cairn Doctor");
        console.log("─".repeat(40));

        if (json.issues_count === 0) {
            console.log("✅ All checks passed. No issues found.");
            return;
        }

        console.log(`Found ${json.issues_count} issue(s):\n`);
        for (const issue of json.issues) {
            console.log(`  ⚠ ${issue}`);
        }

        console.log();
        console.log(`Output tokens: ${json.output_tokens.count} (${json.output_tokens.status})`);
        console.log(`Staged backlog: ${json.staged_backlog}`);
        console.log(`TODOs in memory: ${json.todos_in_memory}`);
        console.log(`Config: ${json.config_status}`);
    } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
    }
}
