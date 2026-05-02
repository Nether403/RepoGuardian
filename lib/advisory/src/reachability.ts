import type {
  DependencyFinding,
  ReachabilityBand,
  ReachabilityScore,
  ReachabilitySignal
} from "@repo-guardian/shared-types";

export type ReachabilityInputFinding = Pick<
  DependencyFinding,
  "confidence" | "isDirect" | "packageName"
>;

export type ReachabilityFileContents = Readonly<Record<string, string>>;

const SCANNABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rb",
  ".java",
  ".kt",
  ".kts",
  ".rs",
  ".php",
  ".cs",
  ".swift",
  ".scala",
  ".groovy"
];

const MAX_REFERENCED_PATHS = 10;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPackageReferencePatterns(packageName: string): RegExp[] {
  const patterns: RegExp[] = [];

  // Strip Maven-style "groupId:artifactId" -> use the part after ':' as scan name when present.
  const candidates = new Set<string>();
  candidates.add(packageName);

  if (packageName.includes(":")) {
    const tail = packageName.split(":").pop();
    if (tail && tail.length > 0) {
      candidates.add(tail);
    }
  }

  if (packageName.includes("/") && !packageName.startsWith("@")) {
    const tail = packageName.split("/").pop();
    if (tail && tail.length > 0) {
      candidates.add(tail);
    }
  }

  for (const candidate of candidates) {
    const escaped = escapeRegex(candidate);
    // JS-style imports/requires (full string match)
    patterns.push(
      new RegExp(`(?:from|require\\s*\\(|import\\s*\\()\\s*['"\`]${escaped}(?:/[^'"\`]*)?['"\`]`)
    );
    // JS side-effect imports (e.g., `import "pkg";` or `import 'pkg/sub';`)
    patterns.push(
      new RegExp(`import\\s+['"\`]${escaped}(?:/[^'"\`]*)?['"\`]`)
    );
    // Python imports
    patterns.push(new RegExp(`(?:from|import)\\s+${escaped}(?:[\\s.;,]|$)`, "m"));
    // Go imports
    patterns.push(new RegExp(`"${escaped}(?:/[^"]*)?"`));
    // Generic identifier mention as a fallback (only when token is reasonably specific)
    if (candidate.length >= 4 && /^[A-Za-z0-9_./@-]+$/u.test(candidate)) {
      patterns.push(new RegExp(`\\b${escaped}\\b`));
    }
  }

  return patterns;
}

function isScannablePath(path: string): boolean {
  return SCANNABLE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function classifyBand(score: number): ReachabilityBand {
  if (score >= 70) {
    return "likely";
  }

  if (score >= 40) {
    return "possible";
  }

  if (score > 0) {
    return "unlikely";
  }

  return "unknown";
}

export function findReachabilityReferences(input: {
  fileContentsByPath: ReachabilityFileContents;
  packageName: string;
}): string[] {
  const patterns = buildPackageReferencePatterns(input.packageName);
  const matchedPaths = new Set<string>();

  for (const [path, content] of Object.entries(input.fileContentsByPath)) {
    if (!isScannablePath(path)) {
      continue;
    }

    if (typeof content !== "string" || content.length === 0) {
      continue;
    }

    if (patterns.some((pattern) => pattern.test(content))) {
      matchedPaths.add(path);
      if (matchedPaths.size >= MAX_REFERENCED_PATHS) {
        break;
      }
    }
  }

  return [...matchedPaths].sort((left, right) => left.localeCompare(right));
}

export function scoreReachability(input: {
  finding: ReachabilityInputFinding;
  fileContentsByPath?: ReachabilityFileContents | undefined;
}): ReachabilityScore {
  const signals: ReachabilitySignal[] = [];
  let score = 0;

  if (input.finding.isDirect) {
    score += 30;
    signals.push({
      detail: "Listed as a direct dependency in the manifest.",
      kind: "direct-dependency",
      weight: 30
    });
  } else {
    score += 5;
    signals.push({
      detail: "Pulled in transitively; reachability depends on the consuming code path.",
      kind: "transitive-dependency",
      weight: 5
    });
  }

  if (input.finding.confidence === "high") {
    score += 15;
    signals.push({
      detail: "Advisory match has high confidence.",
      kind: "confidence",
      weight: 15
    });
  } else if (input.finding.confidence === "medium") {
    score += 8;
    signals.push({
      detail: "Advisory match has medium confidence.",
      kind: "confidence",
      weight: 8
    });
  }

  let referencedPaths: string[] = [];
  const fileContentsByPath = input.fileContentsByPath;
  const reviewedFileCount = fileContentsByPath
    ? Object.keys(fileContentsByPath).filter((path) => isScannablePath(path)).length
    : 0;
  let scanned = false;

  if (!fileContentsByPath || reviewedFileCount === 0) {
    signals.push({
      detail: "No reviewed source files were available to scan for references.",
      kind: "no-reviewed-files",
      weight: 0
    });
  } else {
    scanned = true;
    referencedPaths = findReachabilityReferences({
      fileContentsByPath,
      packageName: input.finding.packageName
    });

    if (referencedPaths.length > 0) {
      const importBoost = Math.min(40, 25 + (referencedPaths.length - 1) * 5);
      score += importBoost;
      signals.push({
        detail: `Found ${referencedPaths.length} reviewed file${referencedPaths.length === 1 ? "" : "s"} that import or reference ${input.finding.packageName}.`,
        kind: "import-reference",
        weight: importBoost
      });
    } else {
      signals.push({
        detail: `No imports or references to ${input.finding.packageName} were found in ${reviewedFileCount} reviewed file${reviewedFileCount === 1 ? "" : "s"}.`,
        kind: "no-references-found",
        weight: -10
      });
      score = Math.max(0, score - 10);
    }
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const band: ReachabilityBand = scanned ? classifyBand(clampedScore) : "unknown";

  return {
    band,
    referencedPaths,
    score: clampedScore,
    signals
  };
}
