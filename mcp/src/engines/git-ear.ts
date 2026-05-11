import { simpleGit, type SimpleGit } from "simple-git";
import type { Signal } from "../schemas/index.js";

const DEP_FILES = [
    "package.json",
    "go.mod",
    "requirements.txt",
    "Cargo.toml",
    "build.gradle",
    "Gemfile",
    "composer.json",
    "pyproject.toml",
    "pom.xml",
];

const LARGE_FILE_THRESHOLD = 10;

export class GitEar {
    private git: SimpleGit;

    constructor(private projectRoot: string) {
        this.git = simpleGit(projectRoot);
    }

    async scanSinceLastSession(lastCommit: string | null): Promise<Signal[]> {
        const signals: Signal[] = [];
        const now = new Date().toISOString();

        try {
            const range = lastCommit ? `${lastCommit}..HEAD` : undefined;

            const [reverts, depSignals, fileMovements, freqSignals, contributorSignals] =
                await Promise.all([
                    this.detectReverts(range, now),
                    this.detectDependencyChanges(range, now),
                    this.detectLargeFileMovement(range, now),
                    this.detectCommitFrequency(now),
                    this.detectNewContributor(lastCommit, now),
                ]);

            signals.push(
                ...reverts,
                ...depSignals,
                ...fileMovements,
                ...freqSignals,
                ...contributorSignals,
            );
        } catch {
            // Git analysis failure is non-fatal
        }

        return signals;
    }

    async getHeadCommit(): Promise<string | null> {
        try {
            const log = await this.git.log({ maxCount: 1 });
            return log.latest?.hash ?? null;
        } catch {
            return null;
        }
    }

    private async detectReverts(
        range: string | undefined,
        now: string,
    ): Promise<Signal[]> {
        const signals: Signal[] = [];
        try {
            const logOpts = range
                ? { from: range.split("..")[0], to: "HEAD" }
                : { maxCount: 50 };
            const log = await this.git.log(logOpts);

            for (const commit of log.all) {
                const msg = commit.message.toLowerCase();
                if (msg.startsWith("revert") || msg.includes('revert "')) {
                    signals.push({
                        id: `sig_git_revert_${commit.hash.slice(0, 7)}`,
                        source_ear: "git",
                        signal_type: "revert",
                        raw_data: {
                            commit: commit.hash,
                            message: commit.message,
                            author: commit.author_name,
                            date: commit.date,
                        },
                        inferred: {
                            probable_type: "rejection",
                            confidence: "high",
                        },
                        captured_at: now,
                    });
                }
            }
        } catch {
            // Non-fatal
        }
        return signals;
    }

    private async detectDependencyChanges(
        range: string | undefined,
        now: string,
    ): Promise<Signal[]> {
        const signals: Signal[] = [];
        try {
            for (const depFile of DEP_FILES) {
                const diff = range
                    ? await this.git.diff([range, "--", depFile]).catch(() => "")
                    : await this.git.diff(["HEAD~5..HEAD", "--", depFile]).catch(() => "");

                if (!diff) continue;

                const removed = this.extractRemovedPackages(diff, depFile);
                const added = this.extractAddedPackages(diff, depFile);

                for (const pkg of removed) {
                    const replacement = added.find(
                        (a) => this.sameCategory(a, pkg),
                    );
                    if (replacement) {
                        signals.push({
                            id: `sig_git_dep_replaced_${pkg.slice(0, 20)}`,
                            source_ear: "git",
                            signal_type: "dependency-replaced",
                            raw_data: {
                                removed: pkg,
                                added: replacement,
                                file: depFile,
                                subject: pkg,
                            },
                            inferred: {
                                probable_type: "transition",
                                confidence: "high",
                            },
                            captured_at: now,
                        });
                    } else {
                        signals.push({
                            id: `sig_git_dep_removed_${pkg.slice(0, 20)}`,
                            source_ear: "git",
                            signal_type: "dependency-removed",
                            raw_data: {
                                package: pkg,
                                file: depFile,
                                subject: pkg,
                            },
                            inferred: {
                                probable_type: "rejection",
                                confidence: "medium",
                            },
                            captured_at: now,
                        });
                    }
                }
            }
        } catch {
            // Non-fatal
        }
        return signals;
    }

    private async detectLargeFileMovement(
        range: string | undefined,
        now: string,
    ): Promise<Signal[]> {
        const signals: Signal[] = [];
        try {
            const diffArgs = range
                ? [range, "--stat"]
                : ["HEAD~5..HEAD", "--stat"];
            const stat = await this.git.diff(diffArgs).catch(() => "");
            if (!stat) return signals;

            const lines = stat.split("\n");
            let deletions = 0;
            let additions = 0;
            for (const line of lines) {
                const match = line.match(/(\d+)\s+insertion.*?(\d+)\s+deletion/);
                if (match) {
                    additions += parseInt(match[1], 10);
                    deletions += parseInt(match[2], 10);
                }
            }

            const fileCount = lines.filter((l) => l.includes("|")).length;
            if (fileCount > LARGE_FILE_THRESHOLD) {
                signals.push({
                    id: `sig_git_large_movement_${now.slice(0, 10)}`,
                    source_ear: "git",
                    signal_type: "large-refactor",
                    raw_data: {
                        files_changed: fileCount,
                        insertions: additions,
                        deletions,
                    },
                    inferred: {
                        probable_type: "transition",
                        confidence: "medium",
                    },
                    captured_at: now,
                });
            }
        } catch {
            // Non-fatal
        }
        return signals;
    }

    private async detectCommitFrequency(now: string): Promise<Signal[]> {
        const signals: Signal[] = [];
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentLog = await this.git.log({
                "--after": thirtyDaysAgo.toISOString(),
            });
            const recentCount = recentLog.total;

            const allLog = await this.git.log({ maxCount: 500 });
            const totalCommits = allLog.total;

            if (totalCommits === 0) return signals;

            // Estimate project age from first commit
            const firstCommitDate = allLog.all[allLog.all.length - 1]?.date;
            if (!firstCommitDate) return signals;

            const projectAgeMonths = Math.max(
                1,
                (Date.now() - new Date(firstCommitDate).getTime()) /
                    (30 * 24 * 60 * 60 * 1000),
            );
            const avgMonthly = totalCommits / projectAgeMonths;
            const trend = avgMonthly > 0 ? recentCount / avgMonthly : 1;

            signals.push({
                id: `sig_git_frequency_${now.slice(0, 10)}`,
                source_ear: "git",
                signal_type: "stage-signal",
                raw_data: {
                    recent_30d_commits: recentCount,
                    avg_monthly: Math.round(avgMonthly),
                    trend: Math.round(trend * 100) / 100,
                    project_age_months: Math.round(projectAgeMonths),
                },
                inferred: {
                    confidence: "medium",
                },
                captured_at: now,
            });
        } catch {
            // Non-fatal
        }
        return signals;
    }

    private async detectNewContributor(
        lastCommit: string | null,
        now: string,
    ): Promise<Signal[]> {
        const signals: Signal[] = [];
        try {
            if (!lastCommit) return signals;

            const oldLog = await this.git.log({
                to: lastCommit,
                maxCount: 200,
            });
            const oldAuthors = new Set(
                oldLog.all.map((c) => c.author_email),
            );

            const newLog = await this.git.log({
                from: lastCommit,
                to: "HEAD",
            });
            for (const commit of newLog.all) {
                if (!oldAuthors.has(commit.author_email)) {
                    oldAuthors.add(commit.author_email);
                    signals.push({
                        id: `sig_git_new_contributor_${commit.author_email.slice(0, 15)}`,
                        source_ear: "git",
                        signal_type: "stage-signal",
                        raw_data: {
                            author: commit.author_name,
                            email: commit.author_email,
                        },
                        inferred: {
                            confidence: "low",
                        },
                        captured_at: now,
                    });
                }
            }
        } catch {
            // Non-fatal
        }
        return signals;
    }

    private extractRemovedPackages(diff: string, file: string): string[] {
        const removed: string[] = [];
        for (const line of diff.split("\n")) {
            if (!line.startsWith("-") || line.startsWith("---")) continue;
            const pkg = this.extractPackageName(line, file);
            if (pkg) removed.push(pkg);
        }
        return removed;
    }

    private extractAddedPackages(diff: string, file: string): string[] {
        const added: string[] = [];
        for (const line of diff.split("\n")) {
            if (!line.startsWith("+") || line.startsWith("+++")) continue;
            const pkg = this.extractPackageName(line, file);
            if (pkg) added.push(pkg);
        }
        return added;
    }

    private extractPackageName(
        line: string,
        file: string,
    ): string | null {
        const cleaned = line.slice(1).trim();
        if (file === "package.json") {
            const m = cleaned.match(/"([^"]+)"\s*:/);
            return m?.[1] ?? null;
        }
        if (file === "requirements.txt" || file === "pyproject.toml") {
            const m = cleaned.match(/^([a-zA-Z0-9_-]+)/);
            return m?.[1] ?? null;
        }
        if (file === "go.mod") {
            const m = cleaned.match(/^\s*([^\s]+)/);
            return m?.[1] ?? null;
        }
        if (file === "Cargo.toml") {
            const m = cleaned.match(/^([a-zA-Z0-9_-]+)\s*=/);
            return m?.[1] ?? null;
        }
        return null;
    }

    private sameCategory(a: string, b: string): boolean {
        // Simple heuristic: same prefix or known replacements
        return false;
    }
}
