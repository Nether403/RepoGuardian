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
  createCodeReviewResult,
  selectReviewTargets,
  type ReviewFile,
  type ReviewTarget,
  type CodeReviewResult,
  type SkippedReviewFile
} from "@repo-guardian/review";
import {
  AnalyzeRepoResponseSchema,
  createAnalysisWarning,
  dedupeAnalysisWarnings,
  getWarningMessages,
  type AnalysisWarning,
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

function mergeWarningDetails(
  intake: RepositoryIntakeSnapshot,
  detection: EcosystemDetection,
  dependencySnapshot: DependencySnapshot,
  dependencyFindings: DependencyFindingResult,
  codeReview: CodeReviewResult
): AnalysisWarning[] {
  return dedupeAnalysisWarnings([
    ...intake.warningDetails,
    ...detection.warningDetails,
    ...dependencySnapshot.parseWarningDetails,
    ...dependencyFindings.warningDetails,
    ...codeReview.warningDetails
  ]);
}

function mergeWarnings(
  warningDetails: AnalysisWarning[],
  intake: RepositoryIntakeSnapshot,
  detection: EcosystemDetection,
  dependencySnapshot: DependencySnapshot,
  dependencyFindings: DependencyFindingResult,
  codeReview: CodeReviewResult
): string[] {
  return uniqueSorted([
    ...getWarningMessages(warningDetails),
    ...intake.warnings,
    ...detection.warnings,
    ...dependencySnapshot.parseWarnings,
    ...dependencyFindings.warnings,
    ...codeReview.warnings
  ]);
}

function isBinaryContent(content: string): boolean {
  return content.includes("\0");
}

function exceedsReviewSizeLimit(content: string): boolean {
  return content.length > 200_000;
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
  prefetchWarningDetails: AnalysisWarning[];
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
  const prefetchWarningDetails: AnalysisWarning[] = [];
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
        prefetchWarningDetails.push(
          createAnalysisWarning({
            code: "FILE_FETCH_SKIPPED",
            message: reason,
            paths: [file.path],
            source: file.kind,
            stage: "dependency-parse"
          })
        );
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
    prefetchWarningDetails,
    skippedFiles
  };
}

async function fetchReviewFiles(
  readClient: GitHubReadClient,
  repository: RepositoryMetadata,
  targets: ReviewTarget[]
): Promise<{
  reviewedFiles: ReviewFile[];
  skippedFiles: SkippedReviewFile[];
}> {
  const reviewedFiles: ReviewFile[] = [];
  const skippedFiles: SkippedReviewFile[] = [];

  for (const target of targets) {
    try {
      const content = await readClient.fetchRepositoryFileText({
        owner: repository.owner,
        path: target.path,
        ref: repository.defaultBranch,
        repo: repository.repo
      });

      if (isBinaryContent(content)) {
        skippedFiles.push({
          ...target,
          reason: `Skipped ${target.path} during review: file content appears to be binary.`
        });
        continue;
      }

      if (exceedsReviewSizeLimit(content)) {
        skippedFiles.push({
          ...target,
          reason: `Skipped ${target.path} during review: file content exceeded the review size limit.`
        });
        continue;
      }

      reviewedFiles.push({
        ...target,
        content
      });
    } catch (error) {
      if (!isGitHubReadError(error)) {
        throw error;
      }

      skippedFiles.push({
        ...target,
        reason: `Skipped ${target.path} during review: ${error.message}`
      });
    }
  }

  return {
    reviewedFiles,
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
    prefetchWarningDetails: dependencyFiles.prefetchWarningDetails,
    skippedFiles: dependencyFiles.skippedFiles
  });
  const dependencyFindings = await createDependencyFindingResult(
    dependencySnapshot,
    advisoryProvider
  );
  const reviewSelection = selectReviewTargets({
    dependencyFindingPaths: uniqueSorted(
      dependencyFindings.findings.flatMap((finding) => finding.paths)
    ),
    signals: detection.signals,
    treeEntries: intake.treeEntries
  });
  const reviewFiles = await fetchReviewFiles(
    readClient,
    intake.repository,
    reviewSelection.targets
  );
  const codeReview = createCodeReviewResult({
    reviewedFiles: reviewFiles.reviewedFiles,
    selection: reviewSelection,
    skippedFiles: reviewFiles.skippedFiles
  });
  const warningDetails = mergeWarningDetails(
    intake,
    detection,
    dependencySnapshot,
    dependencyFindings,
    codeReview
  );
  const isPartial =
    intake.isPartial ||
    dependencySnapshot.isPartial ||
    dependencyFindings.isPartial ||
    codeReview.coverage.isPartial;

  return AnalyzeRepoResponseSchema.parse({
    codeReviewFindingSummary: codeReview.summary,
    codeReviewFindings: codeReview.findings,
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
    reviewCoverage: codeReview.coverage,
    warningDetails,
    warnings: mergeWarnings(
      warningDetails,
      intake,
      detection,
      dependencySnapshot,
      dependencyFindings,
      codeReview
    )
  });
}
