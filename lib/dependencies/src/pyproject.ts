import { parse as parseToml } from "smol-toml";
import type {
  DependencyType,
  DetectedManifest,
  NormalizedDependency,
  PackageManagerId
} from "@repo-guardian/shared-types";
import type { ParseContext, ParserResult } from "./utils.js";
import {
  createDependency,
  dedupeDependencies,
  isRecord,
  normalizeWorkspacePath
} from "./utils.js";
import { parsePythonRequirement } from "./python-utils.js";

function pushRequirementString(
  dependencies: ReturnType<typeof dedupeDependencies>,
  warnings: string[],
  file: DetectedManifest,
  workspacePath: string,
  packageManager: PackageManagerId | null,
  dependencyType: DependencyType,
  declaration: string
): void {
  const parsedRequirement = parsePythonRequirement(declaration);

  if (!parsedRequirement) {
    warnings.push(`Skipped unsupported dependency declaration "${declaration}" in ${file.path}.`);
    return;
  }

  dependencies.push(
    createDependency({
      dependencyType,
      ecosystem: "python",
      isDirect: true,
      name: parsedRequirement.name,
      packageManager,
      parseConfidence: packageManager === "poetry" ? "high" : "medium",
      sourceFile: file.path,
      version: parsedRequirement.version,
      workspacePath
    })
  );
}

function readPoetryDependencyVersion(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (isRecord(value) && typeof value.version === "string" && value.version.trim().length > 0) {
    return value.version.trim();
  }

  return null;
}

function pushPoetryMapping(
  mapping: unknown,
  dependencies: ReturnType<typeof dedupeDependencies>,
  warnings: string[],
  file: DetectedManifest,
  workspacePath: string,
  dependencyType: DependencyType
): void {
  if (!isRecord(mapping)) {
    return;
  }

  for (const [name, value] of Object.entries(mapping)) {
    if (name === "python") {
      continue;
    }

    const version = readPoetryDependencyVersion(value);

    if (!version) {
      warnings.push(`Skipped unsupported Poetry dependency "${name}" in ${file.path}.`);
      continue;
    }

    const isOptional = isRecord(value) && value.optional === true;

    dependencies.push(
      createDependency({
        dependencyType: isOptional && dependencyType === "production" ? "optional" : dependencyType,
        ecosystem: "python",
        isDirect: true,
        name,
        packageManager: "poetry",
        parseConfidence: "high",
        sourceFile: file.path,
        version,
        workspacePath
      })
    );
  }
}

export function parsePyprojectToml(
  file: DetectedManifest,
  content: string,
  context: ParseContext
): ParserResult {
  void context;

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

  const workspacePath = normalizeWorkspacePath(file.path);
  const dependencies: NormalizedDependency[] = [];
  const warnings: string[] = [];
  let packageManager: PackageManagerId | null = null;
  let parsedSupportedSection = false;

  if (isRecord(parsed.project)) {
    if (Array.isArray(parsed.project.dependencies)) {
      parsedSupportedSection = true;

      for (const declaration of parsed.project.dependencies) {
        if (typeof declaration !== "string") {
          warnings.push(`Skipped non-string project dependency in ${file.path}.`);
          continue;
        }

        pushRequirementString(
          dependencies,
          warnings,
          file,
          workspacePath,
          null,
          "production",
          declaration
        );
      }
    }

    if (isRecord(parsed.project["optional-dependencies"])) {
      parsedSupportedSection = true;

      for (const optionalGroup of Object.values(parsed.project["optional-dependencies"])) {
        if (!Array.isArray(optionalGroup)) {
          warnings.push(`Skipped non-array project optional dependency group in ${file.path}.`);
          continue;
        }

        for (const declaration of optionalGroup) {
          if (typeof declaration !== "string") {
            warnings.push(`Skipped non-string optional dependency in ${file.path}.`);
            continue;
          }

          pushRequirementString(
            dependencies,
            warnings,
            file,
            workspacePath,
            null,
            "optional",
            declaration
          );
        }
      }
    }
  }

  if (isRecord(parsed.tool) && isRecord(parsed.tool.poetry)) {
    parsedSupportedSection = true;
    packageManager = "poetry";

    pushPoetryMapping(
      parsed.tool.poetry.dependencies,
      dependencies,
      warnings,
      file,
      workspacePath,
      "production"
    );
    pushPoetryMapping(
      parsed.tool.poetry["dev-dependencies"],
      dependencies,
      warnings,
      file,
      workspacePath,
      "development"
    );

    if (isRecord(parsed.tool.poetry.group)) {
      for (const [groupName, groupValue] of Object.entries(parsed.tool.poetry.group)) {
        if (!isRecord(groupValue)) {
          warnings.push(`Skipped unsupported Poetry group "${groupName}" in ${file.path}.`);
          continue;
        }

        pushPoetryMapping(
          groupValue.dependencies,
          dependencies,
          warnings,
          file,
          workspacePath,
          groupName === "dev" ? "development" : "optional"
        );
      }
    }
  }

  if (!parsedSupportedSection) {
    warnings.push(`No supported dependency sections parsed from ${file.path}.`);
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager,
    warnings
  };
}
