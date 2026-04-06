import type {
  AnalysisWarning,
  DependencySnapshot,
  DependencyType,
  EcosystemId,
  NormalizedDependency,
  PackageManagerId,
  ParseConfidence
} from "@repo-guardian/shared-types";
import {
  createAnalysisWarning,
  getWarningMessages
} from "@repo-guardian/shared-types";
import { buildAdvisoryQueryKey } from "./provider.js";
import { extractConcreteVersion, getProviderEcosystem, isLockfileSource } from "./version.js";

export type AdvisoryLookupTarget = {
  confidence: ParseConfidence;
  dependencyType: DependencyType;
  ecosystem: EcosystemId;
  hasLockfileEvidence: boolean;
  isDirect: boolean;
  packageManager: PackageManagerId | null;
  packageName: string;
  paths: string[];
  query: {
    ecosystem: EcosystemId;
    key: string;
    packageName: string;
    version: string;
  };
  sourceFile: string;
  version: string;
  workspacePath: string | null;
};

type AdvisoryLookupPlan = {
  isPartial: boolean;
  targets: AdvisoryLookupTarget[];
  warningDetails: AnalysisWarning[];
  warnings: string[];
};

type DependencyGroup = {
  dependencies: NormalizedDependency[];
  ecosystem: EcosystemId;
  isDirect: boolean;
  key: string;
  packageName: string;
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildGroupKey(dependency: NormalizedDependency, version: string | null): string {
  const workspacePath = dependency.workspacePath ?? ".";
  return dependency.isDirect
    ? [
        dependency.ecosystem,
        dependency.name,
        workspacePath,
        dependency.dependencyType,
        "direct"
      ].join(":")
    : [
        dependency.ecosystem,
        dependency.name,
        workspacePath,
        dependency.dependencyType,
        version ?? "",
        "transitive"
      ].join(":");
}

function groupDependencies(
  dependencies: NormalizedDependency[]
): Map<string, DependencyGroup> {
  const grouped = new Map<string, DependencyGroup>();

  for (const dependency of dependencies) {
    const concreteVersion = extractConcreteVersion(dependency);
    const key = buildGroupKey(dependency, concreteVersion);
    const existing = grouped.get(key);

    if (existing) {
      existing.dependencies.push(dependency);
      continue;
    }

    grouped.set(key, {
      dependencies: [dependency],
      ecosystem: dependency.ecosystem,
      isDirect: dependency.isDirect,
      key,
      packageName: dependency.name
    });
  }

  return grouped;
}

function scoreDependencyCandidate(dependency: NormalizedDependency): number {
  let score = 0;

  if (isLockfileSource(dependency.sourceFile)) {
    score += 100;
  }

  if (dependency.parseConfidence === "high") {
    score += 10;
  } else if (dependency.parseConfidence === "medium") {
    score += 5;
  }

  if (dependency.isDirect) {
    score += 1;
  }

  return score;
}

function chooseBestDependency(
  dependencies: NormalizedDependency[]
): { dependency: NormalizedDependency; version: string } | null {
  const concreteDependencies = dependencies
    .map((dependency) => ({
      dependency,
      version: extractConcreteVersion(dependency)
    }))
    .filter(
      (
        item
      ): item is {
        dependency: NormalizedDependency;
        version: string;
      } => item.version !== null
    )
    .sort((left, right) => {
      const scoreDifference =
        scoreDependencyCandidate(right.dependency) -
        scoreDependencyCandidate(left.dependency);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return left.dependency.sourceFile.localeCompare(right.dependency.sourceFile);
    });

  return concreteDependencies[0] ?? null;
}

export function createAdvisoryLookupPlan(
  dependencySnapshot: DependencySnapshot
): AdvisoryLookupPlan {
  const warningDetails: AnalysisWarning[] = [];
  const targets: AdvisoryLookupTarget[] = [];
  let isPartial = dependencySnapshot.isPartial;

  for (const group of groupDependencies(dependencySnapshot.dependencies).values()) {
    const providerEcosystem = getProviderEcosystem(group.ecosystem);
    const paths = uniqueSorted(group.dependencies.map((dependency) => dependency.sourceFile));
    const bestDependency = chooseBestDependency(group.dependencies);

    if (!providerEcosystem) {
      isPartial = true;
      continue;
    }

    if (!bestDependency) {
      warningDetails.push(
        createAnalysisWarning({
          code: "DECLARATION_ONLY_VERSION",
          message: `Declaration-only advisory coverage for ${group.packageName} in ${paths.join(", ")}; no exact resolved version was available.`,
          paths,
          source: group.packageName,
          stage: "advisory"
        })
      );
      isPartial = true;
      continue;
    }

    const distinctVersions = uniqueSorted(
      group.dependencies
        .map((dependency) => extractConcreteVersion(dependency))
        .filter((version): version is string => version !== null)
    );

    if (distinctVersions.length > 1) {
      warningDetails.push(
        createAnalysisWarning({
          code: "MULTIPLE_RESOLVED_VERSIONS",
          message: `Multiple resolved versions detected for ${group.packageName} in ${paths.join(", ")}; using ${bestDependency.version} for advisory lookup.`,
          paths,
          source: group.packageName,
          stage: "advisory"
        })
      );
      isPartial = true;
    }

    targets.push({
      confidence: bestDependency.dependency.parseConfidence,
      dependencyType: bestDependency.dependency.dependencyType,
      ecosystem: group.ecosystem,
      hasLockfileEvidence: group.dependencies.some((dependency) =>
        isLockfileSource(dependency.sourceFile)
      ),
      isDirect: group.isDirect,
      packageManager: bestDependency.dependency.packageManager,
      packageName: group.packageName,
      paths,
      query: {
        ecosystem: group.ecosystem,
        key: buildAdvisoryQueryKey(
          group.ecosystem,
          group.packageName,
          bestDependency.version
        ),
        packageName: group.packageName,
        version: bestDependency.version
      },
      sourceFile: bestDependency.dependency.sourceFile,
      version: bestDependency.version,
      workspacePath: bestDependency.dependency.workspacePath
    });
  }

  return {
    isPartial,
    targets: targets.sort((left, right) => left.query.key.localeCompare(right.query.key)),
    warningDetails,
    warnings: getWarningMessages(warningDetails)
  };
}
