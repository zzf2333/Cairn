import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { parse as yamlParse } from "yaml";
import { stringify as yamlStringify } from "yaml";
import { simpleGit } from "simple-git";
import { buildPaths, type CairnPaths } from "./paths.js";
import { createCairnContextFromPaths } from "./context.js";
import { DEFAULT_L3_AUTO_WRITE, type Config } from "./schemas/config.js";


export interface BootstrapResult {
    created: boolean;
    paths: CairnPaths;
    projectMeta: {
        name: string;
        created: string;
        detected_from: string;
    };
    gitSummary: {
        total_commits: number;
        first_commit_date: string | null;
        recent_commits: Array<{
            hash: string;
            message: string;
            date: string;
            author: string;
        }>;
        auto_signals_routed: number;
    } | null;
}

function detectProjectName(root: string): { name: string; from: string } {
    try {
        const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
        if (pkg.name && typeof pkg.name === "string") {
            return { name: pkg.name, from: "package.json" };
        }
    } catch { /* not a node project */ }

    try {
        const cargo = readFileSync(join(root, "Cargo.toml"), "utf-8");
        const match = cargo.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) return { name: match[1], from: "Cargo.toml" };
    } catch { /* not a rust project */ }

    try {
        const gomod = readFileSync(join(root, "go.mod"), "utf-8");
        const match = gomod.match(/^module\s+(\S+)/m);
        if (match) {
            const parts = match[1].split("/");
            return { name: parts[parts.length - 1], from: "go.mod" };
        }
    } catch { /* not a go project */ }

    try {
        const pyproject = readFileSync(join(root, "pyproject.toml"), "utf-8");
        const match = pyproject.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) return { name: match[1], from: "pyproject.toml" };
    } catch { /* not a python project */ }

    return { name: basename(root), from: "directory" };
}

async function detectCreatedDate(root: string): Promise<string> {
    try {
        const git = simpleGit(root);
        const log = await git.log(["--reverse", "--max-count=1", "--format=%aI"]);
        if (log.latest?.date) {
            return log.latest.date.slice(0, 7);
        }
    } catch { /* no git */ }
    return new Date().toISOString().slice(0, 7);
}

interface TechDetection {
    domain: string;
    name: string;
    summary: string;
}

const NODE_TECH_MAP: Record<string, TechDetection> = {
    react: { domain: "frontend", name: "React", summary: "UI framework: React" },
    "react-dom": { domain: "frontend", name: "React", summary: "UI framework: React" },
    vue: { domain: "frontend", name: "Vue", summary: "UI framework: Vue" },
    svelte: { domain: "frontend", name: "Svelte", summary: "UI framework: Svelte" },
    angular: { domain: "frontend", name: "Angular", summary: "UI framework: Angular" },
    "@angular/core": { domain: "frontend", name: "Angular", summary: "UI framework: Angular" },
    next: { domain: "frontend", name: "Next.js", summary: "Meta-framework: Next.js" },
    nuxt: { domain: "frontend", name: "Nuxt", summary: "Meta-framework: Nuxt" },
    express: { domain: "backend", name: "Express", summary: "HTTP framework: Express" },
    fastify: { domain: "backend", name: "Fastify", summary: "HTTP framework: Fastify" },
    koa: { domain: "backend", name: "Koa", summary: "HTTP framework: Koa" },
    nestjs: { domain: "backend", name: "NestJS", summary: "Backend framework: NestJS" },
    "@nestjs/core": { domain: "backend", name: "NestJS", summary: "Backend framework: NestJS" },
    hono: { domain: "backend", name: "Hono", summary: "HTTP framework: Hono" },
    vitest: { domain: "testing", name: "Vitest", summary: "Test runner: Vitest" },
    jest: { domain: "testing", name: "Jest", summary: "Test runner: Jest" },
    mocha: { domain: "testing", name: "Mocha", summary: "Test runner: Mocha" },
    playwright: { domain: "testing", name: "Playwright", summary: "E2E testing: Playwright" },
    "@playwright/test": { domain: "testing", name: "Playwright", summary: "E2E testing: Playwright" },
    cypress: { domain: "testing", name: "Cypress", summary: "E2E testing: Cypress" },
    vite: { domain: "build", name: "Vite", summary: "Build tool: Vite" },
    webpack: { domain: "build", name: "Webpack", summary: "Build tool: Webpack" },
    esbuild: { domain: "build", name: "esbuild", summary: "Build tool: esbuild" },
    tailwindcss: { domain: "frontend", name: "Tailwind CSS", summary: "Styling: Tailwind CSS" },
    prisma: { domain: "database", name: "Prisma", summary: "ORM: Prisma" },
    "@prisma/client": { domain: "database", name: "Prisma", summary: "ORM: Prisma" },
    drizzle: { domain: "database", name: "Drizzle", summary: "ORM: Drizzle" },
    "drizzle-orm": { domain: "database", name: "Drizzle", summary: "ORM: Drizzle" },
    mongoose: { domain: "database", name: "Mongoose", summary: "MongoDB ODM: Mongoose" },
    sequelize: { domain: "database", name: "Sequelize", summary: "ORM: Sequelize" },
    typeorm: { domain: "database", name: "TypeORM", summary: "ORM: TypeORM" },
    "@tanstack/react-query": { domain: "frontend", name: "React Query", summary: "Data fetching: React Query" },
    "react-query": { domain: "frontend", name: "React Query", summary: "Data fetching: React Query" },
    zustand: { domain: "state-management", name: "Zustand", summary: "State management: Zustand" },
    redux: { domain: "state-management", name: "Redux", summary: "State management: Redux" },
    "@reduxjs/toolkit": { domain: "state-management", name: "Redux Toolkit", summary: "State management: Redux Toolkit" },
    turbo: { domain: "build", name: "Turborepo", summary: "Build tool: Turborepo" },
    "@xyflow/react": { domain: "frontend", name: "React Flow", summary: "Diagramming: React Flow" },
    reactflow: { domain: "frontend", name: "React Flow", summary: "Diagramming: React Flow" },
    "socket.io": { domain: "backend", name: "Socket.IO", summary: "Real-time: Socket.IO" },
    "socket.io-client": { domain: "frontend", name: "Socket.IO Client", summary: "Real-time: Socket.IO Client" },
    jotai: { domain: "state-management", name: "Jotai", summary: "State management: Jotai" },
    recoil: { domain: "state-management", name: "Recoil", summary: "State management: Recoil" },
    mobx: { domain: "state-management", name: "MobX", summary: "State management: MobX" },
    "next-auth": { domain: "auth", name: "NextAuth", summary: "Auth: NextAuth" },
    "better-auth": { domain: "auth", name: "BetterAuth", summary: "Auth: BetterAuth" },
};

function discoverWorkspaceDirs(root: string): string[] {
    const dirs: string[] = [];
    const MAX_WORKSPACE_DIRS = 20;

    function expandGlob(base: string, pattern: string): string[] {
        const result: string[] = [];
        const cleaned = pattern.replace(/\/\*\*$/, "/*").replace(/\/$/, "");
        const parts = cleaned.split("/");
        let current = base;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === "*") {
                try {
                    const entries = readdirSync(current, { withFileTypes: true });
                    for (const e of entries) {
                        if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
                            const full = join(current, e.name);
                            if (i === parts.length - 1) {
                                result.push(full);
                            }
                        }
                    }
                } catch { /* ignore */ }
                return result;
            }
            current = join(current, part);
        }
        if (existsSync(current)) result.push(current);
        return result;
    }

    // pnpm-workspace.yaml
    try {
        const wsFile = join(root, "pnpm-workspace.yaml");
        if (existsSync(wsFile)) {
            const content = readFileSync(wsFile, "utf-8");
            const parsed = yamlParse(content) as { packages?: string[] };
            if (Array.isArray(parsed?.packages)) {
                for (const pattern of parsed.packages) {
                    if (typeof pattern === "string" && !pattern.startsWith("!")) {
                        dirs.push(...expandGlob(root, pattern));
                    }
                }
            }
        }
    } catch { /* ignore */ }

    // package.json workspaces (npm/yarn)
    if (dirs.length === 0) {
        try {
            const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
            const workspaces = Array.isArray(pkg.workspaces)
                ? pkg.workspaces
                : Array.isArray(pkg.workspaces?.packages) ? pkg.workspaces.packages : [];
            for (const pattern of workspaces) {
                if (typeof pattern === "string" && !pattern.startsWith("!")) {
                    dirs.push(...expandGlob(root, pattern));
                }
            }
        } catch { /* ignore */ }
    }

    // Python uv workspace (pyproject.toml)
    if (dirs.length === 0) {
        try {
            const pyproject = readFileSync(join(root, "pyproject.toml"), "utf-8");
            const memberMatch = pyproject.match(/\[tool\.uv\.workspace\][\s\S]*?members\s*=\s*\[([^\]]*)\]/);
            if (memberMatch) {
                const members = memberMatch[1].match(/"([^"]+)"/g);
                if (members) {
                    for (const m of members) {
                        const pattern = m.replace(/"/g, "");
                        dirs.push(...expandGlob(root, pattern));
                    }
                }
            }
        } catch { /* ignore */ }
    }

    return dirs.slice(0, MAX_WORKSPACE_DIRS);
}

function detectTechStack(root: string): TechDetection[] {
    const entries: TechDetection[] = [];
    const seen = new Set<string>();

    function addEntry(det: TechDetection): void {
        if (seen.has(det.name)) return;
        seen.add(det.name);
        entries.push(det);
    }

    // Node.js / package.json
    try {
        const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const dep of Object.keys(allDeps)) {
            const tech = NODE_TECH_MAP[dep];
            if (tech) addEntry(tech);
        }
    } catch { /* not a node project */ }

    // TypeScript
    if (existsSync(join(root, "tsconfig.json"))) {
        addEntry({ domain: "language", name: "TypeScript", summary: "Language: TypeScript" });
    }

    // Rust / Cargo.toml
    try {
        const cargo = readFileSync(join(root, "Cargo.toml"), "utf-8");
        addEntry({ domain: "language", name: "Rust", summary: "Language: Rust" });
        if (cargo.includes("actix")) addEntry({ domain: "backend", name: "Actix", summary: "Web framework: Actix" });
        if (cargo.includes("axum")) addEntry({ domain: "backend", name: "Axum", summary: "Web framework: Axum" });
        if (cargo.includes("tokio")) addEntry({ domain: "runtime", name: "Tokio", summary: "Async runtime: Tokio" });
    } catch { /* not a rust project */ }

    // Go / go.mod
    try {
        const gomod = readFileSync(join(root, "go.mod"), "utf-8");
        addEntry({ domain: "language", name: "Go", summary: "Language: Go" });
        if (gomod.includes("gin-gonic")) addEntry({ domain: "backend", name: "Gin", summary: "Web framework: Gin" });
        if (gomod.includes("echo")) addEntry({ domain: "backend", name: "Echo", summary: "Web framework: Echo" });
        if (gomod.includes("fiber")) addEntry({ domain: "backend", name: "Fiber", summary: "Web framework: Fiber" });
    } catch { /* not a go project */ }

    // Python / pyproject.toml or requirements.txt
    try {
        const py = existsSync(join(root, "pyproject.toml"))
            ? readFileSync(join(root, "pyproject.toml"), "utf-8")
            : readFileSync(join(root, "requirements.txt"), "utf-8");
        addEntry({ domain: "language", name: "Python", summary: "Language: Python" });
        if (py.includes("django")) addEntry({ domain: "backend", name: "Django", summary: "Web framework: Django" });
        if (py.includes("fastapi")) addEntry({ domain: "backend", name: "FastAPI", summary: "Web framework: FastAPI" });
        if (py.includes("flask")) addEntry({ domain: "backend", name: "Flask", summary: "Web framework: Flask" });
        if (py.includes("pytest")) addEntry({ domain: "testing", name: "pytest", summary: "Test runner: pytest" });
        if (py.includes("torch") || py.includes("pytorch")) addEntry({ domain: "ml", name: "PyTorch", summary: "ML framework: PyTorch" });
        if (py.includes("tensorflow")) addEntry({ domain: "ml", name: "TensorFlow", summary: "ML framework: TensorFlow" });
        if (py.includes("sqlalchemy")) addEntry({ domain: "database", name: "SQLAlchemy", summary: "ORM: SQLAlchemy" });
        if (py.includes("alembic")) addEntry({ domain: "database", name: "Alembic", summary: "Database migrations: Alembic" });
        if (py.includes("asyncpg") || py.includes("psycopg")) addEntry({ domain: "database", name: "PostgreSQL", summary: "Database: PostgreSQL" });
        if (/\bredis\b/.test(py) || py.includes("aioredis")) addEntry({ domain: "caching", name: "Redis", summary: "Cache/queue: Redis" });
        if (py.includes("celery")) addEntry({ domain: "async", name: "Celery", summary: "Task queue: Celery" });
        if (py.includes("apscheduler")) addEntry({ domain: "async", name: "APScheduler", summary: "Scheduler: APScheduler" });
        if (py.includes("uvicorn")) addEntry({ domain: "backend", name: "Uvicorn", summary: "ASGI server: Uvicorn" });
        if (py.includes("pydantic")) addEntry({ domain: "backend", name: "Pydantic", summary: "Validation: Pydantic" });
        if (py.includes("httpx")) addEntry({ domain: "backend", name: "HTTPX", summary: "HTTP client: HTTPX" });
    } catch { /* not a python project */ }

    // Docker
    if (existsSync(join(root, "Dockerfile")) || existsSync(join(root, "docker-compose.yml")) || existsSync(join(root, "docker-compose.yaml"))) {
        addEntry({ domain: "infra", name: "Docker", summary: "Containerization: Docker" });
    }

    // CI/CD
    if (existsSync(join(root, ".github", "workflows"))) {
        try {
            const workflows = readdirSync(join(root, ".github", "workflows")).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
            if (workflows.length > 0) {
                addEntry({ domain: "infra", name: "GitHub Actions", summary: `CI/CD: GitHub Actions (${workflows.length} workflow${workflows.length > 1 ? "s" : ""})` });
            }
        } catch { /* ignore */ }
    }

    // Monorepo detection
    if (existsSync(join(root, "pnpm-workspace.yaml"))) {
        addEntry({ domain: "infra", name: "pnpm workspaces", summary: "Monorepo: pnpm workspaces" });
    } else if (existsSync(join(root, "lerna.json"))) {
        addEntry({ domain: "infra", name: "Lerna", summary: "Monorepo: Lerna" });
    } else if (existsSync(join(root, "nx.json"))) {
        addEntry({ domain: "infra", name: "Nx", summary: "Monorepo: Nx" });
    }

    // Scan workspace packages for additional tech
    const workspaceDirs = discoverWorkspaceDirs(root);
    for (const wsDir of workspaceDirs) {
        // Node.js / package.json in workspace
        try {
            const pkg = JSON.parse(readFileSync(join(wsDir, "package.json"), "utf-8"));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            for (const dep of Object.keys(allDeps)) {
                const tech = NODE_TECH_MAP[dep];
                if (tech) addEntry(tech);
            }
        } catch { /* not a node package */ }

        // TypeScript in workspace
        if (existsSync(join(wsDir, "tsconfig.json"))) {
            addEntry({ domain: "language", name: "TypeScript", summary: "Language: TypeScript" });
        }

        // Python in workspace
        try {
            const py = existsSync(join(wsDir, "pyproject.toml"))
                ? readFileSync(join(wsDir, "pyproject.toml"), "utf-8")
                : existsSync(join(wsDir, "requirements.txt"))
                    ? readFileSync(join(wsDir, "requirements.txt"), "utf-8")
                    : null;
            if (py) {
                addEntry({ domain: "language", name: "Python", summary: "Language: Python" });
                if (py.includes("django")) addEntry({ domain: "backend", name: "Django", summary: "Web framework: Django" });
                if (py.includes("fastapi")) addEntry({ domain: "backend", name: "FastAPI", summary: "Web framework: FastAPI" });
                if (py.includes("flask")) addEntry({ domain: "backend", name: "Flask", summary: "Web framework: Flask" });
                if (py.includes("pytest")) addEntry({ domain: "testing", name: "pytest", summary: "Test runner: pytest" });
                if (py.includes("torch") || py.includes("pytorch")) addEntry({ domain: "ml", name: "PyTorch", summary: "ML framework: PyTorch" });
                if (py.includes("tensorflow")) addEntry({ domain: "ml", name: "TensorFlow", summary: "ML framework: TensorFlow" });
                if (py.includes("sqlalchemy")) addEntry({ domain: "database", name: "SQLAlchemy", summary: "ORM: SQLAlchemy" });
                if (py.includes("alembic")) addEntry({ domain: "database", name: "Alembic", summary: "Database migrations: Alembic" });
                if (py.includes("asyncpg") || py.includes("psycopg")) addEntry({ domain: "database", name: "PostgreSQL", summary: "Database: PostgreSQL" });
                if (/\bredis\b/.test(py) || py.includes("aioredis")) addEntry({ domain: "caching", name: "Redis", summary: "Cache/queue: Redis" });
                if (py.includes("celery")) addEntry({ domain: "async", name: "Celery", summary: "Task queue: Celery" });
                if (py.includes("apscheduler")) addEntry({ domain: "async", name: "APScheduler", summary: "Scheduler: APScheduler" });
                if (py.includes("uvicorn")) addEntry({ domain: "backend", name: "Uvicorn", summary: "ASGI server: Uvicorn" });
                if (py.includes("pydantic")) addEntry({ domain: "backend", name: "Pydantic", summary: "Validation: Pydantic" });
                if (py.includes("httpx")) addEntry({ domain: "backend", name: "HTTPX", summary: "HTTP client: HTTPX" });
            }
        } catch { /* not a python package */ }

        // Rust in workspace
        try {
            const cargo = readFileSync(join(wsDir, "Cargo.toml"), "utf-8");
            addEntry({ domain: "language", name: "Rust", summary: "Language: Rust" });
            if (cargo.includes("actix")) addEntry({ domain: "backend", name: "Actix", summary: "Web framework: Actix" });
            if (cargo.includes("axum")) addEntry({ domain: "backend", name: "Axum", summary: "Web framework: Axum" });
            if (cargo.includes("tokio")) addEntry({ domain: "runtime", name: "Tokio", summary: "Async runtime: Tokio" });
        } catch { /* not a rust package */ }

        // Go in workspace
        try {
            const gomod = readFileSync(join(wsDir, "go.mod"), "utf-8");
            addEntry({ domain: "language", name: "Go", summary: "Language: Go" });
            if (gomod.includes("gin-gonic")) addEntry({ domain: "backend", name: "Gin", summary: "Web framework: Gin" });
            if (gomod.includes("echo")) addEntry({ domain: "backend", name: "Echo", summary: "Web framework: Echo" });
            if (gomod.includes("fiber")) addEntry({ domain: "backend", name: "Fiber", summary: "Web framework: Fiber" });
        } catch { /* not a go package */ }
    }

    return entries;
}

async function collectGitSummary(root: string): Promise<BootstrapResult["gitSummary"]> {
    try {
        const git = simpleGit(root);
        await git.status();

        const log = await git.log({ maxCount: 50 });
        const allLog = await git.log({ maxCount: 1 });

        let totalCommits = 0;
        try {
            const raw = await git.raw(["rev-list", "--count", "HEAD"]);
            totalCommits = parseInt(raw.trim(), 10) || 0;
        } catch {
            totalCommits = allLog.total;
        }

        let firstCommitDate: string | null = null;
        try {
            const firstLog = await git.log(["--reverse", "--max-count=1"]);
            firstCommitDate = firstLog.latest?.date ?? null;
        } catch { /* ignore */ }

        const recentCommits = log.all.map((c) => ({
            hash: c.hash.slice(0, 7),
            message: c.message.slice(0, 120),
            date: c.date,
            author: c.author_name,
        }));

        return {
            total_commits: totalCommits,
            first_commit_date: firstCommitDate,
            recent_commits: recentCommits,
            auto_signals_routed: 0,
        };
    } catch {
        return null;
    }
}

export async function bootstrapCairnDir(startDir?: string): Promise<BootstrapResult> {
    const envRoot = process.env["CAIRN_ROOT"];
    const root = envRoot && existsSync(envRoot) ? envRoot : (startDir ?? process.cwd());
    const cairnDir = join(root, ".cairn");
    const paths = buildPaths(root);

    if (root === homedir()) {
        throw new Error(
            "Refusing to bootstrap .cairn in home directory. " +
            "Set CAIRN_ROOT env var or ensure MCP client provides roots.",
        );
    }

    if (existsSync(cairnDir)) {
        const { name, from } = detectProjectName(root);
        return {
            created: false,
            paths,
            projectMeta: { name, created: "", detected_from: from },
            gitSummary: null,
        };
    }

    const dirs = [
        cairnDir,
        paths.signalsDir,
        paths.stagedDir,
        paths.memoryDir,
        paths.viewsDir,
        paths.viewsDomainsDir,
        paths.sessionsDir,
    ];
    for (const dir of dirs) {
        mkdirSync(dir, { recursive: true });
    }

    const { name, from } = detectProjectName(root);
    const created = await detectCreatedDate(root);

    const config: Config = {
        version: "2.0",
        project: { name, created },
        domains: { locked: [] },
        trust_policy: {
            L3_auto_write: DEFAULT_L3_AUTO_WRITE,
            L2_staged: [
                "scope == 'global'",
                "type == 'transition' AND affects_output == true",
            ],
            never_auto: [
                "New global no-go",
                "Stage change",
                "Output-level stack change",
                "scope == 'global' behavior_effect",
            ],
        },
        stage: { override: null, auto_constraint: false },
        tech_stack: [],
    };
    writeFileSync(paths.configYaml, yamlStringify(config), "utf-8");

    // Write minimal state.yaml first (required by stores)
    const defaultState = {
        last_session_commit: null,
        last_session_at: null,
        stage: {
            phase: "growth",
            confidence: 0.4,
            status: "advisory",
            evidence: [] as Array<{ source: string; signal: string }>,
            guidance: ["Default initial stage"],
            last_updated: new Date().toISOString(),
        },
    };
    writeFileSync(paths.stateYaml, yamlStringify(defaultState), "utf-8");

    // Placeholder output.md (will be overwritten by analysis)
    writeFileSync(join(paths.viewsDir, "output.md"), "", "utf-8");

    // Run project analysis using existing engines
    const gitSummary = await collectGitSummary(root);
    let autoSignalsRouted = 0;

    try {
        const ctx = createCairnContextFromPaths(paths);

        // 1. Scan full git history for signals
        const signals = await ctx.gitEar.scanSinceLastSession(null);

        // 2. Infer real stage from git data
        const stageSignals = ctx.stageEngine.extractSignalsFromGitData(signals);
        const inferredStage = ctx.stageEngine.inferStage(stageSignals);
        const state = ctx.stateStore.load();
        state.stage = inferredStage;
        writeFileSync(paths.stateYaml, yamlStringify({
            last_session_commit: state.last_session_commit,
            last_session_at: state.last_session_at,
            stage: inferredStage,
        }), "utf-8");

        // 3. Write actionable git signals directly to memory
        //    (bypass trust routing — too conservative for bootstrap's historical analysis)
        const actionableSignals = signals.filter(s => s.signal_type !== "stage-signal");
        for (const signal of actionableSignals) {
            const domain = signal.inferred.probable_domain ?? "unknown";
            const raw = signal.raw_data as Record<string, unknown>;
            const subjectName =
                (raw["subject"] as string) ??
                (raw["what"] as string) ??
                signal.signal_type;
            const memory = ctx.trustRouter.signalToMemory(signal, domain, subjectName);
            ctx.memoryStore.save(memory);
        }
        autoSignalsRouted = actionableSignals.length;

        // 4. Detect tech stack → config.yaml (lightweight, not memory)
        const techStack = detectTechStack(root);
        const configRaw = yamlParse(readFileSync(paths.configYaml, "utf-8"));
        configRaw.tech_stack = techStack;
        writeFileSync(paths.configYaml, yamlStringify(configRaw), "utf-8");

        // 5. Record HEAD as last scanned commit
        const head = await ctx.gitEar.getHeadCommit();
        if (head) {
            ctx.stateStore.updateLastGitScan(head);
        }

        // 6. Generate views from populated memory
        ctx.viewsEngine.regenerate();
    } catch {
        // Analysis failure is non-fatal — empty .cairn still usable
    }

    if (gitSummary) {
        gitSummary.auto_signals_routed = autoSignalsRouted;
    }

    return {
        created: true,
        paths,
        projectMeta: { name, created, detected_from: from },
        gitSummary,
    };
}
