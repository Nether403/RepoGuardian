import type {
  AnalysisWarning,
  DetectedLockfile,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import type { ParseContext, ParserResult } from "./utils.js";
import {
  createDependency,
  createDependencyParseWarning,
  dedupeDependencies,
  normalizeDependencyName,
  normalizeWorkspacePath
} from "./utils.js";

function parseSelectorName(selector: string): string | null {
  const trimmed = selector.trim().replace(/^"|"$/gu, "");
  const match = /^((?:@[^/]+\/)?[^@]+)@/u.exec(trimmed);
  return match?.[1] ?? null;
}

function splitSelectors(rawSelectors: string): string[] {
  return rawSelectors
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/u)
    .map((selector) => selector.trim())
    .filter(Boolean);
}

export function parseYarnLock(
  file: DetectedLockfile,
  content: string,
  context: ParseContext
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);
  let currentLineNumber = 0;
  let currentSelectors: string[] = [];
  let currentVersion: string | null = null;

  function flushCurrentBlock(): void {
    if (currentSelectors.length === 0) {
      return;
    }

    if (currentSelectors.length === 1 && currentSelectors[0] === "__metadata") {
      currentSelectors = [];
      currentVersion = null;
      return;
    }

    if (!currentVersion) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped yarn.lock entry starting on line ${currentLineNumber} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      currentSelectors = [];
      currentVersion = null;
      return;
    }

    for (const selector of currentSelectors) {
      const name = parseSelectorName(selector);

      if (!name) {
        warningDetails.push(
          createDependencyParseWarning({
            code: "FILE_PARSE_FAILED",
            message: `Skipped yarn.lock selector "${selector}" in ${file.path}.`,
            path: file.path,
            source: file.kind
          })
        );
        continue;
      }

      const isDirect = context.directDependencyNames.has(normalizeDependencyName(name));

      dependencies.push(
        createDependency({
          dependencyType: isDirect ? "production" : "transitive",
          ecosystem: "node",
          isDirect,
          name,
          packageManager: "yarn",
          parseConfidence: "high",
          sourceFile: file.path,
          version: currentVersion,
          workspacePath: isDirect ? workspacePath : null
        })
      );
    }

    currentSelectors = [];
    currentVersion = null;
  }

  for (const [lineIndex, rawLine] of content.split(/\r?\n/u).entries()) {
    const trimmed = rawLine.trimEnd();

    if (!trimmed.trim() || trimmed.trim().startsWith("#")) {
      continue;
    }

    if (!rawLine.startsWith(" ") && trimmed.endsWith(":")) {
      flushCurrentBlock();
      currentLineNumber = lineIndex + 1;
      currentSelectors = splitSelectors(trimmed.slice(0, -1));
      currentVersion = null;
      continue;
    }

    if (currentSelectors.length === 0) {
      continue;
    }

    const versionMatch = /^\s+version(?::)?\s+"?([^"\s]+)"?/u.exec(rawLine);

    if (versionMatch?.[1]) {
      currentVersion = versionMatch[1].trim();
    }
  }

  flushCurrentBlock();

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "yarn",
    warningDetails
  };
}
