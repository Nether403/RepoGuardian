import {
  createDependencyFindingResult,
  OsvAdvisoryProvider,
  type DependencyFindingResult
} from "@repo-guardian/advisory";
import { createDependencySnapshot, listDependencyFilesToFetch } from "@repo-guardian/dependencies";
import { detectRepositoryStructure } from "@repo-guardian/ecosystems";
import {
  GitHubReadClient,
  isGitHubReadError,
  normalizeRepoInput
} from "@repo-guardian/github";
import {
  AnalyzeRepoResponseSchema,
  type AnalyzeRepoResponse,
  type DependencySnapshot,
  type EcosystemDetection,
  type RepositoryMetadata,
  type RepositoryIntakeSnapshot,
  type RepositoryTreeEntry
} from "@repo-guardian/shared-types";

const advisoryProvider = new OsvAdvisoryProvider();

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildSamplePaths(
  intake: RepositoryIntakeSnapshot,
  detection: EcosystemDetection
): string[] {
  const notablePaths = [
    ...detection.manifests.map((manifest) => manifest.path),
    ...detection.lockfiles.map((lockfile) => lockfile.path),
    ...detection.signals.map((signal) => signal.path)
  ];

  if (notablePaths.length > 0) {
    return uniqueSorted(notablePaths).slice(0, 8);
  }

  const fallbackPaths = intake.treeEntries
    .filter((entry): entry is RepositoryTreeEntry => entry.kind === "file")
    .map((entry) => entry.path);

  return uniqueSorted(fallbackPaths).slice(0, 8);
}

function mergeWarnings(
  intake: RepositoryIntakeSnapshot,
  detection: EcosystemDetection,
  dependencySnapshot: DependencySnapshot,
  dependencyFindings: DependencyFindingResult
): string[] {
  return uniqueSorted([
    ...intake.warnings,
    ...detection.warnings,
    ...dependencySnapshot.parseWarnings,
    ...dependencyFindings.warnings
  ]);
}

async function fetchDependencyFiles(
  readClient: GitHubReadClient,
  repository: RepositoryMetadata,
  detection: EcosystemDetection
): Promise<{
  fetchedFiles: Array<
    ReturnType<typeof listDependencyFilesToFetch>[number] & { content: string }
  >;
  prefetchWarnings: string[];
  skippedFiles: Array<{
    ecosystem: ReturnType<typeof listDependencyFilesToFetch>[number]["ecosystem"];
    kind: ReturnType<typeof listDependencyFilesToFetch>[number]["kind"];
    path: string;
    reason: string;
  }>;
}> {
  const fetchedFiles: Array<
    ReturnType<typeof listDependencyFilesToFetch>[number] & { content: string }
  > = [];
  const prefetchWarnings: string[] = [];
  const skippedFiles: Array<{
    ecosystem: ReturnType<typeof listDependencyFilesToFetch>[number]["ecosystem"];
    kind: ReturnType<typeof listDependencyFilesToFetch>[number]["kind"];
    path: string;
    reason: string;
  }> = [];

  for (const file of listDependencyFilesToFetch(detection)) {
    try {
      const content = await readClient.fetchRepositoryFileText({
        owner: repository.owner,
        path: file.path,
        ref: repository.defaultBranch,
        repo: repository.repo
      });

      fetchedFiles.push({
        ...file,
        content
      });
    } catch (error) {
      if (!isGitHubReadError(error)) {
        throw error;
      }

      if (error.code === "not_found" || error.code === "upstream_invalid_response") {
        const reason = `Skipped ${file.path}: ${error.message}`;
        prefetchWarnings.push(reason);
        skippedFiles.push({
          ecosystem: file.ecosystem,
          kind: file.kind,
          path: file.path,
          reason
        });
        continue;
      }

      throw error;
    }
  }

  return {
    fetchedFiles,
    prefetchWarnings,
    skippedFiles
  };
}

export async function analyzeRepository(
  readClient: GitHubReadClient,
  repoInput: string
): Promise<AnalyzeRepoResponse> {
  const normalizedInput = normalizeRepoInput(repoInput);
  const intake = await readClient.fetchRepositoryIntake(normalizedInput);
  const detection = detectRepositoryStructure(intake.treeEntries);
  const dependencyFiles = await fetchDependencyFiles(
    readClient,
    intake.repository,
    detection
  );
  const dependencySnapshot = createDependencySnapshot({
    detection,
    fetchedFiles: dependencyFiles.fetchedFiles,
    prefetchWarnings: dependencyFiles.prefetchWarnings,
    skippedFiles: dependencyFiles.skippedFiles
  });
  const dependencyFindings = await createDependencyFindingResult(
    dependencySnapshot,
    advisoryProvider
  );
  const isPartial =
    intake.isPartial || dependencySnapshot.isPartial || dependencyFindings.isPartial;

  return AnalyzeRepoResponseSchema.parse({
    dependencyFindingSummary: dependencyFindings.summary,
    dependencyFindings: dependencyFindings.findings,
    detectedFiles: {
      lockfiles: detection.lockfiles.map((lockfile) => ({
        kind: lockfile.kind,
        path: lockfile.path
      })),
      manifests: detection.manifests.map((manifest) => ({
        kind: manifest.kind,
        path: manifest.path
      })),
      signals: detection.signals
    },
    dependencySnapshot,
    ecosystems: detection.ecosystems,
    fetchedAt: intake.fetchedAt,
    isPartial,
    repository: intake.repository,
    treeSummary: {
      samplePaths: buildSamplePaths(intake, detection),
      totalDirectories: intake.treeSummary.directoryCount,
      totalFiles: intake.treeSummary.fileCount,
      truncated: intake.treeSummary.truncated
    },
    warnings: mergeWarnings(
      intake,
      detection,
      dependencySnapshot,
      dependencyFindings
    )
  });
}
