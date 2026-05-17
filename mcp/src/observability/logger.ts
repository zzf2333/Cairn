import { appendFile, mkdir, readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

export interface ToolLogEntry {
    ts: string;
    tool: string;
    duration_ms: number;
    ok: boolean;
    args_summary?: string;
    error?: string;
}

export interface LoggerConfig {
    enabled: boolean;
    retention_days: number;
}

export class ToolLogger {
    private rotationCheckedAt: number = 0;

    constructor(
        private readonly logDir: string,
        private readonly config: LoggerConfig,
    ) {}

    private fileFor(date: Date): string {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const d = String(date.getUTCDate()).padStart(2, "0");
        return join(this.logDir, `tools-${y}-${m}-${d}.jsonl`);
    }

    async log(entry: ToolLogEntry): Promise<void> {
        if (!this.config.enabled) return;
        try {
            await mkdir(this.logDir, { recursive: true });
            const path = this.fileFor(new Date(entry.ts));
            await appendFile(path, JSON.stringify(entry) + "\n", "utf-8");
            await this.maybeRotate();
        } catch {
            // logging must not break the tool call
        }
    }

    private async maybeRotate(): Promise<void> {
        const now = Date.now();
        if (now - this.rotationCheckedAt < 60 * 60 * 1000) return;
        this.rotationCheckedAt = now;
        if (this.config.retention_days <= 0) return;
        try {
            const entries = await readdir(this.logDir);
            const cutoff = now - this.config.retention_days * 24 * 60 * 60 * 1000;
            for (const name of entries) {
                if (!name.startsWith("tools-") || !name.endsWith(".jsonl")) continue;
                const path = join(this.logDir, name);
                const st = await stat(path);
                if (st.mtimeMs < cutoff) {
                    await unlink(path);
                }
            }
        } catch {
            // ignore
        }
    }
}

export function summarizeArgs(args: unknown): string {
    if (args === undefined || args === null) return "";
    try {
        const s = JSON.stringify(args);
        return s.length > 200 ? s.slice(0, 200) + "…" : s;
    } catch {
        return String(args);
    }
}
