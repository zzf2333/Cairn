import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { DNAIdentitySchema, DNAImprintSchema, type DNAIdentity, type DNAImprint } from "../schemas/index.js";

async function loadYamlFile(path: string): Promise<unknown | null> {
    try {
        const content = await readFile(path, "utf-8");
        return yamlParse(content);
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

async function saveYamlFile(path: string, data: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, yamlStringify(data), "utf-8");
}

export class DnaStore {
    constructor(
        private readonly identityPath: string,
        private readonly imprintPath: string,
    ) {}

    async loadIdentity(): Promise<DNAIdentity> {
        const raw = await loadYamlFile(this.identityPath);
        if (raw === null) return DNAIdentitySchema.parse({});
        return DNAIdentitySchema.parse(raw);
    }

    async saveIdentity(identity: DNAIdentity): Promise<void> {
        await saveYamlFile(this.identityPath, identity);
    }

    async loadImprint(): Promise<DNAImprint | null> {
        const raw = await loadYamlFile(this.imprintPath);
        if (raw === null) return null;
        return DNAImprintSchema.parse(raw);
    }

    async saveImprint(imprint: DNAImprint): Promise<void> {
        await saveYamlFile(this.imprintPath, imprint);
    }
}
