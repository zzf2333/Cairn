import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { atomicWriteFile } from "../utils/atomic-write.js";
import {
    GovernancePolicySchema,
    AuditEntrySchema,
    AuditLogSchema,
    type GovernancePolicy,
    type AuditEntry,
} from "../schemas/index.js";

export class GovernanceStore {
    constructor(
        private readonly policyPath: string,
        private readonly auditPath: string,
    ) {}

    async ensureDir(): Promise<void> {
        await mkdir(dirname(this.policyPath), { recursive: true });
    }

    async loadPolicy(): Promise<GovernancePolicy> {
        try {
            const content = await readFile(this.policyPath, "utf-8");
            return GovernancePolicySchema.parse(yamlParse(content));
        } catch (err: any) {
            if (err.code === "ENOENT") return GovernancePolicySchema.parse({});
            throw err;
        }
    }

    async savePolicy(policy: GovernancePolicy): Promise<void> {
        await this.ensureDir();
        await atomicWriteFile(this.policyPath, yamlStringify(policy));
    }

    async loadAuditLog(): Promise<AuditEntry[]> {
        try {
            const content = await readFile(this.auditPath, "utf-8");
            return AuditLogSchema.parse(yamlParse(content));
        } catch (err: any) {
            if (err.code === "ENOENT") return [];
            throw err;
        }
    }

    async appendAudit(entry: AuditEntry): Promise<void> {
        const log = await this.loadAuditLog();
        log.push(AuditEntrySchema.parse(entry));
        await this.ensureDir();
        await atomicWriteFile(this.auditPath, yamlStringify(log));
    }
}
