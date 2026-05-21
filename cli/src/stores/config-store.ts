import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { ConfigSchema, type Config } from "../schemas/index.js";
import { atomicWriteFile } from "../utils/atomic-write.js";

export class ConfigStore {
    constructor(private readonly filePath: string) {}

    async load(): Promise<Config | null> {
        try {
            const content = await readFile(this.filePath, "utf-8");
            return ConfigSchema.parse(yamlParse(content));
        } catch (err: any) {
            if (err.code === "ENOENT") return null;
            throw err;
        }
    }

    async save(config: Config): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        await atomicWriteFile(this.filePath, yamlStringify(config));
    }

    async exists(): Promise<boolean> {
        try {
            await readFile(this.filePath);
            return true;
        } catch (err: any) {
            if (err.code === "ENOENT") return false;
            throw err;
        }
    }
}
