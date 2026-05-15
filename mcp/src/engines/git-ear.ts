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

const DOMAIN_KEYWORDS: Record<string, string[]> = {
    frontend: ["ui", "component", "page", "layout", "css", "style", "sidebar", "navigation", "responsive", "render", "dom", "html", "template"],
    backend: ["api", "endpoint", "route", "handler", "middleware", "controller", "server", "request", "response"],
    database: ["migration", "schema", "model", "query", "table", "index", "orm", "sql", "seed", "column"],
    worker: ["worker", "scheduler", "pipeline", "queue", "job", "cron", "task", "batch"],
    testing: ["test", "spec", "coverage", "mock", "fixture", "e2e", "unit", "assert"],
    deployment: ["deploy", "ci", "cd", "docker", "k8s", "workflow", "infra", "terraform", "helm"],
    performance: ["perf", "optimize", "cache", "latency", "benchmark", "throttle", "debounce"],
    auth: ["auth", "login", "signup", "session", "token", "permission", "role", "oauth", "jwt"],
};

const FILE_PATH_DOMAIN_PATTERNS: Array<{ pattern: RegExp; domain: string }> = [
    { pattern: /\/(frontend|web|client|apps\/web|app\/web)\//i, domain: "frontend" },
    { pattern: /\/(backend|api|server|apps\/api|app\/api)\//i, domain: "backend" },
    { pattern: /\/(worker|workers|jobs|apps\/worker)\//i, domain: "worker" },
    { pattern: /\/(test|tests|__tests__|spec|specs)\//i, domain: "testing" },
    { pattern: /\/(infra|deploy|terraform|\.github|\.circleci)\//i, domain: "deployment" },
    { pattern: /\/(db|database|migrations|models|prisma|drizzle)\//i, domain: "database" },
    { pattern: /\/(auth|authentication|authorization)\//i, domain: "auth" },
    { pattern: /\.(test|spec)\.(ts|tsx|js|jsx|py)$/i, domain: "testing" },
    { pattern: /dockerfile|docker-compose/i, domain: "deployment" },
    { pattern: /\.github\/workflows/i, domain: "deployment" },
];

const TRANSITION_PATTERNS = [
    /(?:migrate|switch|move|transition)\s+(?:from\s+)?(\S+)\s+to\s+(\S+)/i,
    /replace\s+(\S+)\s+with\s+(\S+)/i,
];

export class GitEar {
    private git: SimpleGit;
    private firstCommitHash: string | null | undefined = undefined;

    constructor(private projectRoot: string) {
        this.git = simpleGit(projectRoot);
    }

    async scanSinceLastSession(lastCommit: string | null): Promise<Signal[]> {
        const signals: Signal[] = [];
        const now = new Date().toISOString();

        try {
            let range: string | undefined;
            if (lastCommit) {
                range = `${lastCommit}..HEAD`;
            } else {
                const first = await this.getFirstCommit();
                if (first) {
                    range = `${first}..HEAD`;
                }
            }

            const [reverts, depSignals, fileMovements, freqSignals, contributorSignals, commitPatterns] =
                await Promise.all([
                    this.detectReverts(range, now),
                    this.detectDependencyChanges(range, now),
                    this.detectLargeFileMovement(range, now),
                    this.detectCommitFrequency(now),
                    this.detectNewContributor(lastCommit, now),
                    this.detectCommitPatterns(range, now),
                ]);

            signals.push(
                ...reverts,
                ...depSignals,
                ...fileMovements,
                ...freqSignals,
                ...contributorSignals,
                ...commitPatterns,
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

    private async getFirstCommit(): Promise<string | null> {
        if (this.firstCommitHash !== undefined) return this.firstCommitHash;
        try {
            const raw = await this.git.raw(["rev-list", "--max-parents=0", "HEAD"]);
            this.firstCommitHash = raw.trim().split("\n")[0] ?? null;
        } catch {
            this.firstCommitHash = null;
        }
        return this.firstCommitHash;
    }

    private async detectReverts(
        range: string | undefined,
        now: string,
    ): Promise<Signal[]> {
        const signals: Signal[] = [];
        try {
            const logOpts = range
                ? { from: range.split("..")[0], to: "HEAD" }
                : { maxCount: 200 };
            const log = await this.git.log(logOpts);

            for (const commit of log.all) {
                const msg = commit.message.toLowerCase();
                if (msg.startsWith("revert") || msg.includes('revert "')) {
                    const strippedMessage = commit.message
                        .replace(/^Revert\s+"?/i, "")
                        .replace(/"?\s*$/, "");
                    signals.push({
                        id: `sig_git_revert_${commit.hash.slice(0, 7)}`,
                        source_ear: "git",
                        signal_type: "revert",
                        raw_data: {
                            commit: commit.hash,
                            message: commit.message,
                            author: commit.author_name,
                            date: commit.date,
                            what: `Reverted: ${strippedMessage.slice(0, 100)}`,
                            reason: `Git revert by ${commit.author_name}`,
                            subject: strippedMessage.slice(0, 50),
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
        if (!range) return signals;
        const seen = new Set<string>();

        try {
            for (const depFile of DEP_FILES) {
                const rawHashes = await this.git.raw(
                    ["log", "--pretty=format:%H", "--diff-filter=M", range, "--", depFile],
                ).catch(() => "");
                const hashes = rawHashes.trim().split("\n").filter(Boolean).slice(0, 20);

                for (const hash of hashes) {
                    const diff = await this.git.diff([`${hash}~1..${hash}`, "--", depFile]).catch(() => "");
                    if (!diff) continue;

                    const removed = this.extractRemovedPackages(diff, depFile);
                    const added = this.extractAddedPackages(diff, depFile);
                    const domain = this.inferDomainFromDepFile(depFile);

                    for (const pkg of removed) {
                        if (seen.has(`${depFile}:${pkg}`)) continue;
                        seen.add(`${depFile}:${pkg}`);

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
                                    what: `Replaced ${pkg} with ${replacement}`,
                                    reason: `Dependency transition in ${depFile}`,
                                },
                                inferred: {
                                    probable_type: "transition",
                                    probable_domain: domain,
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
                                    what: `Removed dependency: ${pkg}`,
                                    reason: `Dependency ${pkg} was removed from ${depFile}`,
                                },
                                inferred: {
                                    probable_type: "rejection",
                                    probable_domain: domain,
                                    confidence: "medium",
                                },
                                captured_at: now,
                            });
                        }
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
            if (!range) return signals;

            const stat = await this.git.diff([range, "--stat"]).catch(() => "");
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
                let domain: string | undefined;
                try {
                    const nameOnly = await this.git.diff([range, "--name-only"]);
                    const filePaths = nameOnly.split("\n").filter(Boolean);
                    domain = this.inferDomainFromFiles(filePaths);
                } catch { /* non-fatal */ }

                signals.push({
                    id: `sig_git_large_movement_${now.slice(0, 10)}`,
                    source_ear: "git",
                    signal_type: "large-refactor",
                    raw_data: {
                        files_changed: fileCount,
                        insertions: additions,
                        deletions,
                        what: `Large restructuring (${fileCount} files, +${additions}/-${deletions})`,
                        reason: `Detected ${fileCount} file changes suggesting architectural refactor`,
                        subject: `refactor-${now.slice(0, 10)}`,
                    },
                    inferred: {
                        probable_type: "transition",
                        probable_domain: domain,
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

    private async detectCommitPatterns(
        range: string | undefined,
        now: string,
    ): Promise<Signal[]> {
        const signals: Signal[] = [];
        try {
            const logOpts = range
                ? { from: range.split("..")[0], to: "HEAD" }
                : { maxCount: 500 };
            const log = await this.git.log(logOpts);
            if (log.total === 0) return signals;

            const domainHits: Record<string, number> = {};
            const scopeHits: Record<string, number> = {};
            const totalCommits = log.all.length;

            for (const commit of log.all) {
                const subject = commit.message.split("\n")[0];

                const conventional = subject.match(
                    /^(feat|fix|refactor|chore|docs|test|perf|ci|build|style)\(?([^)]*)\)?[!:]?\s*:?\s*/i,
                );
                if (conventional) {
                    const scope = conventional[2]?.trim();
                    if (scope) {
                        scopeHits[scope] = (scopeHits[scope] ?? 0) + 1;
                    }
                }

                const lowerSubject = subject.toLowerCase();
                for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
                    for (const kw of keywords) {
                        if (lowerSubject.includes(kw)) {
                            domainHits[domain] = (domainHits[domain] ?? 0) + 1;
                            break;
                        }
                    }
                }

                for (const pattern of TRANSITION_PATTERNS) {
                    const m = subject.match(pattern);
                    if (m) {
                        const from = m[1];
                        const to = m[2];
                        signals.push({
                            id: `sig_git_transition_${from.slice(0, 15)}_${to.slice(0, 15)}`.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                            source_ear: "git",
                            signal_type: "decision",
                            raw_data: {
                                what: `Transitioned from ${from} to ${to}`,
                                reason: `Detected transition in commit: ${subject.slice(0, 100)}`,
                                subject: `${from} → ${to}`,
                                commit: commit.hash,
                            },
                            inferred: {
                                probable_type: "transition",
                                confidence: "medium",
                            },
                            captured_at: now,
                        });
                    }
                }
            }

            const minHits = Math.max(3, Math.round(totalCommits * 0.05));
            for (const [domain, count] of Object.entries(domainHits)) {
                if (count >= minHits) {
                    signals.push({
                        id: `sig_git_domain_${domain}`,
                        source_ear: "git",
                        signal_type: "stage-signal",
                        raw_data: {
                            domain,
                            commit_count: count,
                            total_commits: totalCommits,
                            percentage: Math.round((count / totalCommits) * 100),
                        },
                        inferred: {
                            probable_domain: domain,
                            confidence: "medium",
                        },
                        captured_at: now,
                    });
                }
            }

            for (const [scope, count] of Object.entries(scopeHits)) {
                if (count >= minHits) {
                    signals.push({
                        id: `sig_git_scope_${scope.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
                        source_ear: "git",
                        signal_type: "stage-signal",
                        raw_data: {
                            scope,
                            commit_count: count,
                            total_commits: totalCommits,
                            percentage: Math.round((count / totalCommits) * 100),
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

    private classifyFilePath(path: string): string | undefined {
        for (const { pattern, domain } of FILE_PATH_DOMAIN_PATTERNS) {
            if (pattern.test(path)) return domain;
        }
        return undefined;
    }

    private inferDomainFromFiles(filePaths: string[]): string | undefined {
        const counts: Record<string, number> = {};
        for (const fp of filePaths) {
            const domain = this.classifyFilePath(fp);
            if (domain) counts[domain] = (counts[domain] ?? 0) + 1;
        }
        let best: string | undefined;
        let bestCount = 0;
        for (const [domain, count] of Object.entries(counts)) {
            if (count > bestCount) {
                best = domain;
                bestCount = count;
            }
        }
        return best;
    }

    private inferDomainFromDepFile(depFile: string): string | undefined {
        if (/apps\/web|frontend|client/.test(depFile)) return "frontend";
        if (/apps\/api|backend|server/.test(depFile)) return "backend";
        if (/apps\/worker|worker/.test(depFile)) return "worker";
        return undefined;
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

    private static readonly PKG_JSON_SKIP = new Set([
        "name", "version", "description", "main", "module", "types", "scripts",
        "private", "dependencies", "devDependencies", "peerDependencies",
        "optionalDependencies", "engines", "files", "bin", "repository",
        "author", "license", "keywords", "homepage", "bugs", "workspaces",
        "packageManager", "type", "exports", "imports", "publishConfig",
        "sideEffects", "browserslist", "resolutions", "overrides",
    ]);

    private extractPackageName(
        line: string,
        file: string,
    ): string | null {
        const cleaned = line.slice(1).trim();
        if (file === "package.json") {
            const m = cleaned.match(/"([^"]+)"\s*:/);
            if (!m) return null;
            if (GitEar.PKG_JSON_SKIP.has(m[1])) return null;
            return m[1];
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
