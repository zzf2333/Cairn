import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { stringify as yamlStringify } from "yaml";
import { simpleGit } from "simple-git";
import { buildPaths, type CairnPaths } from "./paths.js";
import type { Config } from "./schemas/config.js";

export interface BootstrapResult {
    created: boolean;
    paths: CairnPaths;
    projectMeta: {
        name: string;
        created: string;
        detected_from: string;
    };
    gitSummary: {
        total_commits: number;
        first_commit_date: string | null;
        recent_commits: Array<{
            hash: string;
            message: string;
            date: string;
            author: string;
        }>;
        auto_signals_routed: number;
    } | null;
}

function detectProjectName(root: string): { name: string; from: string } {
    try {
        const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
        if (pkg.name && typeof pkg.name === "string") {
            return { name: pkg.name, from: "package.json" };
        }
    } catch { /* not a node project */ }

    try {
        const cargo = readFileSync(join(root, "Cargo.toml"), "utf-8");
        const match = cargo.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) return { name: match[1], from: "Cargo.toml" };
    } catch { /* not a rust project */ }

    try {
        const gomod = readFileSync(join(root, "go.mod"), "utf-8");
        const match = gomod.match(/^module\s+(\S+)/m);
        if (match) {
            const parts = match[1].split("/");
            return { name: parts[parts.length - 1], from: "go.mod" };
        }
    } catch { /* not a go project */ }

    try {
        const pyproject = readFileSync(join(root, "pyproject.toml"), "utf-8");
        const match = pyproject.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) return { name: match[1], from: "pyproject.toml" };
    } catch { /* not a python project */ }

    return { name: basename(root), from: "directory" };
}

async function detectCreatedDate(root: string): Promise<string> {
    try {
        const git = simpleGit(root);
        const log = await git.log(["--reverse", "--max-count=1", "--format=%aI"]);
        if (log.latest?.date) {
            return log.latest.date.slice(0, 7);
        }
    } catch { /* no git */ }
    return new Date().toISOString().slice(0, 7);
}

async function collectGitSummary(root: string): Promise<BootstrapResult["gitSummary"]> {
    try {
        const git = simpleGit(root);
        await git.status();

        const log = await git.log({ maxCount: 50 });
        const allLog = await git.log({ maxCount: 1 });

        let totalCommits = 0;
        try {
            const raw = await git.raw(["rev-list", "--count", "HEAD"]);
            totalCommits = parseInt(raw.trim(), 10) || 0;
        } catch {
            totalCommits = allLog.total;
        }

        let firstCommitDate: string | null = null;
        try {
            const firstLog = await git.log(["--reverse", "--max-count=1"]);
            firstCommitDate = firstLog.latest?.date ?? null;
        } catch { /* ignore */ }

        const recentCommits = log.all.map((c) => ({
            hash: c.hash.slice(0, 7),
            message: c.message.slice(0, 120),
            date: c.date,
            author: c.author_name,
        }));

        return {
            total_commits: totalCommits,
            first_commit_date: firstCommitDate,
            recent_commits: recentCommits,
            auto_signals_routed: 0,
        };
    } catch {
        return null;
    }
}

export async function bootstrapCairnDir(startDir?: string): Promise<BootstrapResult> {
    const envRoot = process.env["CAIRN_ROOT"];
    const root = envRoot && existsSync(envRoot) ? envRoot : (startDir ?? process.cwd());
    const cairnDir = join(root, ".cairn");
    const paths = buildPaths(root);

    if (root === homedir()) {
        throw new Error(
            "Refusing to bootstrap .cairn in home directory. " +
            "Set CAIRN_ROOT env var or ensure MCP client provides roots.",
        );
    }

    if (existsSync(cairnDir)) {
        const { name, from } = detectProjectName(root);
        return {
            created: false,
            paths,
            projectMeta: { name, created: "", detected_from: from },
            gitSummary: null,
        };
    }

    const dirs = [
        cairnDir,
        paths.signalsDir,
        paths.stagedDir,
        paths.memoryDir,
        paths.viewsDir,
        paths.viewsDomainsDir,
        paths.sessionsDir,
    ];
    for (const dir of dirs) {
        mkdirSync(dir, { recursive: true });
    }

    const { name, from } = detectProjectName(root);
    const created = await detectCreatedDate(root);

    const config: Config = {
        version: "2.0",
        project: { name, created },
        domains: { locked: [] },
        trust_policy: {
            L3_auto_write: [
                "source.kind == 'git-revert' AND scope == 'local'",
                "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'",
            ],
            L2_staged: [
                "scope == 'global'",
                "type == 'transition' AND affects_output == true",
            ],
            never_auto: [
                "New global no-go",
                "Stage change",
                "Output-level stack change",
                "scope == 'global' behavior_effect",
            ],
        },
        stage: { override: null, auto_constraint: false },
    };
    writeFileSync(paths.configYaml, yamlStringify(config), "utf-8");

    const state = {
        last_session_commit: null,
        last_session_at: null,
        stage: {
            phase: "growth",
            confidence: 0.4,
            status: "advisory",
            evidence: [],
            guidance: ["Default initial stage — run cairn to refine"],
            last_updated: new Date().toISOString(),
        },
    };
    writeFileSync(paths.stateYaml, yamlStringify(state), "utf-8");

    const outputMd = `<!--
Generated by Cairn. Do not edit manually.
Source: .cairn/memory/*.yaml
Last generated: ${new Date().toISOString()}
-->

## stage

phase: growth
confidence: 0.4
status: advisory

## no-go

(none)

## hooks

(none — domains will be detected automatically)
`;
    writeFileSync(join(paths.viewsDir, "output.md"), outputMd, "utf-8");

    const gitSummary = await collectGitSummary(root);

    return {
        created: true,
        paths,
        projectMeta: { name, created, detected_from: from },
        gitSummary,
    };
}
