import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export interface CairnPaths {
    root: string;
    cairnDir: string;
    outputMd: string;
    domainsDir: string;
    historyDir: string;
}

/**
 * Find the project root containing a .cairn/ directory.
 * Resolution order:
 *   1. CAIRN_ROOT env var (if set and valid)
 *   2. Walk up from startDir (default: process.cwd())
 *
 * Returns the directory containing .cairn/, or null if not found.
 */
export function findCairnRoot(startDir?: string): string | null {
    // 1. Check CAIRN_ROOT env var
    const envRoot = process.env["CAIRN_ROOT"];
    if (envRoot) {
        if (existsSync(join(envRoot, ".cairn"))) {
            return envRoot;
        }
    }

    // 2. Walk up directory tree from startDir
    let dir = startDir ?? process.cwd();
    while (true) {
        if (existsSync(join(dir, ".cairn"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) break; // reached filesystem root
        dir = parent;
    }

    return null;
}

/**
 * Resolve all standard Cairn paths from the project root.
 * Throws CairnError if .cairn/ is not found.
 */
export function resolvePaths(startDir?: string): CairnPaths {
    const root = findCairnRoot(startDir);
    if (!root) {
        throw new Error(
            "No .cairn/ directory found in this directory or any parent.\n\n" +
                "This project has not been initialized with Cairn. To set up:\n" +
                "  1. Run `cairn init` for interactive setup, or\n" +
                "  2. Create .cairn/ manually (see spec/FORMAT.md)",
        );
    }

    const cairnDir = join(root, ".cairn");
    return {
        root,
        cairnDir,
        outputMd: join(cairnDir, "output.md"),
        domainsDir: join(cairnDir, "domains"),
        historyDir: join(cairnDir, "history"),
    };
}
