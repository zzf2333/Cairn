import { simpleGit, type SimpleGit } from "simple-git";
import type { GitSignal, SkeletonNode } from "../schemas/index.js";
import type { SkeletonStore } from "../stores/index.js";

const DEPENDENCY_FILES = [
    "package.json", "go.mod", "requirements.txt",
    "Cargo.toml", "pyproject.toml",
];

export interface GitEarResult {
    signals: GitSignal[];
}

interface DomainInference {
    domain: string | undefined;
    confidence: number;
    evidence: string[];
}

const GLOBAL_FILES = new Set([
    ".gitignore",
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
]);

const GLOBAL_PREFIXES = [
    "docs/",
    ".github/",
];

const GENERATED_OR_LOCK_SUFFIXES = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "routeTree.gen.ts",
];

function normalizePrefix(prefix: string): string {
    return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function isGlobalOrConfigFile(file: string): boolean {
    if (GLOBAL_FILES.has(file)) return true;
    if (GLOBAL_PREFIXES.some(prefix => file.startsWith(prefix))) return true;
    if (file.startsWith(".")) return true;
    return false;
}

function isGeneratedOrLockFile(file: string): boolean {
    return GENERATED_OR_LOCK_SUFFIXES.some(suffix => file.endsWith(suffix));
}

export function inferDomainFromFiles(files: string[], nodes: SkeletonNode[]): DomainInference {
    const meaningfulFiles = files.filter(f => !isGeneratedOrLockFile(f));
    if (meaningfulFiles.length === 0) {
        return { domain: "global", confidence: 0.4, evidence: ["only generated or lock files changed"] };
    }

    if (meaningfulFiles.every(isGlobalOrConfigFile)) {
        return { domain: "global", confidence: 0.8, evidence: ["all changed files are docs or global config"] };
    }

    const scores = new Map<string, number>();
    const evidence = new Map<string, string[]>();

    for (const node of nodes) {
        scores.set(node.domain, 0);
        evidence.set(node.domain, []);
    }

    for (const file of meaningfulFiles) {
        for (const node of nodes) {
            const ownsMatch = node.owns.some(prefix => file === prefix || file.startsWith(normalizePrefix(prefix)));
            const doesNotOwnMatch = node.does_not_own.some(prefix => file === prefix || file.startsWith(normalizePrefix(prefix)));
            if (ownsMatch) {
                scores.set(node.domain, (scores.get(node.domain) ?? 0) + 3);
                evidence.get(node.domain)!.push(`owns:${file}`);
            }
            if (doesNotOwnMatch) {
                scores.set(node.domain, (scores.get(node.domain) ?? 0) - 1);
                evidence.get(node.domain)!.push(`does_not_own:${file}`);
            }
        }
    }

    const hasPathEvidence = Array.from(scores.values()).some(score => score > 0);
    if (!hasPathEvidence) {
        const joined = meaningfulFiles.join(" ").toLowerCase();
        for (const node of nodes) {
            for (const keyword of node.causal_keywords) {
                if (joined.includes(keyword.toLowerCase())) {
                    scores.set(node.domain, (scores.get(node.domain) ?? 0) + 1);
                    evidence.get(node.domain)!.push(`keyword:${keyword}`);
                }
            }
        }
    }

    const ranked = Array.from(scores.entries())
        .filter(([, score]) => score > 0)
        .sort((a, b) => b[1] - a[1]);

    if (ranked.length === 0) {
        return { domain: "global", confidence: 0.3, evidence: ["no skeleton path or keyword match"] };
    }

    const total = ranked.reduce((sum, [, score]) => sum + score, 0);
    const [topDomain, topScore] = ranked[0];
    const confidence = total > 0 ? topScore / total : 0;
    if (ranked.length > 1 && confidence < 0.7) {
        return {
            domain: "multi",
            confidence,
            evidence: ranked.flatMap(([domain]) => evidence.get(domain)!.slice(0, 3)),
        };
    }

    return {
        domain: topDomain,
        confidence,
        evidence: evidence.get(topDomain)!.slice(0, 6),
    };
}

export class GitEar {
    private readonly git: SimpleGit;

    constructor(
        private readonly projectRoot: string,
        private readonly skeletonStore: SkeletonStore,
    ) {
        this.git = simpleGit(projectRoot);
    }

    async scan(sinceCommit?: string | null): Promise<GitEarResult> {
        try {
            const log = sinceCommit
                ? await this.git.log({ from: sinceCommit, to: "HEAD" })
                : await this.git.log({ maxCount: 50 });

            const signals: GitSignal[] = [];
            const now = new Date().toISOString();
            const skeletonNodes = await this.skeletonStore.loadAll();
            let index = 0;

            for (const commit of log.all) {
                if (/revert/i.test(commit.message)) {
                    signals.push({
                        id: `sig_git_${Date.now()}_revert_${index++}`,
                        signal_type: "revert",
                        raw_data: {
                            commits: [commit.hash],
                        },
                        inferred_gravity: "G2",
                        inferred_domain: this.inferDomain(commit.message, skeletonNodes),
                        confidence: 0.8,
                        captured_at: now,
                    });
                }

                let diff: string;
                try {
                    diff = await this.git.diff([`${commit.hash}~1`, commit.hash, "--name-only"]);
                } catch {
                    continue;
                }

                const changedFiles = diff.split("\n").filter(Boolean);

                const depFiles = changedFiles.filter(f =>
                    DEPENDENCY_FILES.some(d => f.endsWith(d))
                );

                if (depFiles.length > 0) {
                    const depInfo = await this.detectDependencyChanges(commit.hash, depFiles);
                    if (depInfo.removed.length > 0) {
                        signals.push({
                            id: `sig_git_${Date.now()}_dependency_removed_${index++}`,
                            signal_type: "dependency_removed",
                            raw_data: {
                                commits: [commit.hash],
                                files_changed: depFiles,
                                packages: {
                                    removed: depInfo.removed,
                                },
                            },
                            inferred_gravity: "G1",
                            inferred_domain: this.inferDomain(commit.message, skeletonNodes),
                            confidence: 0.9,
                            captured_at: now,
                        });
                    }
                    if (depInfo.replaced.length > 0) {
                        signals.push({
                            id: `sig_git_${Date.now()}_dependency_replaced_${index++}`,
                            signal_type: "dependency_replaced",
                            raw_data: {
                                commits: [commit.hash],
                                files_changed: depFiles,
                                packages: {
                                    replaced: depInfo.replaced,
                                },
                            },
                            inferred_gravity: "G2",
                            inferred_domain: this.inferDomain(commit.message, skeletonNodes),
                            confidence: 0.7,
                            captured_at: now,
                        });
                    }
                }

                if (changedFiles.length > 10) {
                    const domain = inferDomainFromFiles(changedFiles, skeletonNodes);
                    signals.push({
                        id: `sig_git_${Date.now()}_large_refactor_${index++}`,
                        signal_type: "large_refactor",
                        raw_data: {
                            commits: [commit.hash],
                            files_changed: changedFiles,
                            commit_message: commit.message,
                            domain_evidence: domain.evidence,
                        },
                        inferred_gravity: "G2",
                        inferred_domain: domain.domain,
                        inferred_domain_confidence: domain.confidence,
                        confidence: 0.6,
                        captured_at: now,
                    });
                }
            }

            return { signals };
        } catch {
            return { signals: [] };
        }
    }

    async getProjectAge(): Promise<number> {
        try {
            const log = await this.git.log(["--reverse", "--format=%aI"]);
            if (log.all.length === 0) return 0;
            const firstDate = new Date(log.all[0].date);
            const now = new Date();
            const months = (now.getFullYear() - firstDate.getFullYear()) * 12
                + (now.getMonth() - firstDate.getMonth());
            return Math.max(months, 1);
        } catch {
            return 0;
        }
    }

    async getCommitStats(): Promise<{ count30d: number; projectAvg: number }> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentLog = await this.git.log({ "--after": thirtyDaysAgo.toISOString() });
            const count30d = recentLog.all.length;

            const totalLog = await this.git.log();
            const totalCommits = totalLog.all.length;
            const months = await this.getProjectAge();
            const projectAvg = months > 0 ? totalCommits / months : totalCommits;

            return { count30d, projectAvg };
        } catch {
            return { count30d: 0, projectAvg: 0 };
        }
    }

    async getDependencyChangeRate(sinceDays: number): Promise<number> {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - sinceDays);
            const recentLog = await this.git.log({ "--after": cutoff.toISOString() });
            if (recentLog.all.length === 0) return 0;

            let depTouches = 0;
            for (const commit of recentLog.all) {
                try {
                    const diff = await this.git.diff([`${commit.hash}~1`, commit.hash, "--name-only"]);
                    const files = diff.split("\n").filter(Boolean);
                    if (files.some(f => DEPENDENCY_FILES.some(d => f.endsWith(d)))) {
                        depTouches++;
                    }
                } catch { continue; }
            }
            return depTouches / recentLog.all.length;
        } catch {
            return 0;
        }
    }

    async getNewFileRatio(sinceDays: number): Promise<number> {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - sinceDays);
            const recentLog = await this.git.log({ "--after": cutoff.toISOString() });
            if (recentLog.all.length === 0) return 0;

            let added = 0;
            let total = 0;
            for (const commit of recentLog.all) {
                try {
                    const diff = await this.git.diff([`${commit.hash}~1`, commit.hash, "--name-status"]);
                    for (const line of diff.split("\n").filter(Boolean)) {
                        total++;
                        if (line.startsWith("A\t")) added++;
                    }
                } catch { continue; }
            }
            return total > 0 ? added / total : 0;
        } catch {
            return 0;
        }
    }

    async getContributorCount(sinceDays: number): Promise<number> {
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - sinceDays);
            const recentLog = await this.git.log({ "--after": cutoff.toISOString() });
            const authors = new Set(recentLog.all.map(c => c.author_email));
            return authors.size;
        } catch {
            return 0;
        }
    }

    async getHeadCommit(): Promise<string | null> {
        try {
            const hash = await this.git.revparse(["HEAD"]);
            return hash.trim() || null;
        } catch {
            return null;
        }
    }

    private inferDomain(
        message: string,
        nodes: SkeletonNode[],
    ): string | undefined {
        const lower = message.toLowerCase();
        for (const node of nodes) {
            for (const keyword of node.causal_keywords) {
                if (lower.includes(keyword.toLowerCase())) {
                    return node.domain;
                }
            }
        }
        return undefined;
    }

    private async detectDependencyChanges(
        commitHash: string,
        depFiles: string[],
    ): Promise<{
        removed: string[];
        replaced: Array<{ from: string; to: string }>;
    }> {
        const removed: string[] = [];
        const replaced: Array<{ from: string; to: string }> = [];

        for (const file of depFiles) {
            try {
                const diff = await this.git.diff([`${commitHash}~1`, commitHash, "--", file]);
                const removedLines = diff.split("\n").filter(l => l.startsWith("-") && !l.startsWith("---"));
                const addedLines = diff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++"));

                const removedPkgs = this.extractPackageNames(removedLines);
                const addedPkgs = this.extractPackageNames(addedLines);

                for (const pkg of Array.from(removedPkgs)) {
                    if (!addedPkgs.has(pkg)) {
                        const replacement = this.findLikelyReplacement(pkg, addedPkgs);
                        if (replacement) {
                            replaced.push({ from: pkg, to: replacement });
                        } else {
                            removed.push(pkg);
                        }
                    }
                }
            } catch {
                continue;
            }
        }

        return { removed, replaced };
    }

    private extractPackageNames(lines: string[]): Set<string> {
        const names = new Set<string>();
        for (const line of lines) {
            const match = line.match(/"([^"]+)"\s*:/);
            if (match) {
                names.add(match[1]);
            }
        }
        return names;
    }

    private findLikelyReplacement(removed: string, added: Set<string>): string | undefined {
        for (const pkg of Array.from(added)) {
            if (pkg.includes(removed) || removed.includes(pkg)) {
                return pkg;
            }
        }
        return undefined;
    }
}
