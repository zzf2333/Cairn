import { readdir, readFile, mkdir, rename, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { parse as yamlParse } from "yaml";
import type { BloodStore, SkeletonStore, StateStore } from "../stores/index.js";
import type { CairnPaths } from "../paths.js";

export interface CorruptionReport {
    path: string;
    kind: "yaml_parse_failure" | "schema_invalid" | "orphan_skeleton_ref" | "orphan_draft_event";
    message: string;
}

export interface RecoveryResult {
    scanned: number;
    corruptions: CorruptionReport[];
    quarantined: string[];
}

export class RecoveryEngine {
    constructor(
        private readonly paths: CairnPaths,
        private readonly bloodStore: BloodStore,
        private readonly skeletonStore: SkeletonStore,
        private readonly stateStore: StateStore,
    ) {}

    private quarantineDir(): string {
        return join(this.paths.root, ".cairn", "quarantine", new Date().toISOString().replace(/[:.]/g, "-"));
    }

    async scan(): Promise<RecoveryResult> {
        const corruptions: CorruptionReport[] = [];
        let scanned = 0;

        const dirs = [
            this.paths.blood,
            this.paths.staged,
            this.paths.skeleton,
            this.paths.dnaStaged,
        ];

        for (const dir of dirs) {
            try {
                const entries = await readdir(dir);
                for (const entry of entries) {
                    if (!entry.endsWith(".yaml")) continue;
                    const path = join(dir, entry);
                    scanned++;
                    try {
                        const content = await readFile(path, "utf-8");
                        const parsed = yamlParse(content);
                        if (parsed === null || typeof parsed !== "object") {
                            corruptions.push({
                                path,
                                kind: "schema_invalid",
                                message: "yaml parsed to non-object",
                            });
                        }
                    } catch (err: any) {
                        corruptions.push({
                            path,
                            kind: "yaml_parse_failure",
                            message: err.message ?? String(err),
                        });
                    }
                }
            } catch (err: any) {
                if (err.code !== "ENOENT") throw err;
            }
        }

        try {
            const blood = await this.bloodStore.loadAll();
            const skeletonNodes = await this.skeletonStore.loadAll();
            const skeletonDomains = new Set(skeletonNodes.map(n => n.domain));
            for (const event of blood) {
                if (!skeletonDomains.has(event.domain)) {
                    corruptions.push({
                        path: join(this.paths.blood, `${event.id}.yaml`),
                        kind: "orphan_skeleton_ref",
                        message: `event.domain "${event.domain}" not in skeleton`,
                    });
                }
            }
        } catch {
            // ignore — store-level corruption already reported above
        }

        return { scanned, corruptions, quarantined: [] };
    }

    async fix(report: RecoveryResult): Promise<RecoveryResult> {
        if (report.corruptions.length === 0) {
            return { ...report, quarantined: [] };
        }
        const qDir = this.quarantineDir();
        await mkdir(qDir, { recursive: true });
        const quarantined: string[] = [];
        for (const c of report.corruptions) {
            if (c.kind === "yaml_parse_failure" || c.kind === "schema_invalid" || c.kind === "orphan_draft_event") {
                try {
                    await stat(c.path);
                    const dest = join(qDir, basename(c.path));
                    await rename(c.path, dest);
                    quarantined.push(dest);
                } catch (err: any) {
                    if (err.code !== "ENOENT") throw err;
                }
            }
        }
        return { ...report, quarantined };
    }

    async recoverSession(): Promise<{ recovered: boolean; previous_checkpoint?: { started_at: string; step: string } }> {
        const state = await this.stateStore.load();
        if (!state.session_in_progress) return { recovered: false };
        const checkpoint = state.session_in_progress;
        await this.stateStore.clearSessionCheckpoint();
        return { recovered: true, previous_checkpoint: checkpoint };
    }
}
