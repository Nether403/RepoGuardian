import type { CodeReviewFinding, DetectedSignal, RepositoryTreeEntry } from "@repo-guardian/shared-types";

export type ReviewSourceType = CodeReviewFinding["sourceType"];

export type ReviewSelectionReason =
  | "workflow"
  | "config"
  | "security-sensitive"
  | "api-entrypoint"
  | "application-entrypoint";

export type ReviewTarget = {
  path: string;
  priority: number;
  selectionReason: ReviewSelectionReason;
  sourceType: ReviewSourceType;
};

export type ReviewSelectionResult = {
  candidateCount: number;
  isCapped: boolean;
  targets: ReviewTarget[];
  totalFileCount: number;
};

type ReviewSelectionOptions = {
  dependencyFindingPaths?: string[];
  maxFiles?: number;
  signals?: DetectedSignal[];
  treeEntries: RepositoryTreeEntry[];
};

const reviewableCodeExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py"
]);

const reviewableConfigExtensions = new Set([
  ".json",
  ".yml",
  ".yaml",
  ".sh"
]);

const securitySensitivePathPatterns = [
  "auth",
  "oauth",
  "jwt",
  "token",
  "secret",
  "password",
  "session",
  "login",
  "apikey",
  "api-key"
];

const entrypointBasenames = new Set([
  "app.ts",
  "app.js",
  "app.mjs",
  "app.cjs",
  "index.ts",
  "index.js",
  "main.ts",
  "main.js",
  "server.ts",
  "server.js",
  "handler.ts",
  "handler.js",
  "lambda.ts",
  "lambda.js",
  "manage.py",
  "asgi.py",
  "wsgi.py"
]);

const configBasenames = new Set([
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
  "serverless.yml",
  "serverless.yaml",
  "vercel.json"
]);

function dirname(path: string): string {
  const segments = path.split("/");
  segments.pop();
  return segments.join("/");
}

function basename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

function getExtension(path: string): string {
  const base = basename(path);
  const lastDotIndex = base.lastIndexOf(".");
  return lastDotIndex >= 0 ? base.slice(lastDotIndex) : "";
}

function isFile(entry: RepositoryTreeEntry): boolean {
  return entry.kind === "file";
}

function isWorkflowPath(path: string): boolean {
  return /^\.github\/workflows\/.+\.(yml|yaml)$/u.test(path);
}

function isGeneratedOrTestPath(path: string): boolean {
  return (
    path.includes("/__tests__/") ||
    path.includes("/dist/") ||
    path.includes("/build/") ||
    path.includes("/coverage/") ||
    path.includes("/vendor/") ||
    path.includes("/node_modules/") ||
    path.endsWith(".min.js") ||
    /\.test\.[^.]+$/u.test(path) ||
    /\.spec\.[^.]+$/u.test(path)
  );
}

function isReviewableCodePath(path: string): boolean {
  return reviewableCodeExtensions.has(getExtension(path));
}

function isReviewableConfigPath(path: string): boolean {
  return configBasenames.has(basename(path)) || reviewableConfigExtensions.has(getExtension(path));
}

function createDependencyRiskWorkspaceSet(paths: string[]): Set<string> {
  const workspaces = new Set<string>();

  for (const path of paths) {
    const workspace = dirname(path);
    if (workspace.length > 0) {
      workspaces.add(workspace);
    }
  }

  return workspaces;
}

function isNearDependencyRisk(path: string, riskyWorkspaces: Set<string>): boolean {
  for (const workspace of riskyWorkspaces) {
    if (path.startsWith(`${workspace}/`)) {
      return true;
    }
  }

  return false;
}

function classifyPath(
  path: string,
  signalPaths: Set<string>,
  riskyWorkspaces: Set<string>
): ReviewTarget | null {
  const loweredPath = path.toLowerCase();
  const base = basename(path);

  if (isWorkflowPath(path) || signalPaths.has(path) && path.startsWith(".github/workflows/")) {
    return {
      path,
      priority: 300,
      selectionReason: "workflow",
      sourceType: "workflow"
    };
  }

  if (configBasenames.has(base) || signalPaths.has(path) || isReviewableConfigPath(path) && path.startsWith("config/")) {
    return {
      path,
      priority: 240,
      selectionReason: "config",
      sourceType: "config"
    };
  }

  if (
    securitySensitivePathPatterns.some((pattern) => loweredPath.includes(pattern)) &&
    (isReviewableCodePath(path) || isReviewableConfigPath(path))
  ) {
    return {
      path,
      priority: 220,
      selectionReason: "security-sensitive",
      sourceType: isReviewableCodePath(path) ? "code" : "config"
    };
  }

  if (
    isReviewableCodePath(path) &&
    (/^(api|server|src\/api|src\/server|src\/routes|routes|controllers|handlers)\//u.test(path) ||
      /(\/api\/|\/server\/|\/routes\/|\/controllers\/|\/handlers\/)/u.test(path))
  ) {
    return {
      path,
      priority: 180,
      selectionReason: "api-entrypoint",
      sourceType: "code"
    };
  }

  if (isReviewableCodePath(path) && entrypointBasenames.has(base)) {
    return {
      path,
      priority: 160,
      selectionReason: "application-entrypoint",
      sourceType: "code"
    };
  }

  if (isReviewableCodePath(path) && isNearDependencyRisk(path, riskyWorkspaces)) {
    return {
      path,
      priority: 150,
      selectionReason: "application-entrypoint",
      sourceType: "code"
    };
  }

  return null;
}

export function selectReviewTargets(
  options: ReviewSelectionOptions
): ReviewSelectionResult {
  const maxFiles = Math.max(1, options.maxFiles ?? 12);
  const signalPaths = new Set((options.signals ?? []).map((signal) => signal.path));
  const riskyWorkspaces = createDependencyRiskWorkspaceSet(options.dependencyFindingPaths ?? []);
  const allFiles = options.treeEntries.filter(isFile).map((entry) => entry.path);
  const candidateTargets = allFiles
    .filter((path) => !isGeneratedOrTestPath(path))
    .map((path) => classifyPath(path, signalPaths, riskyWorkspaces))
    .filter((target): target is ReviewTarget => target !== null)
    .map((target) => ({
      ...target,
      priority:
        target.priority +
        (isNearDependencyRisk(target.path, riskyWorkspaces) ? 15 : 0)
    }))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }

      return left.path.localeCompare(right.path);
    });

  const dedupedTargets = [...new Map(candidateTargets.map((target) => [target.path, target])).values()];

  return {
    candidateCount: dedupedTargets.length,
    isCapped: dedupedTargets.length > maxFiles,
    targets: dedupedTargets.slice(0, maxFiles),
    totalFileCount: allFiles.length
  };
}
