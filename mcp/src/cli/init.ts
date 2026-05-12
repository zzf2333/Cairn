import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { createInterface } from "node:readline";
import { simpleGit } from "simple-git";
import type { Config } from "../schemas/config.js";

const STANDARD_DOMAINS = [
    "api-layer",
    "auth",
    "database",
    "state-management",
    "frontend-framework",
    "testing",
    "deployment",
    "monitoring",
    "architecture",
    "performance",
    "security",
];

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

export async function runInit(args: string[]): Promise<void> {
    const cwd = process.cwd();
    const cairnDir = join(cwd, ".cairn");

    if (existsSync(cairnDir)) {
        console.log(".cairn/ already exists. Use --force to reinitialize.");
        if (!args.includes("--force")) return;
    }

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        console.log("\n🗻 Cairn — Project Memory Engine Initialization\n");

        // Step 1: Project info
        const projectName = await ask(rl, "Project name: ");
        const projectCreated = await ask(
            rl,
            "Project start date (YYYY-MM, e.g. 2024-01): ",
        );

        // Step 2: Select domains
        console.log("\nAvailable domains:");
        STANDARD_DOMAINS.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
        console.log("  (Enter numbers separated by commas, or custom names)");
        const domainInput = await ask(rl, "\nSelect domains: ");

        const selectedDomains: string[] = [];
        for (const part of domainInput.split(/[,\s]+/)) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const num = parseInt(trimmed, 10);
            if (!isNaN(num) && num >= 1 && num <= STANDARD_DOMAINS.length) {
                selectedDomains.push(STANDARD_DOMAINS[num - 1]);
            } else if (/^[a-z][a-z0-9-]*$/.test(trimmed)) {
                selectedDomains.push(trimmed);
            }
        }
        const domains = [...new Set(selectedDomains)];

        rl.close();

        // Step 3: Scan git history for candidate signals
        console.log("\nScanning git history...");
        let gitScanResults: string[] = [];
        try {
            const git = simpleGit(cwd);
            const log = await git.log({ maxCount: 100 });

            for (const commit of log.all) {
                const msg = commit.message.toLowerCase();
                if (msg.startsWith("revert") || msg.includes('revert "')) {
                    gitScanResults.push(
                        `[revert] ${commit.message.slice(0, 80)} (${commit.hash.slice(0, 7)})`,
                    );
                }
            }
            console.log(
                gitScanResults.length > 0
                    ? `Found ${gitScanResults.length} candidate signals.`
                    : "No significant signals found in git history.",
            );
        } catch {
            console.log("Git scan skipped (not a git repo or git unavailable).");
        }

        // Step 4: Generate .cairn/ directory
        console.log("\nCreating .cairn/ directory structure...");

        const dirs = [
            cairnDir,
            join(cairnDir, "signals"),
            join(cairnDir, "staged"),
            join(cairnDir, "memory"),
            join(cairnDir, "views"),
            join(cairnDir, "views", "domains"),
            join(cairnDir, "sessions"),
        ];
        for (const dir of dirs) {
            mkdirSync(dir, { recursive: true });
        }

        // config.yaml
        const config: Config = {
            version: "2.0",
            project: {
                name: projectName || "my-project",
                created: projectCreated || new Date().toISOString().slice(0, 7),
            },
            domains: { locked: domains },
            trust_policy: {
                L3_auto_write: [
                    "source.kind == 'git-revert' AND scope == 'local'",
                    "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'",
                ],
                L2_staged: [
                    "scope == 'global'",
                    "type == 'transition' AND affects_output == true",
                ],
                never_auto: [
                    "新增全局 no-go",
                    "阶段变更",
                    "output 级别 stack 变更",
                    "scope == 'global' 的 behavior_effect",
                ],
            },
            stage: { override: null, auto_constraint: false },
        };

        writeFileSync(
            join(cairnDir, "config.yaml"),
            yamlStringify(config),
            "utf-8",
        );

        // state.yaml
        const state = {
            last_session_commit: null,
            last_session_at: null,
            stage: {
                phase: "growth",
                confidence: 0.4,
                status: "advisory",
                evidence: [],
                guidance: ["Default initial stage — run cairn to refine"],
                last_updated: new Date().toISOString(),
            },
        };
        writeFileSync(
            join(cairnDir, "state.yaml"),
            yamlStringify(state),
            "utf-8",
        );

        // views/output.md (initial)
        const outputMd = `<!--
Generated by Cairn. Do not edit manually.
Source: .cairn/memory/*.yaml
Last generated: ${new Date().toISOString()}
-->

## stage

phase: growth
confidence: 0.4
status: advisory

## no-go

(none)

## hooks

${domains.map((d) => `- ${d}`).join("\n")}
`;
        writeFileSync(join(cairnDir, "views", "output.md"), outputMd, "utf-8");

        console.log("\n✅ .cairn/ initialized successfully!");
        console.log("\nDirectory structure:");
        console.log("  .cairn/config.yaml     — project configuration");
        console.log("  .cairn/state.yaml      — server runtime state");
        console.log("  .cairn/signals/        — L1 candidate signals");
        console.log("  .cairn/staged/         — L2 pending review");
        console.log("  .cairn/memory/         — formal memory entries");
        console.log("  .cairn/views/          — auto-generated views");
        console.log("  .cairn/sessions/       — session records");

        console.log("\nMCP Server configuration:");
        console.log("  Add to your AI tool's MCP config:");
        console.log('  {');
        console.log('    "mcpServers": {');
        console.log('      "cairn": {');
        console.log('        "command": "cairn-mcp-server"');
        console.log("      }");
        console.log("    }");
        console.log("  }");

        if (gitScanResults.length > 0) {
            console.log("\nCandidate signals from git history:");
            for (const s of gitScanResults) {
                console.log(`  ${s}`);
            }
            console.log(
                "\nThese will be processed on first MCP server startup.",
            );
        }
    } catch (err) {
        rl.close();
        throw err;
    }
}
