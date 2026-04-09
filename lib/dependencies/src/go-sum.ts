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

export function parseGoSum(
  file: DetectedLockfile,
  content: string,
  context: ParseContext
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);
  const seenEntries = new Set<string>();

  for (const [lineIndex, rawLine] of content.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const parts = line.split(/\s+/u);

    if (parts.length < 3) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped malformed go.sum entry on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    const name = parts[0];
    const version = parts[1]?.replace(/\/go\.mod$/u, "") ?? "";

    if (!name || !version) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped malformed go.sum entry on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    const entryKey = `${name}:${version}`;

    if (seenEntries.has(entryKey)) {
      continue;
    }

    seenEntries.add(entryKey);

    const isDirect = context.directDependencyNames.has(normalizeDependencyName(name));

    dependencies.push(
      createDependency({
        dependencyType: isDirect ? "production" : "transitive",
        ecosystem: "go",
        isDirect,
        name,
        packageManager: "go-mod",
        parseConfidence: "high",
        sourceFile: file.path,
        version,
        workspacePath: isDirect ? workspacePath : null
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "go-mod",
    warningDetails
  };
}
