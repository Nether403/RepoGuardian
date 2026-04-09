import type {
  AnalysisWarning,
  DetectedManifest,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import type { ParserResult } from "./utils.js";
import {
  createDependency,
  createDependencyParseWarning,
  dedupeDependencies,
  normalizeWorkspacePath
} from "./utils.js";

function parseGoRequireLine(
  rawLine: string,
  inRequireBlock: boolean
): { isIndirect: boolean; name: string; version: string } | null {
  const isIndirect = /\/\/\s*indirect/u.test(rawLine);
  const withoutComment = rawLine.replace(/\s*\/\/.*$/u, "").trim();

  if (!withoutComment || withoutComment === "(" || withoutComment === ")") {
    return null;
  }

  const content = inRequireBlock
    ? withoutComment
    : withoutComment.startsWith("require ")
      ? withoutComment.slice("require ".length).trim()
      : null;

  if (!content || content === "(") {
    return null;
  }

  const match = /^(\S+)\s+(\S+)$/u.exec(content);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    isIndirect,
    name: match[1],
    version: match[2]
  };
}

export function parseGoMod(
  file: DetectedManifest,
  content: string
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);
  let inRequireBlock = false;

  for (const [lineIndex, rawLine] of content.split(/\r?\n/u).entries()) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === "require (") {
      inRequireBlock = true;
      continue;
    }

    if (inRequireBlock && trimmed === ")") {
      inRequireBlock = false;
      continue;
    }

    const parsedLine = parseGoRequireLine(rawLine, inRequireBlock);

    if (!parsedLine) {
      continue;
    }

    if (!parsedLine.name || !parsedLine.version) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped go.mod dependency on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    dependencies.push(
      createDependency({
        dependencyType: parsedLine.isIndirect ? "transitive" : "production",
        ecosystem: "go",
        isDirect: !parsedLine.isIndirect,
        name: parsedLine.name,
        packageManager: "go-mod",
        parseConfidence: "medium",
        sourceFile: file.path,
        version: parsedLine.version,
        workspacePath: parsedLine.isIndirect ? null : workspacePath
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "go-mod",
    warningDetails
  };
}
