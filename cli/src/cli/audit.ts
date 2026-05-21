import { createContext } from "../context.js";

export async function runAudit(): Promise<void> {
    const ctx = await createContext(process.cwd());

    const log = await ctx.governanceStore.loadAuditLog();

    if (log.length === 0) {
        console.log("No audit entries");
        return;
    }

    for (const entry of log) {
        let line = `${entry.time}  ${entry.action}  ${entry.target}  [${entry.actor}]`;
        if (entry.reason) {
            line += `  ${entry.reason}`;
        }
        if (entry.evidence) {
            line += `  evidence: ${entry.evidence}`;
        }
        console.log(line);
    }
}
