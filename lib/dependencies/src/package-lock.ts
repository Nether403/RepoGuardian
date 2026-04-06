import type {
  DependencyType,
  DetectedLockfile,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import type { ParseContext, ParserResult } from "./utils.js";
import {
  createDependency,
  dedupeDependencies,
  isRecord,
  normalizeDependencyName,
  normalizeWorkspacePath
} from "./utils.js";

type DirectDependencySets = {
  all: Set<string>;
  development: Set<string>;
  optional: Set<string>;
  peer: Set<string>;
  production: Set<string>;
};

function createDirectDependencySets(): DirectDependencySets {
  return {
    all: new Set<string>(),
    development: new Set<string>(),
    optional: new Set<string>(),
    peer: new Set<string>(),
    production: new Set<string>()
  };
}

function readDependencyNames(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.keys(value).map((name) => normalizeDependencyName(name));
}

function buildDirectDependencySets(
  rootPackage: Record<string, unknown> | null,
  context: ParseContext
): DirectDependencySets {
  const directSets = createDirectDependencySets();

  if (rootPackage) {
    for (const name of readDependencyNames(rootPackage.dependencies)) {
      directSets.production.add(name);
      directSets.all.add(name);
    }

    for (const name of readDependencyNames(rootPackage.devDependencies)) {
      directSets.development.add(name);
      directSets.all.add(name);
    }

    for (const name of readDependencyNames(rootPackage.peerDependencies)) {
      directSets.peer.add(name);
      directSets.all.add(name);
    }

    for (const name of readDependencyNames(rootPackage.optionalDependencies)) {
      directSets.optional.add(name);
      directSets.all.add(name);
    }
  }

  for (const name of context.directDependencyNames) {
    directSets.production.add(name);
    directSets.all.add(name);
  }

  return directSets;
}

function derivePackageNameFromPath(packagePath: string): string | null {
  const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(packagePath);
  return match?.[1] ?? null;
}

function classifyDependencyType(
  name: string,
  value: Record<string, unknown>,
  directSets: DirectDependencySets
): DependencyType {
  const normalizedName = normalizeDependencyName(name);

  if (directSets.optional.has(normalizedName) || value.optional === true) {
    return "optional";
  }

  if (directSets.peer.has(normalizedName) || value.peer === true) {
    return "peer";
  }

  if (directSets.development.has(normalizedName) || value.dev === true) {
    return "development";
  }

  if (directSets.production.has(normalizedName) || directSets.all.has(normalizedName)) {
    return "production";
  }

  return "transitive";
}

function parsePackagesObject(
  file: DetectedLockfile,
  packagesObject: Record<string, unknown>,
  context: ParseContext
): ParserResult {
  const workspacePath = normalizeWorkspacePath(file.path);
  const warnings: string[] = [];
  const dependencies: NormalizedDependency[] = [];
  const rootEntry = packagesObject[""];
  const directSets = buildDirectDependencySets(
    isRecord(rootEntry) ? rootEntry : null,
    context
  );

  for (const [packagePath, value] of Object.entries(packagesObject)) {
    if (packagePath.length === 0) {
      continue;
    }

    if (!isRecord(value)) {
      warnings.push(`Skipped package-lock entry "${packagePath}" in ${file.path}.`);
      continue;
    }

    const name =
      typeof value.name === "string" && value.name.trim().length > 0
        ? value.name
        : derivePackageNameFromPath(packagePath);
    const version =
      typeof value.version === "string" && value.version.trim().length > 0
        ? value.version.trim()
        : null;

    if (!name || !version) {
      warnings.push(`Skipped package-lock entry "${packagePath}" in ${file.path}.`);
      continue;
    }

    const normalizedName = normalizeDependencyName(name);
    const isDirect = directSets.all.has(normalizedName);

    dependencies.push(
      createDependency({
        dependencyType: classifyDependencyType(name, value, directSets),
        ecosystem: "node",
        isDirect,
        name,
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: file.path,
        version,
        workspacePath: isDirect ? workspacePath : null
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "npm",
    warnings
  };
}

function visitLegacyDependencies(
  dependenciesObject: Record<string, unknown>,
  file: DetectedLockfile,
  depth: number,
  directSets: DirectDependencySets,
  warnings: string[],
  dependencies: ReturnType<typeof dedupeDependencies>
): void {
  for (const [name, value] of Object.entries(dependenciesObject)) {
    if (!isRecord(value)) {
      warnings.push(`Skipped package-lock dependency "${name}" in ${file.path}.`);
      continue;
    }

    const version =
      typeof value.version === "string" && value.version.trim().length > 0
        ? value.version.trim()
        : null;

    if (!version) {
      warnings.push(`Skipped package-lock dependency "${name}" in ${file.path}.`);
      continue;
    }

    const normalizedName = normalizeDependencyName(name);
    const isDirect = depth === 0 || directSets.all.has(normalizedName);

    dependencies.push(
      createDependency({
        dependencyType: classifyDependencyType(name, value, directSets),
        ecosystem: "node",
        isDirect,
        name,
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: file.path,
        version,
        workspacePath: isDirect ? normalizeWorkspacePath(file.path) : null
      })
    );

    if (isRecord(value.dependencies)) {
      visitLegacyDependencies(
        value.dependencies,
        file,
        depth + 1,
        directSets,
        warnings,
        dependencies
      );
    }
  }
}

export function parsePackageLockJson(
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

  if (isRecord(parsed.packages)) {
    return parsePackagesObject(file, parsed.packages, context);
  }

  if (isRecord(parsed.dependencies)) {
    const dependencies: NormalizedDependency[] = [];
    const warnings: string[] = [];
    const directSets = buildDirectDependencySets(null, context);

    visitLegacyDependencies(parsed.dependencies, file, 0, directSets, warnings, dependencies);

    return {
      dependencies: dedupeDependencies(dependencies),
      packageManager: "npm",
      warnings
    };
  }

  throw new Error(`No supported package records were found in ${file.path}.`);
}
