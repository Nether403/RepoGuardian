import type {
  AnalysisWarning,
  DetectedEcosystem,
  DetectedLockfile,
  DetectedManifest,
  EcosystemDetection,
  EcosystemId,
  ManifestCountByEcosystem,
  PackageManagerId
} from "@repo-guardian/shared-types";
import {
  createAnalysisWarning,
  EcosystemDetectionSchema,
  getWarningMessages
} from "@repo-guardian/shared-types";
import type { RawDetectionFiles } from "./detect-files.js";
import {
  dirname,
  ecosystemDisplayNames,
  getPackageManagerForLockfile,
  getPackageManagerForManifest,
  manifestLockfilePairs,
  packageManagerDisplayNames
} from "./signals.js";

type EcosystemBucket = {
  ecosystem: EcosystemId;
  lockfiles: Set<string>;
  manifests: Set<string>;
  packageManagers: Set<PackageManagerId>;
};

function sortStrings(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function createBuckets(
  manifests: DetectedManifest[],
  lockfiles: DetectedLockfile[]
): Map<EcosystemId, EcosystemBucket> {
  const buckets = new Map<EcosystemId, EcosystemBucket>();

  function ensureBucket(ecosystem: EcosystemId): EcosystemBucket {
    const existing = buckets.get(ecosystem);
    if (existing) {
      return existing;
    }

    const created: EcosystemBucket = {
      ecosystem,
      lockfiles: new Set<string>(),
      manifests: new Set<string>(),
      packageManagers: new Set<PackageManagerId>()
    };
    buckets.set(ecosystem, created);
    return created;
  }

  for (const manifest of manifests) {
    const bucket = ensureBucket(manifest.ecosystem);
    bucket.manifests.add(manifest.path);

    const packageManager = getPackageManagerForManifest(manifest);
    if (packageManager) {
      bucket.packageManagers.add(packageManager);
    }
  }

  for (const lockfile of lockfiles) {
    const bucket = ensureBucket(lockfile.ecosystem);
    bucket.lockfiles.add(lockfile.path);
    bucket.packageManagers.add(getPackageManagerForLockfile(lockfile));
  }

  return buckets;
}

function createDetectedEcosystems(
  buckets: Map<EcosystemId, EcosystemBucket>
): DetectedEcosystem[] {
  return [...buckets.values()]
    .map((bucket) => ({
      ecosystem: bucket.ecosystem,
      lockfiles: sortStrings(bucket.lockfiles),
      manifests: sortStrings(bucket.manifests),
      packageManagers: [...bucket.packageManagers].sort((left, right) =>
        left.localeCompare(right)
      )
    }))
    .sort((left, right) => left.ecosystem.localeCompare(right.ecosystem));
}

function createManifestCounts(
  ecosystems: DetectedEcosystem[],
  manifests: DetectedManifest[],
  lockfiles: DetectedLockfile[]
): {
  byEcosystem: ManifestCountByEcosystem[];
  totalLockfiles: number;
  totalManifests: number;
} {
  return {
    byEcosystem: ecosystems.map((ecosystem) => ({
      ecosystem: ecosystem.ecosystem,
      lockfiles: ecosystem.lockfiles.length,
      manifests: ecosystem.manifests.length
    })),
    totalLockfiles: lockfiles.length,
    totalManifests: manifests.length
  };
}

function createManifestWithoutLockfileWarnings(
  manifests: DetectedManifest[],
  lockfiles: DetectedLockfile[]
): AnalysisWarning[] {
  const lockfilesByDirectory = new Map<string, Set<DetectedLockfile["kind"]>>();

  for (const lockfile of lockfiles) {
    const directory = dirname(lockfile.path);
    const knownLockfiles = lockfilesByDirectory.get(directory) ?? new Set();
    knownLockfiles.add(lockfile.kind);
    lockfilesByDirectory.set(directory, knownLockfiles);
  }

  const warnings: AnalysisWarning[] = [];

  for (const manifest of manifests) {
    const expectedPair = manifestLockfilePairs[manifest.kind];

    if (!expectedPair) {
      continue;
    }

    const lockfilesInDirectory = lockfilesByDirectory.get(dirname(manifest.path));
    const hasMatchingLockfile = expectedPair.lockfiles.some((lockfileKind) =>
      lockfilesInDirectory?.has(lockfileKind)
    );

    if (!hasMatchingLockfile) {
      warnings.push(
        createAnalysisWarning({
          code: "MANIFEST_WITHOUT_LOCKFILE",
          message: `Manifest without lockfile: ${manifest.path}`,
          paths: [manifest.path],
          source: manifest.kind,
          stage: "detection"
        })
      );
    }
  }

  return warnings.sort((left, right) => left.message.localeCompare(right.message));
}

function createMultiplePackageManagerWarnings(
  ecosystems: DetectedEcosystem[]
): string[] {
  return ecosystems
    .filter((ecosystem) => ecosystem.packageManagers.length > 1)
    .map((ecosystem) => {
      const packageManagers = ecosystem.packageManagers.map(
        (packageManager) => packageManagerDisplayNames[packageManager]
      );

      return `Multiple ${ecosystemDisplayNames[ecosystem.ecosystem]} package managers detected: ${packageManagers.join(", ")}.`;
    })
    .sort((left, right) => left.localeCompare(right));
}

function createMonorepoWarning(manifests: DetectedManifest[]): string[] {
  const manifestDirectories = new Set(manifests.map((manifest) => dirname(manifest.path)));
  const hasNestedDirectory = [...manifestDirectories].some(
    (directory) => directory.length > 0
  );

  if (manifestDirectories.size > 1 && hasNestedDirectory) {
    return [
      `Likely monorepo structure: manifests detected across ${manifestDirectories.size} directories.`
    ];
  }

  return [];
}

export function inferEcosystems(detectionFiles: RawDetectionFiles): EcosystemDetection {
  const manifests = [...detectionFiles.manifests].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
  const lockfiles = [...detectionFiles.lockfiles].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
  const signals = [...detectionFiles.signals].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
  const ecosystems = createDetectedEcosystems(createBuckets(manifests, lockfiles));
  const warningDetails = createManifestWithoutLockfileWarnings(manifests, lockfiles);
  const warnings = [
    ...getWarningMessages(warningDetails),
    ...createMultiplePackageManagerWarnings(ecosystems),
    ...createMonorepoWarning(manifests)
  ];

  if (manifests.length === 0 && lockfiles.length === 0) {
    warnings.push("No supported manifests or lockfiles were detected in the fetched tree.");
  }

  return EcosystemDetectionSchema.parse({
    ecosystems,
    lockfiles,
    manifestCounts: createManifestCounts(ecosystems, manifests, lockfiles),
    manifests,
    signals,
    warningDetails,
    warnings
  });
}
