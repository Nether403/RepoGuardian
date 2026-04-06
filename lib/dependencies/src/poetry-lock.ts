import { parse as parseToml } from "smol-toml";
import type { DetectedLockfile, NormalizedDependency } from "@repo-guardian/shared-types";
import type { ParseContext, ParserResult } from "./utils.js";
import {
  createDependency,
  dedupeDependencies,
  isRecord,
  normalizeDependencyName,
  normalizeWorkspacePath
} from "./utils.js";

export function parsePoetryLock(
  file: DetectedLockfile,
  content: string,
  context: ParseContext
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

  if (!Array.isArray(parsed.package)) {
    throw new Error(`No supported package records were found in ${file.path}.`);
  }

  const dependencies: NormalizedDependency[] = [];
  const warnings: string[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);

  for (const packageEntry of parsed.package) {
    if (!isRecord(packageEntry)) {
      warnings.push(`Skipped Poetry package entry in ${file.path}.`);
      continue;
    }

    const name =
      typeof packageEntry.name === "string" && packageEntry.name.trim().length > 0
        ? packageEntry.name.trim()
        : null;
    const version =
      typeof packageEntry.version === "string" && packageEntry.version.trim().length > 0
        ? packageEntry.version.trim()
        : null;

    if (!name || !version) {
      warnings.push(`Skipped Poetry package entry in ${file.path}.`);
      continue;
    }

    const normalizedName = normalizeDependencyName(name);
    const isDirect = context.directDependencyNames.has(normalizedName);
    const category =
      typeof packageEntry.category === "string" ? packageEntry.category.trim() : "main";
    const isOptional = packageEntry.optional === true;

    dependencies.push(
      createDependency({
        dependencyType: isDirect
          ? isOptional
            ? "optional"
            : category === "dev"
              ? "development"
              : "production"
          : "transitive",
        ecosystem: "python",
        isDirect,
        name,
        packageManager: "poetry",
        parseConfidence: "high",
        sourceFile: file.path,
        version,
        workspacePath: isDirect ? workspacePath : null
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "poetry",
    warnings
  };
}
