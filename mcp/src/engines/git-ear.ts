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
                    signals.push({
                        id: `sig_git_${Date.now()}_large_refactor_${index++}`,
                        signal_type: "large_refactor",
                        raw_data: {
                            commits: [commit.hash],
                            files_changed: changedFiles,
                        },
                        inferred_gravity: "G2",
                        inferred_domain: this.inferDomainFromFiles(changedFiles, skeletonNodes),
                        confidence: 0.6,
                        captured_at: now,
                    });
                }
            }

            await this.scanCommitFrequencyChange(signals, index, now);
            await this.scanNewContributors(signals, index, now);

            return { signals };
        } catch {
            return { signals: [] };
        }
    }

    private async scanCommitFrequencyChange(
        signals: GitSignal[], index: number, now: string,
    ): Promise<void> {
        try {
            const stats = await this.getCommitStats();
            if (stats.projectAvg === 0) return;
            const monthlyRecent = stats.count30d;
            const monthlyAvg = stats.projectAvg;
            const ratio = monthlyRecent / monthlyAvg;
            if (ratio > 1.5 || ratio < 0.5) {
                signals.push({
                    id: `sig_git_${Date.now()}_commit_frequency_${index}`,
                    signal_type: "commit_frequency_change",
                    raw_data: {
                        stats: { commit_count_30d: stats.count30d, project_avg: stats.projectAvg },
                    },
                    inferred_gravity: "G1",
                    confidence: 0.6,
                    captured_at: now,
                });
            }
        } catch { /* ignore */ }
    }

    private async scanNewContributors(
        signals: GitSignal[], index: number, now: string,
    ): Promise<void> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentLog = await this.git.log({ "--after": thirtyDaysAgo.toISOString() });
            const allLog = await this.git.log();
            const allAuthors = new Set(allLog.all.map(c => c.author_email));
            const recentAuthors = new Set(recentLog.all.map(c => c.author_email));
            for (const author of recentAuthors) {
                const isNew = !allLog.all.some(
                    c => c.author_email === author && new Date(c.date) < thirtyDaysAgo,
                );
                if (isNew) {
                    signals.push({
                        id: `sig_git_${Date.now()}_new_contributor_${index}`,
                        signal_type: "new_contributor",
                        raw_data: {},
                        inferred_gravity: "G0",
                        confidence: 0.9,
                        captured_at: now,
                    });
                    break;
                }
            }
        } catch { /* ignore */ }
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

    private inferDomainFromFiles(
        files: string[],
        nodes: SkeletonNode[],
    ): string | undefined {
        const joined = files.join(" ").toLowerCase();
        for (const node of nodes) {
            for (const keyword of node.causal_keywords) {
                if (joined.includes(keyword.toLowerCase())) {
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
