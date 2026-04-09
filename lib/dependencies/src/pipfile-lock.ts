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
  isRecord,
  normalizeDependencyName,
  normalizeWorkspacePath
} from "./utils.js";

function pushPipfileLockSection(
  section: unknown,
  dependencies: NormalizedDependency[],
  warningDetails: AnalysisWarning[],
  file: DetectedLockfile,
  workspacePath: string,
  context: ParseContext,
  sectionType: "default" | "develop"
): void {
  if (!isRecord(section)) {
    return;
  }

  for (const [name, value] of Object.entries(section)) {
    if (!isRecord(value) || typeof value.version !== "string" || value.version.trim().length === 0) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped Pipfile.lock dependency "${name}" in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    const isDirect = context.directDependencyNames.has(normalizeDependencyName(name));

    dependencies.push(
      createDependency({
        dependencyType: isDirect
          ? sectionType === "develop"
            ? "development"
            : "production"
          : "transitive",
        ecosystem: "python",
        isDirect,
        name,
        packageManager: "pipenv",
        parseConfidence: "high",
        sourceFile: file.path,
        version: value.version.trim(),
        workspacePath: isDirect ? workspacePath : null
      })
    );
  }
}

export function parsePipfileLock(
  file: DetectedLockfile,
  content: string,
  context: ParseContext
): ParserResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Could not parse ${file.path} as JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(`Expected ${file.path} to contain a JSON object.`);
  }

  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);

  pushPipfileLockSection(
    parsed.default,
    dependencies,
    warningDetails,
    file,
    workspacePath,
    context,
    "default"
  );
  pushPipfileLockSection(
    parsed.develop,
    dependencies,
    warningDetails,
    file,
    workspacePath,
    context,
    "develop"
  );

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "pipenv",
    warningDetails
  };
}
