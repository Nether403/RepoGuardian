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

function readCargoDependencyName(name: string, value: unknown): string {
  if (isRecord(value) && typeof value.package === "string" && value.package.trim().length > 0) {
    return value.package.trim();
  }

  return name;
}

function readCargoDependencyVersion(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (isRecord(value) && typeof value.version === "string" && value.version.trim().length > 0) {
    return value.version.trim();
  }

  return null;
}

function pushCargoDependencySection(
  mapping: unknown,
  dependencies: NormalizedDependency[],
  warningDetails: AnalysisWarning[],
  file: DetectedManifest,
  workspacePath: string,
  dependencyType: DependencyType
): void {
  if (!isRecord(mapping)) {
    return;
  }

  for (const [name, value] of Object.entries(mapping)) {
    const dependencyName = readCargoDependencyName(name, value);
    const version = readCargoDependencyVersion(value);
    const isOptional = isRecord(value) && value.optional === true;

    if (!version && isRecord(value) && (value.path || value.git || value.workspace === true)) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped declaration-only Cargo dependency "${name}" in ${file.path}; no version was available for advisory lookup.`,
          path: file.path,
          source: file.kind
        })
      );
    }

    dependencies.push(
      createDependency({
        dependencyType:
          isOptional && dependencyType === "production" ? "optional" : dependencyType,
        ecosystem: "rust",
        isDirect: true,
        name: dependencyName,
        packageManager: "cargo",
        parseConfidence: version ? "medium" : "low",
        sourceFile: file.path,
        version,
        workspacePath
      })
    );
  }
}

export function parseCargoToml(
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

  pushCargoDependencySection(
    parsed.dependencies,
    dependencies,
    warningDetails,
    file,
    workspacePath,
    "production"
  );
  pushCargoDependencySection(
    parsed["dev-dependencies"],
    dependencies,
    warningDetails,
    file,
    workspacePath,
    "development"
  );
  pushCargoDependencySection(
    parsed["build-dependencies"],
    dependencies,
    warningDetails,
    file,
    workspacePath,
    "development"
  );

  if (isRecord(parsed.target)) {
    for (const targetValue of Object.values(parsed.target)) {
      if (!isRecord(targetValue)) {
        continue;
      }

      pushCargoDependencySection(
        targetValue.dependencies,
        dependencies,
        warningDetails,
        file,
        workspacePath,
        "production"
      );
      pushCargoDependencySection(
        targetValue["dev-dependencies"],
        dependencies,
        warningDetails,
        file,
        workspacePath,
        "development"
      );
      pushCargoDependencySection(
        targetValue["build-dependencies"],
        dependencies,
        warningDetails,
        file,
        workspacePath,
        "development"
      );
    }
  }

  if (isRecord(parsed.workspace)) {
    pushCargoDependencySection(
      parsed.workspace.dependencies,
      dependencies,
      warningDetails,
      file,
      workspacePath,
      "production"
    );
  }

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
    packageManager: "cargo",
    warningDetails
  };
}
