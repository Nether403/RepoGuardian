import { parse as parseToml } from "smol-toml";
import type {
  AnalysisWarning,
  DependencyType,
  DetectedManifest,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import type { ParserResult } from "./utils.js";
import {
  createDependency,
  createDependencyParseWarning,
  dedupeDependencies,
  isRecord,
  normalizeWorkspacePath
} from "./utils.js";

function readPipfileVersion(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (isRecord(value) && typeof value.version === "string" && value.version.trim().length > 0) {
    return value.version.trim();
  }

  return null;
}

function pushPipfileSection(
  section: unknown,
  dependencies: NormalizedDependency[],
  warningDetails: AnalysisWarning[],
  file: DetectedManifest,
  workspacePath: string,
  dependencyType: DependencyType
): void {
  if (!isRecord(section)) {
    return;
  }

  for (const [name, value] of Object.entries(section)) {
    const version = readPipfileVersion(value);

    if (!version && isRecord(value) && (value.git || value.path || value.file)) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped declaration-only Pipfile dependency "${name}" in ${file.path}; no version was available for advisory lookup.`,
          path: file.path,
          source: file.kind
        })
      );
    }

    dependencies.push(
      createDependency({
        dependencyType,
        ecosystem: "python",
        isDirect: true,
        name,
        packageManager: "pipenv",
        parseConfidence: version ? "medium" : "low",
        sourceFile: file.path,
        version,
        workspacePath
      })
    );
  }
}

export function parsePipfile(
  file: DetectedManifest,
  content: string
): ParserResult {
  let parsed: unknown;

  try {
    parsed = parseToml(content);
  } catch (error) {
    throw new Error(
      `Could not parse ${file.path} as TOML: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(`Expected ${file.path} to contain a TOML object.`);
  }

  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);

  pushPipfileSection(
    parsed.packages,
    dependencies,
    warningDetails,
    file,
    workspacePath,
    "production"
  );
  pushPipfileSection(
    parsed["dev-packages"],
    dependencies,
    warningDetails,
    file,
    workspacePath,
    "development"
  );

  if (dependencies.length === 0) {
    warningDetails.push(
      createDependencyParseWarning({
        code: "FILE_PARSE_FAILED",
        message: `No supported dependency sections parsed from ${file.path}.`,
        path: file.path,
        source: file.kind
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "pipenv",
    warningDetails
  };
}
