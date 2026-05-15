import { ensureCairnDirs } from "./context.js";
import { buildPaths } from "./paths.js";
import type { Config } from "./schemas/index.js";
import { ConfigStore } from "./stores/index.js";
import { stringify as yamlStringify } from "yaml";
import { writeFile } from "node:fs/promises";

export async function bootstrapEmpty(projectRoot: string): Promise<void> {
    const paths = buildPaths(projectRoot);
    await ensureCairnDirs(paths);

    const configStore = new ConfigStore(paths.config);
    if (!(await configStore.exists())) {
        const config: Config = {
            version: "3.0",
            project: { name: "", created: new Date().toISOString().slice(0, 7) },
            domains: [],
            cognitive_mode: "standard",
            stage: { override: null },
            tech_stack: [],
        };
        await configStore.save(config);
    }
}
