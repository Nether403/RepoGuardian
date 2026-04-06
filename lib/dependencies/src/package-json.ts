import type {
  AnalysisWarning,
  DetectedManifest,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import type { ParserResult, ParseContext } from "./utils.js";
import {
  createDependencyParseWarning,
  createDependency,
  dedupeDependencies,
  inferNodeManifestPackageManager,
  isRecord,
  normalizeWorkspacePath
} from "./utils.js";

const dependencySections = [
  ["dependencies", "production"],
  ["devDependencies", "development"],
  ["peerDependencies", "peer"],
  ["optionalDependencies", "optional"]
] as const;

export function parsePackageJson(
  file: DetectedManifest,
  content: string,
  context: ParseContext
): ParserResult {
  const workspacePath = normalizeWorkspacePath(file.path);
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const packageManager = inferNodeManifestPackageManager(context, file.path);

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

  for (const [sectionName, dependencyType] of dependencySections) {
    const section = parsed[sectionName];

    if (section === undefined) {
      continue;
    }

    if (!isRecord(section)) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped non-object ${sectionName} section in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    for (const [name, version] of Object.entries(section)) {
      if (typeof version !== "string" || version.trim().length === 0) {
        warningDetails.push(
          createDependencyParseWarning({
            code: "FILE_PARSE_FAILED",
            message: `Skipped ${sectionName} entry "${name}" in ${file.path}.`,
            path: file.path,
            source: file.kind
          })
        );
        continue;
      }

      dependencies.push(
        createDependency({
          dependencyType,
          ecosystem: "node",
          isDirect: true,
          name,
          packageManager,
          parseConfidence: "high",
          sourceFile: file.path,
          version: version.trim(),
          workspacePath
        })
      );
    }
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager,
    warningDetails
  };
}
