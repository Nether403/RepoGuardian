import { detectRepositoryStructure } from "@repo-guardian/ecosystems";
import { GitHubReadClient, normalizeRepoInput } from "@repo-guardian/github";
import {
  AnalyzeRepoResponseSchema,
  type AnalyzeRepoResponse,
  type EcosystemDetection,
  type RepositoryIntakeSnapshot,
  type RepositoryTreeEntry
} from "@repo-guardian/shared-types";

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
  detection: EcosystemDetection
): string[] {
  return uniqueSorted([...intake.warnings, ...detection.warnings]);
}

export async function analyzeRepository(
  readClient: GitHubReadClient,
  repoInput: string
): Promise<AnalyzeRepoResponse> {
  const normalizedInput = normalizeRepoInput(repoInput);
  const intake = await readClient.fetchRepositoryIntake(normalizedInput);
  const detection = detectRepositoryStructure(intake.treeEntries);

  return AnalyzeRepoResponseSchema.parse({
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
    ecosystems: detection.ecosystems,
    fetchedAt: intake.fetchedAt,
    isPartial: intake.isPartial,
    repository: intake.repository,
    treeSummary: {
      samplePaths: buildSamplePaths(intake, detection),
      totalDirectories: intake.treeSummary.directoryCount,
      totalFiles: intake.treeSummary.fileCount,
      truncated: intake.treeSummary.truncated
    },
    warnings: mergeWarnings(intake, detection)
  });
}
