import type {
  AnalysisWarning,
  AnalysisWarningCode,
  DependencySnapshot,
  DependencySnapshotSummary,
  DependencyType,
  DetectedLockfile,
  DetectedManifest,
  EcosystemDetection,
  EcosystemId,
  LockfileKind,
  ManifestKind,
  NormalizedDependency,
  PackageManagerId,
  ParseConfidence,
  ParsedDependencyFile,
  SkippedDependencyFile
} from "@repo-guardian/shared-types";
import {
  createAnalysisWarning,
  dedupeAnalysisWarnings,
  getWarningMessages,
  hasCoverageWarnings
} from "@repo-guardian/shared-types";

export type SupportedManifestKind =
  | "package.json"
  | "requirements.txt"
  | "pyproject.toml";

export type SupportedLockfileKind =
  | "package-lock.json"
  | "pnpm-lock.yaml"
  | "poetry.lock";

export type SupportedDependencyFile =
  | DetectedManifest
  | DetectedLockfile;

export type FetchedDependencyFile = SupportedDependencyFile & {
  content: string;
};

export type ParserWarning = {
  message: string;
  path: string;
};

export type ParserResult = {
  dependencies: NormalizedDependency[];
  packageManager: PackageManagerId | null;
  warningDetails: AnalysisWarning[];
};

export type ParseContext = {
  directDependencyNames: Set<string>;
  lockfilesByWorkspace: Map<string, DetectedLockfile[]>;
};

type DependencyLike = {
  dependencyType: DependencyType;
  ecosystem: EcosystemId;
  isDirect: boolean;
  name: string;
  packageManager: PackageManagerId | null;
  parseConfidence: ParseConfidence;
  sourceFile: string;
  version: string | null;
  workspacePath: string | null;
};

function hasOwnProperty<RecordKey extends string>(
  value: Record<RecordKey, unknown>,
  key: string
): key is RecordKey {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function basename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

export function dirname(path: string): string {
  const segments = path.split("/");
  segments.pop();
  return segments.join("/");
}

export function normalizeWorkspacePath(path: string): string {
  const directory = dirname(path);
  return directory.length > 0 ? directory : ".";
}

export function normalizeDependencyName(name: string): string {
  return name.trim().toLowerCase();
}

export function sortStrings(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function sortDependencies(
  dependencies: NormalizedDependency[]
): NormalizedDependency[] {
  return [...dependencies].sort((left, right) => {
    const leftKey = [
      left.ecosystem,
      left.workspacePath ?? "",
      left.sourceFile,
      left.name,
      left.version ?? ""
    ].join(":");
    const rightKey = [
      right.ecosystem,
      right.workspacePath ?? "",
      right.sourceFile,
      right.name,
      right.version ?? ""
    ].join(":");

    return leftKey.localeCompare(rightKey);
  });
}

export function dedupeDependencies(
  dependencies: NormalizedDependency[]
): NormalizedDependency[] {
  const deduped = new Map<string, NormalizedDependency>();

  for (const dependency of dependencies) {
    const key = [
      dependency.ecosystem,
      dependency.packageManager ?? "",
      dependency.name,
      dependency.version ?? "",
      dependency.dependencyType,
      dependency.isDirect ? "1" : "0",
      dependency.sourceFile,
      dependency.workspacePath ?? "",
      dependency.parseConfidence
    ].join(":");

    deduped.set(key, dependency);
  }

  return sortDependencies([...deduped.values()]);
}

export function createDependency(
  dependency: DependencyLike
): NormalizedDependency {
  return {
    dependencyType: dependency.dependencyType,
    ecosystem: dependency.ecosystem,
    isDirect: dependency.isDirect,
    name: normalizeDependencyName(dependency.name),
    packageManager: dependency.packageManager,
    parseConfidence: dependency.parseConfidence,
    sourceFile: dependency.sourceFile,
    version: dependency.version,
    workspacePath: dependency.workspacePath
  };
}

export function createParsedFile(
  file: SupportedDependencyFile,
  dependencyCount: number,
  packageManager: PackageManagerId | null
): ParsedDependencyFile {
  return {
    dependencyCount,
    ecosystem: file.ecosystem,
    kind: file.kind,
    packageManager,
    path: file.path
  };
}

export function createSkippedFile(
  file: DetectedManifest | DetectedLockfile,
  reason: string
): SkippedDependencyFile {
  return {
    ecosystem: file.ecosystem,
    kind: file.kind,
    path: file.path,
    reason
  };
}

export function createFileKey(path: string, kind: string): string {
  return `${kind}:${path}`;
}

export function createDependencyParseWarning(input: {
  code: AnalysisWarningCode;
  message: string;
  path?: string;
  source?: string | null;
}): AnalysisWarning {
  return createAnalysisWarning({
    code: input.code,
    message: input.message,
    paths: input.path ? [input.path] : [],
    source: input.source ?? null,
    stage: "dependency-parse"
  });
}

const supportedManifestKinds = new Set<SupportedManifestKind>([
  "package.json",
  "pyproject.toml",
  "requirements.txt"
]);

const supportedLockfileKinds = new Set<SupportedLockfileKind>([
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock"
]);

export function isSupportedManifestKind(kind: ManifestKind): kind is SupportedManifestKind {
  return supportedManifestKinds.has(kind as SupportedManifestKind);
}

export function isSupportedLockfileKind(kind: LockfileKind): kind is SupportedLockfileKind {
  return supportedLockfileKinds.has(kind as SupportedLockfileKind);
}

export function listDependencyFilesToFetch(
  detection: EcosystemDetection
): SupportedDependencyFile[] {
  return [
    ...detection.manifests.filter((manifest) => isSupportedManifestKind(manifest.kind)),
    ...detection.lockfiles.filter((lockfile) => isSupportedLockfileKind(lockfile.kind))
  ].sort((left, right) => left.path.localeCompare(right.path));
}

export function createUnsupportedFileWarnings(
  detection: EcosystemDetection
): {
  filesSkipped: SkippedDependencyFile[];
  warningDetails: AnalysisWarning[];
} {
  const filesSkipped: SkippedDependencyFile[] = [];
  const warningDetails: AnalysisWarning[] = [];

  for (const manifest of detection.manifests) {
    if (isSupportedManifestKind(manifest.kind)) {
      continue;
    }

    const reason = `Detected ${manifest.kind} but parsing is not supported in Milestone 2A.`;
    filesSkipped.push(createSkippedFile(manifest, reason));
    warningDetails.push(
      createDependencyParseWarning({
        code: "UNSUPPORTED_FILE_KIND",
        message: reason,
        path: manifest.path,
        source: manifest.kind
      })
    );
  }

  for (const lockfile of detection.lockfiles) {
    if (isSupportedLockfileKind(lockfile.kind)) {
      continue;
    }

    const reason = `Detected ${lockfile.kind} but parsing is not supported in Milestone 2A.`;
    filesSkipped.push(createSkippedFile(lockfile, reason));
    warningDetails.push(
      createDependencyParseWarning({
        code: "UNSUPPORTED_FILE_KIND",
        message: reason,
        path: lockfile.path,
        source: lockfile.kind
      })
    );
  }

  return {
    filesSkipped,
    warningDetails
  };
}

export function createLockfileWithoutManifestWarnings(
  detection: EcosystemDetection
): AnalysisWarning[] {
  const manifestDirectories = new Map<EcosystemId, Set<string>>();

  for (const manifest of detection.manifests) {
    const knownDirectories = manifestDirectories.get(manifest.ecosystem) ?? new Set<string>();
    knownDirectories.add(normalizeWorkspacePath(manifest.path));
    manifestDirectories.set(manifest.ecosystem, knownDirectories);
  }

  const warnings: AnalysisWarning[] = [];

  for (const lockfile of detection.lockfiles) {
    const workspacePath = normalizeWorkspacePath(lockfile.path);
    const knownDirectories = manifestDirectories.get(lockfile.ecosystem);

    if (!knownDirectories?.has(workspacePath)) {
      warnings.push(
        createDependencyParseWarning({
          code: "LOCKFILE_WITHOUT_MANIFEST",
          message: `Lockfile without matching manifest: ${lockfile.path}`,
          path: lockfile.path,
          source: lockfile.kind
        })
      );
    }
  }

  return warnings.sort((left, right) => left.message.localeCompare(right.message));
}

const lockfilePackageManagers: Record<SupportedLockfileKind, PackageManagerId> = {
  "package-lock.json": "npm",
  "pnpm-lock.yaml": "pnpm",
  "poetry.lock": "poetry"
};

export function getPackageManagerForSupportedLockfile(
  kind: SupportedLockfileKind
): PackageManagerId {
  return lockfilePackageManagers[kind];
}

export function inferNodeManifestPackageManager(
  context: ParseContext,
  path: string
): PackageManagerId | null {
  const matchingLockfiles = context.lockfilesByWorkspace.get(normalizeWorkspacePath(path)) ?? [];
  const nodePackageManagers = new Set<PackageManagerId>();

  for (const lockfile of matchingLockfiles) {
    if (lockfile.ecosystem !== "node") {
      continue;
    }

    if (hasOwnProperty(lockfilePackageManagers, lockfile.kind)) {
      nodePackageManagers.add(lockfilePackageManagers[lockfile.kind as SupportedLockfileKind]);
    }
  }

  if (nodePackageManagers.size === 1) {
    return [...nodePackageManagers][0] ?? null;
  }

  return null;
}

export function buildLockfilesByWorkspace(
  detection: EcosystemDetection
): Map<string, DetectedLockfile[]> {
  const lockfilesByWorkspace = new Map<string, DetectedLockfile[]>();

  for (const lockfile of detection.lockfiles) {
    const workspacePath = normalizeWorkspacePath(lockfile.path);
    const matchingLockfiles = lockfilesByWorkspace.get(workspacePath) ?? [];
    matchingLockfiles.push(lockfile);
    lockfilesByWorkspace.set(workspacePath, matchingLockfiles);
  }

  return lockfilesByWorkspace;
}

export function createDirectDependencyIndexKey(
  ecosystem: EcosystemId,
  workspacePath: string
): string {
  return `${ecosystem}:${workspacePath}`;
}

export function indexDirectDependencies(
  index: Map<string, Set<string>>,
  dependencies: NormalizedDependency[]
): void {
  for (const dependency of dependencies) {
    if (!dependency.isDirect) {
      continue;
    }

    const workspacePath = dependency.workspacePath ?? ".";
    const key = createDirectDependencyIndexKey(dependency.ecosystem, workspacePath);
    const knownDependencies = index.get(key) ?? new Set<string>();
    knownDependencies.add(dependency.name);
    index.set(key, knownDependencies);
  }
}

export function getDirectDependencyNames(
  index: Map<string, Set<string>>,
  ecosystem: EcosystemId,
  workspacePath: string
): Set<string> {
  return index.get(createDirectDependencyIndexKey(ecosystem, workspacePath)) ?? new Set();
}

export function uniqueWarnings(warnings: string[]): string[] {
  return sortStrings(new Set(warnings.filter((warning) => warning.trim().length > 0)));
}

export function createDependencySummary(
  dependencies: NormalizedDependency[],
  filesParsed: ParsedDependencyFile[],
  filesSkipped: SkippedDependencyFile[]
): DependencySnapshotSummary {
  const byEcosystem = new Map<
    EcosystemId,
    {
      directDependencies: number;
      totalDependencies: number;
    }
  >();

  for (const dependency of dependencies) {
    const counts = byEcosystem.get(dependency.ecosystem) ?? {
      directDependencies: 0,
      totalDependencies: 0
    };

    counts.totalDependencies += 1;

    if (dependency.isDirect) {
      counts.directDependencies += 1;
    }

    byEcosystem.set(dependency.ecosystem, counts);
  }

  return {
    byEcosystem: [...byEcosystem.entries()]
      .map(([ecosystem, counts]) => ({
        directDependencies: counts.directDependencies,
        ecosystem,
        totalDependencies: counts.totalDependencies
      }))
      .sort((left, right) => left.ecosystem.localeCompare(right.ecosystem)),
    directDependencies: dependencies.filter((dependency) => dependency.isDirect).length,
    parsedFileCount: filesParsed.length,
    skippedFileCount: filesSkipped.length,
    totalDependencies: dependencies.length,
    transitiveDependencies: dependencies.filter((dependency) => !dependency.isDirect).length
  };
}

export function uniqueWarningDetails(warnings: AnalysisWarning[]): AnalysisWarning[] {
  return dedupeAnalysisWarnings(warnings);
}

export function getWarningMessagesFromDetails(warnings: AnalysisWarning[]): string[] {
  return getWarningMessages(uniqueWarningDetails(warnings));
}

export function hasPartialCoverageWarnings(warnings: AnalysisWarning[]): boolean {
  return hasCoverageWarnings(uniqueWarningDetails(warnings));
}

export function createEmptyDependencySnapshot(): DependencySnapshot {
  return {
    dependencies: [],
    filesParsed: [],
    filesSkipped: [],
    isPartial: false,
    parseWarningDetails: [],
    parseWarnings: [],
    summary: {
      byEcosystem: [],
      directDependencies: 0,
      parsedFileCount: 0,
      skippedFileCount: 0,
      totalDependencies: 0,
      transitiveDependencies: 0
    }
  };
}
