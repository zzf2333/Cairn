import { execFileSync } from "node:child_process";

export function runCairn(args) {
    const result = execFileSync("cairn", [...args, "--json"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result);
}

export function runCairnRaw(args) {
    try {
        const data = runCairn(args);
        process.stdout.write(JSON.stringify(data) + "\n");
    } catch (err) {
        const msg = err.stderr?.trim() || err.message;
        process.stderr.write(msg + "\n");
        process.exit(1);
    }
}
