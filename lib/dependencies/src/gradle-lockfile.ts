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
  getPreferredDirectDependency,
  normalizeDependencyName,
  normalizeWorkspacePath
} from "./utils.js";

function inferGradleLockDependencyType(configurations: string[]): "development" | "production" {
  return configurations.length > 0 && configurations.every((configuration) => /test/u.test(configuration))
    ? "development"
    : "production";
}

export function parseGradleLockfile(
  file: DetectedLockfile,
  content: string,
  context: ParseContext
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);

  for (const [lineIndex, rawLine] of content.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line === "empty=") {
      continue;
    }

    const [coordinatePart, configurationsPart = ""] = line.split("=", 2);
    const coordinateMatch = /^([^:\s]+:[^:\s]+):([^:\s]+)$/u.exec(coordinatePart?.trim() ?? "");

    if (!coordinateMatch?.[1] || !coordinateMatch[2]) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped malformed gradle.lockfile entry on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    const name = coordinateMatch[1];
    const version = coordinateMatch[2];
    const configurations = configurationsPart
      .split(",")
      .map((configuration) => configuration.trim())
      .filter(Boolean);
    const isDirect = context.directDependencyNames.has(normalizeDependencyName(name));
    const directDependency = isDirect
      ? getPreferredDirectDependency(context, name)
      : null;

    dependencies.push(
      createDependency({
        dependencyType: isDirect
          ? directDependency?.dependencyType ?? inferGradleLockDependencyType(configurations)
          : "transitive",
        ecosystem: "jvm",
        isDirect,
        name,
        packageManager: "gradle",
        parseConfidence: "high",
        sourceFile: file.path,
        version,
        workspacePath: isDirect
          ? directDependency?.workspacePath ?? workspacePath
          : null
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "gradle",
    warningDetails
  };
}
