import { readdir, stat } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import type { ScenarioSpec } from "./types.js";

const SCENARIOS_DIR = resolve(import.meta.dirname, "..");

const CATEGORY_MAP: Record<string, ScenarioSpec["category"]> = {
    a: "A",
    b: "B",
    c: "C",
    d: "D",
    e: "E",
    f: "F",
    g: "G",
    h: "H",
};

export async function discoverScenarios(filter?: string): Promise<ScenarioSpec[]> {
    const entries = await readdir(SCENARIOS_DIR);
    const out: ScenarioSpec[] = [];
    for (const name of entries.sort()) {
        if (name.startsWith("_") || name === "runner" || name === "node_modules") continue;
        const full = join(SCENARIOS_DIR, name);
        let s;
        try {
            s = await stat(full);
        } catch {
            continue;
        }
        if (!s.isDirectory()) continue;
        const m = name.match(/^([a-h])(\d+)-(.+)$/i);
        if (!m) continue;
        const id = `${m[1].toUpperCase()}${m[2]}`;
        if (filter) {
            const f = filter.toLowerCase();
            // Exact id match wins; otherwise fall back to substring match on id or dir name.
            const idLower = id.toLowerCase();
            const exactId = idLower === f;
            const subId = idLower.includes(f);
            const subName = name.toLowerCase().includes(f);
            if (!exactId && !subId && !subName) continue;
            // Defer non-exact matches so we can prefer exact if any.
            if (!exactId && out.some((s) => s.id.toLowerCase() === f)) continue;
        }
        out.push({
            id,
            title: m[3].replace(/-/g, " "),
            category: CATEGORY_MAP[m[1].toLowerCase()],
            fixtureDir: join(full, "fixture"),
            promptPath: join(full, "prompt.md"),
            expectedPath: join(full, "expected.yaml"),
            fixturePath: join(full, "fixture.yaml"),
            rootDir: full,
        });
    }
    return out;
}
