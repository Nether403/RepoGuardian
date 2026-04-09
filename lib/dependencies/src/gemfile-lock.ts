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

export function parseGemfileLock(
  file: DetectedLockfile,
  content: string,
  context: ParseContext
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);
  const directDependencyNames = new Set<string>(context.directDependencyNames);

  let dependencySection = false;

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (/^[A-Z][A-Z ]+$/u.test(trimmed)) {
      dependencySection = trimmed === "DEPENDENCIES";
      continue;
    }

    if (!dependencySection) {
      continue;
    }

    const dependencyMatch = /^\s{2}([^\s(!]+)!?/u.exec(line);

    if (dependencyMatch?.[1]) {
      directDependencyNames.add(normalizeDependencyName(dependencyMatch[1]));
    }
  }

  let currentSection = "";
  let inSpecs = false;

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      inSpecs = false;
      continue;
    }

    if (/^[A-Z][A-Z ]+$/u.test(trimmed)) {
      currentSection = trimmed;
      inSpecs = false;
      continue;
    }

    if (trimmed === "specs:") {
      inSpecs = true;
      continue;
    }

    if (currentSection === "DEPENDENCIES") {
      continue;
    }

    if (!inSpecs) {
      continue;
    }

    const specMatch = /^\s{4}([^\s(]+)\s\(([^)]+)\)/u.exec(line);

    if (!specMatch) {
      continue;
    }

    const [, name, version] = specMatch;

    if (!name || !version) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped Gemfile.lock entry in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    const isDirect = directDependencyNames.has(normalizeDependencyName(name));
    const directDependency = isDirect
      ? getPreferredDirectDependency(context, name)
      : null;

    dependencies.push(
      createDependency({
        dependencyType: isDirect
          ? directDependency?.dependencyType ?? "production"
          : "transitive",
        ecosystem: "ruby",
        isDirect,
        name,
        packageManager: "bundler",
        parseConfidence: "high",
        sourceFile: file.path,
        version: version.trim(),
        workspacePath: isDirect
          ? directDependency?.workspacePath ?? workspacePath
          : null
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "bundler",
    warningDetails
  };
}
