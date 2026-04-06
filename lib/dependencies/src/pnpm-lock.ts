import { parse as parseYaml } from "yaml";
import type {
  DependencyType,
  DetectedLockfile,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import type { ParserResult } from "./utils.js";
import { createDependency, dedupeDependencies, isRecord, normalizeDependencyName } from "./utils.js";

type ImporterDependencyIndex = Map<string, Map<string, DependencyType>>;

function addImporterSection(
  importerIndex: ImporterDependencyIndex,
  workspacePath: string,
  section: unknown,
  dependencyType: DependencyType
): void {
  if (!isRecord(section)) {
    return;
  }

  const workspaceDependencies = importerIndex.get(workspacePath) ?? new Map<string, DependencyType>();

  for (const name of Object.keys(section)) {
    workspaceDependencies.set(normalizeDependencyName(name), dependencyType);
  }

  importerIndex.set(workspacePath, workspaceDependencies);
}

function buildImporterDependencyIndex(payload: Record<string, unknown>): ImporterDependencyIndex {
  const importerIndex: ImporterDependencyIndex = new Map();

  if (!isRecord(payload.importers)) {
    return importerIndex;
  }

  for (const [workspaceName, importerValue] of Object.entries(payload.importers)) {
    if (!isRecord(importerValue)) {
      continue;
    }

    const workspacePath = workspaceName === "." ? "." : workspaceName;

    addImporterSection(importerIndex, workspacePath, importerValue.dependencies, "production");
    addImporterSection(importerIndex, workspacePath, importerValue.devDependencies, "development");
    addImporterSection(importerIndex, workspacePath, importerValue.peerDependencies, "peer");
    addImporterSection(importerIndex, workspacePath, importerValue.optionalDependencies, "optional");
  }

  return importerIndex;
}

function parsePnpmPackageKey(key: string): { name: string; version: string } | null {
  const trimmedKey = key.startsWith("/") ? key.slice(1) : key;
  const baseKey = trimmedKey.split("(")[0] ?? trimmedKey;
  const lastSeparator = baseKey.lastIndexOf("@");

  if (lastSeparator <= 0 || lastSeparator === baseKey.length - 1) {
    return null;
  }

  return {
    name: baseKey.slice(0, lastSeparator),
    version: baseKey.slice(lastSeparator + 1)
  };
}

export function parsePnpmLockYaml(
  file: DetectedLockfile,
  content: string
): ParserResult {
  let parsed: unknown;

  try {
    parsed = parseYaml(content);
  } catch (error) {
    throw new Error(
      `Could not parse ${file.path} as YAML: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(`Expected ${file.path} to contain a YAML object.`);
  }

  if (!isRecord(parsed.packages)) {
    throw new Error(`No supported package records were found in ${file.path}.`);
  }

  const importerIndex = buildImporterDependencyIndex(parsed);
  const dependencies: NormalizedDependency[] = [];
  const warnings: string[] = [];

  for (const [packageKey, packageValue] of Object.entries(parsed.packages)) {
    if (!isRecord(packageValue)) {
      warnings.push(`Skipped pnpm package entry "${packageKey}" in ${file.path}.`);
      continue;
    }

    const parsedPackageKey = parsePnpmPackageKey(packageKey);

    if (!parsedPackageKey) {
      warnings.push(`Skipped pnpm package entry "${packageKey}" in ${file.path}.`);
      continue;
    }

    const normalizedName = normalizeDependencyName(parsedPackageKey.name);
    const directWorkspaces = [...importerIndex.entries()].filter(([, dependencyNames]) =>
      dependencyNames.has(normalizedName)
    );

    if (directWorkspaces.length > 0) {
      for (const [workspacePath, dependencyNames] of directWorkspaces) {
        dependencies.push(
          createDependency({
            dependencyType: dependencyNames.get(normalizedName) ?? "production",
            ecosystem: "node",
            isDirect: true,
            name: parsedPackageKey.name,
            packageManager: "pnpm",
            parseConfidence: "high",
            sourceFile: file.path,
            version: parsedPackageKey.version,
            workspacePath
          })
        );
      }

      continue;
    }

    dependencies.push(
      createDependency({
        dependencyType: "transitive",
        ecosystem: "node",
        isDirect: false,
        name: parsedPackageKey.name,
        packageManager: "pnpm",
        parseConfidence: "high",
        sourceFile: file.path,
        version: parsedPackageKey.version,
        workspacePath: null
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "pnpm",
    warnings
  };
}
