import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface CliBridge {
    callTool: (name: string, args: Record<string, unknown>) => Promise<{ text: string; isError: boolean }>;
    close: () => Promise<void>;
}

const TOOL_TO_SUBCOMMAND: Record<string, string[]> = {
    cairn_context: ["context"],
    cairn_plan: ["plan"],
    cairn_signal: ["signal"],
    cairn_observe: ["observe"],
    cairn_session_end: ["session-end"],
    cairn_session_recover: ["session-recover"],
    cairn_status: ["status"],
    cairn_doctor: ["doctor"],
    cairn_init_status: ["init", "--empty"],
    cairn_init_commit: ["init", "--empty"],
    cairn_stage_list: ["stage", "list"],
    cairn_stage_accept: ["stage", "accept"],
    cairn_stage_reject: ["stage", "reject"],
    cairn_dna_list: ["dna", "list"],
    cairn_dna_accept: ["dna", "accept"],
    cairn_dna_reject: ["dna", "reject"],
    cairn_review: ["review"],
};

const RUNTIME_COMMANDS = new Set([
    "cairn_context", "cairn_plan", "cairn_signal",
    "cairn_observe", "cairn_session_end", "cairn_session_recover",
]);

function buildFlags(name: string, args: Record<string, unknown>): string[] {
    const flags: string[] = [];
    for (const [key, value] of Object.entries(args)) {
        if (key === "candidates") continue;
        if (value === undefined || value === null) continue;
        const flag = `--${key}`;
        if (typeof value === "boolean") {
            if (value) flags.push(flag);
        } else if (Array.isArray(value)) {
            flags.push(flag, value.join(","));
        } else {
            flags.push(flag, String(value));
        }
    }
    if (RUNTIME_COMMANDS.has(name)) {
        flags.push("--json");
    }
    return flags;
}

export async function startCliBridge(projectRoot: string): Promise<CliBridge> {
    const cairnEntry = resolve(import.meta.dirname, "../../../dist/cli/index.js");
    const nodeExec = process.execPath;

    async function callTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
        const subcmd = TOOL_TO_SUBCOMMAND[name];
        if (!subcmd) return { text: `unknown tool: ${name}`, isError: true };

        let candidatesTmpDir: string | undefined;
        const flags = buildFlags(name, args);

        if (args.candidates && Array.isArray(args.candidates)) {
            candidatesTmpDir = await mkdtemp(join(tmpdir(), "cairn-candidates-"));
            const tmpFile = join(candidatesTmpDir, "candidates.json");
            await writeFile(tmpFile, JSON.stringify(args.candidates), "utf8");
            flags.push("--candidates-file", tmpFile);
        }

        try {
            const { stdout, stderr, exitCode } = await exec(
                nodeExec,
                [cairnEntry, ...subcmd, ...flags],
                { CAIRN_ROOT: projectRoot },
            );

            if (exitCode !== 0) {
                return { text: stderr || stdout || `exit code ${exitCode}`, isError: true };
            }
            return { text: stdout, isError: false };
        } finally {
            if (candidatesTmpDir) {
                await rm(candidatesTmpDir, { recursive: true, force: true }).catch(() => {});
            }
        }
    }

    return { callTool, close: async () => {} };
}

function exec(
    cmd: string,
    args: string[],
    extraEnv: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolveP) => {
        execFile(
            cmd,
            args,
            { env: { ...process.env, ...extraEnv }, timeout: 30_000 },
            (error, stdout, stderr) => {
                let exitCode = 0;
                if (error) {
                    exitCode = typeof (error as { code?: unknown }).code === "number"
                        ? (error as { code: number }).code
                        : 1;
                }
                resolveP({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode });
            },
        );
    });
}
