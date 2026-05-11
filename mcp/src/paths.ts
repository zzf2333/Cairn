import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export interface CairnPaths {
    root: string;
    cairnDir: string;
    configYaml: string;
    stateYaml: string;
    signalsDir: string;
    stagedDir: string;
    memoryDir: string;
    viewsDir: string;
    viewsDomainsDir: string;
    sessionsDir: string;
}

export function findCairnRoot(startDir?: string): string | null {
    const envRoot = process.env["CAIRN_ROOT"];
    if (envRoot && existsSync(join(envRoot, ".cairn"))) {
        return envRoot;
    }

    let dir = startDir ?? process.cwd();
    while (true) {
        if (existsSync(join(dir, ".cairn"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    return null;
}

export function resolvePaths(startDir?: string): CairnPaths {
    const root = findCairnRoot(startDir);
    if (!root) {
        throw new Error(
            "No .cairn/ directory found in this directory or any parent.\n\n" +
                "Run `cairn init` to initialize this project.",
        );
    }

    const cairnDir = join(root, ".cairn");
    const viewsDir = join(cairnDir, "views");
    return {
        root,
        cairnDir,
        configYaml: join(cairnDir, "config.yaml"),
        stateYaml: join(cairnDir, "state.yaml"),
        signalsDir: join(cairnDir, "signals"),
        stagedDir: join(cairnDir, "staged"),
        memoryDir: join(cairnDir, "memory"),
        viewsDir,
        viewsDomainsDir: join(viewsDir, "domains"),
        sessionsDir: join(cairnDir, "sessions"),
    };
}
