import {
  DependencySnapshotSchema,
  type AnalysisWarning,
  type DependencySnapshot,
  type EcosystemDetection,
  type NormalizedDependency,
  type ParsedDependencyFile,
  type SkippedDependencyFile
} from "@repo-guardian/shared-types";
import { parseCargoLock } from "./cargo-lock.js";
import { parseCargoToml } from "./cargo-toml.js";
import { parseGemfile } from "./gemfile.js";
import { parseGemfileLock } from "./gemfile-lock.js";
import { parseGoMod } from "./go-mod.js";
import { parseGoSum } from "./go-sum.js";
import { parsePackageJson } from "./package-json.js";
import { parsePackageLockJson } from "./package-lock.js";
import { parsePipfile } from "./pipfile.js";
import { parsePipfileLock } from "./pipfile-lock.js";
import { parsePnpmLockYaml } from "./pnpm-lock.js";
import { parsePoetryLock } from "./poetry-lock.js";
import { parsePomXml } from "./pom-xml.js";
import { parsePyprojectToml } from "./pyproject.js";
import { parseRequirementsTxt } from "./requirements.js";
import { parseGradleBuildFile } from "./gradle-build.js";
import { parseGradleLockfile } from "./gradle-lockfile.js";
import { parseYarnLock } from "./yarn-lock.js";
import {
  buildLockfilesByWorkspace,
  createDependencySummary,
  createEmptyDependencySnapshot,
  createFileKey,
  createLockfileWithoutManifestWarnings,
  createParsedFile,
  createDependencyParseWarning,
  createSkippedFile,
  createUnsupportedFileWarnings,
  dedupeDependencies,
  getDirectDependencyNames,
  getWarningMessagesFromDetails,
  hasPartialCoverageWarnings,
  indexDirectDependencies,
  listDependencyFilesToFetch,
  normalizeWorkspacePath,
  uniqueWarningDetails,
  type FetchedDependencyFile,
  type ParseContext,
  type ParserResult,
  type SupportedDependencyFile
} from "./utils.js";

type CreateDependencySnapshotOptions = {
  detection: EcosystemDetection;
  fetchedFiles: FetchedDependencyFile[];
  prefetchWarnings?: string[];
  prefetchWarningDetails?: AnalysisWarning[];
  skippedFiles?: SkippedDependencyFile[];
};

function parseFile(
  file: SupportedDependencyFile,
  content: string,
  context: ParseContext
): ParserResult {
  switch (file.kind) {
    case "Cargo.toml":
      return parseCargoToml(file, content);
    case "Cargo.lock":
      return parseCargoLock(file, content, context);
    case "Gemfile":
      return parseGemfile(file, content);
    case "Gemfile.lock":
      return parseGemfileLock(file, content, context);
    case "Pipfile":
      return parsePipfile(file, content);
    case "Pipfile.lock":
      return parsePipfileLock(file, content, context);
    case "build.gradle":
    case "build.gradle.kts":
      return parseGradleBuildFile(file, content);
    case "go.mod":
      return parseGoMod(file, content);
    case "go.sum":
      return parseGoSum(file, content, context);
    case "package.json":
      return parsePackageJson(file, content, context);
    case "package-lock.json":
      return parsePackageLockJson(file, content, context);
    case "pnpm-lock.yaml":
      return parsePnpmLockYaml(file, content);
    case "pom.xml":
      return parsePomXml(file, content);
    case "requirements.txt":
      return parseRequirementsTxt(file, content);
    case "pyproject.toml":
      return parsePyprojectToml(file, content, context);
    case "poetry.lock":
      return parsePoetryLock(file, content, context);
    case "gradle.lockfile":
      return parseGradleLockfile(file, content, context);
    case "yarn.lock":
      return parseYarnLock(file, content, context);
    default:
      throw new Error("Detected an unsupported dependency file kind.");
  }
}

export function createDependencySnapshot(
  options: CreateDependencySnapshotOptions
): DependencySnapshot {
  const supportedFiles = listDependencyFilesToFetch(options.detection);

  if (supportedFiles.length === 0 && options.detection.manifests.length === 0) {
    return createEmptyDependencySnapshot();
  }

  const { filesSkipped: unsupportedFiles, warningDetails: unsupportedWarningDetails } =
    createUnsupportedFileWarnings(options.detection);
  const fetchedFilesByKey = new Map(
    options.fetchedFiles.map((file) => [createFileKey(file.path, file.kind), file])
  );
  const providedSkippedFiles = options.skippedFiles ?? [];
  const skippedFilesByKey = new Map(
    [...unsupportedFiles, ...providedSkippedFiles].map((file) => [
      createFileKey(file.path, file.kind),
      file
    ])
  );
  const lockfilesByWorkspace = buildLockfilesByWorkspace(options.detection);
  const directDependencyIndex = new Map<string, Set<string>>();
  const dependencies: NormalizedDependency[] = [];
  const filesParsed: ParsedDependencyFile[] = [];
  const filesSkipped: SkippedDependencyFile[] = [...unsupportedFiles, ...providedSkippedFiles];
  const parseWarningDetails: AnalysisWarning[] = [
    ...(options.detection.warningDetails ?? []),
    ...createLockfileWithoutManifestWarnings(options.detection),
    ...unsupportedWarningDetails,
    ...(options.prefetchWarningDetails ?? [])
  ];

  for (const file of supportedFiles.sort((left, right) => {
    const leftRank = left.kind.includes("lock") ? 1 : 0;
    const rightRank = right.kind.includes("lock") ? 1 : 0;
    return leftRank === rightRank
      ? left.path.localeCompare(right.path)
      : leftRank - rightRank;
  })) {
    const fileKey = createFileKey(file.path, file.kind);

    if (skippedFilesByKey.has(fileKey)) {
      continue;
    }

    const fetchedFile = fetchedFilesByKey.get(fileKey);

    if (!fetchedFile) {
      const skippedFile = createSkippedFile(
        file,
        `Skipped ${file.path}: file content was not fetched.`
      );

      filesSkipped.push(skippedFile);
      parseWarningDetails.push(
        createDependencyParseWarning({
          code: "FILE_FETCH_SKIPPED",
          message: skippedFile.reason,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    const workspacePath = normalizeWorkspacePath(file.path);
    const context: ParseContext = {
      directDependencyNames: getDirectDependencyNames(
        directDependencyIndex,
        file.ecosystem,
        workspacePath
      ),
      lockfilesByWorkspace
    };

    try {
      const result = parseFile(file, fetchedFile.content, context);
      dependencies.push(...result.dependencies);
      indexDirectDependencies(directDependencyIndex, result.dependencies);
      filesParsed.push(
        createParsedFile(file, result.dependencies.length, result.packageManager)
      );
      parseWarningDetails.push(...result.warningDetails);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : `Could not parse ${file.path}.`;
      const skippedFile = createSkippedFile(file, reason);

      filesSkipped.push(skippedFile);
      parseWarningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: reason,
          path: file.path,
          source: file.kind
        })
      );
    }
  }

  const dedupedDependencies = dedupeDependencies(dependencies);
  const dedupedWarningDetails = uniqueWarningDetails(parseWarningDetails);
  const dedupedWarnings = getWarningMessagesFromDetails(dedupedWarningDetails);

  return DependencySnapshotSchema.parse({
    dependencies: dedupedDependencies,
    filesParsed,
    filesSkipped: filesSkipped.sort((left, right) =>
      left.path.localeCompare(right.path)
    ),
    isPartial: filesSkipped.length > 0 || hasPartialCoverageWarnings(dedupedWarningDetails),
    parseWarningDetails: dedupedWarningDetails,
    parseWarnings: dedupedWarnings,
    summary: createDependencySummary(dedupedDependencies, filesParsed, filesSkipped)
  });
}
