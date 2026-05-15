import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import {
    DomainConstraintsSchema,
    DomainAcceptedDebtSchema,
    DomainRejectedPathsSchema,
    type DomainConstraints,
    type DomainAcceptedDebt,
    type DomainRejectedPaths,
} from "../schemas/index.js";

export class DomainStore {
    constructor(private readonly dir: string) {}

    async ensureDir(domain: string): Promise<void> {
        await mkdir(join(this.dir, domain), { recursive: true });
    }

    async loadConstraints(domain: string): Promise<DomainConstraints> {
        try {
            const raw = await readFile(join(this.dir, domain, "constraints.yaml"), "utf-8");
            return DomainConstraintsSchema.parse(yamlParse(raw));
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return DomainConstraintsSchema.parse({ domain, constraints: [] });
            }
            throw err;
        }
    }

    async saveConstraints(data: DomainConstraints): Promise<void> {
        await this.ensureDir(data.domain);
        await writeFile(
            join(this.dir, data.domain, "constraints.yaml"),
            yamlStringify(data),
            "utf-8",
        );
    }

    async loadAcceptedDebt(domain: string): Promise<DomainAcceptedDebt> {
        try {
            const raw = await readFile(join(this.dir, domain, "accepted_debt.yaml"), "utf-8");
            return DomainAcceptedDebtSchema.parse(yamlParse(raw));
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return DomainAcceptedDebtSchema.parse({ domain, debts: [] });
            }
            throw err;
        }
    }

    async saveAcceptedDebt(data: DomainAcceptedDebt): Promise<void> {
        await this.ensureDir(data.domain);
        await writeFile(
            join(this.dir, data.domain, "accepted_debt.yaml"),
            yamlStringify(data),
            "utf-8",
        );
    }

    async loadRejectedPaths(domain: string): Promise<DomainRejectedPaths> {
        try {
            const raw = await readFile(join(this.dir, domain, "rejected_paths.yaml"), "utf-8");
            return DomainRejectedPathsSchema.parse(yamlParse(raw));
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return DomainRejectedPathsSchema.parse({ domain, paths: [] });
            }
            throw err;
        }
    }

    async saveRejectedPaths(data: DomainRejectedPaths): Promise<void> {
        await this.ensureDir(data.domain);
        await writeFile(
            join(this.dir, data.domain, "rejected_paths.yaml"),
            yamlStringify(data),
            "utf-8",
        );
    }

    async listDomains(): Promise<string[]> {
        try {
            const entries = await readdir(this.dir, { withFileTypes: true });
            return entries.filter(e => e.isDirectory()).map(e => e.name);
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return [];
            }
            throw err;
        }
    }
}
