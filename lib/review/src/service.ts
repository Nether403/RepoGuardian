import type {
  AnalysisWarning,
  CodeReviewFinding,
  CodeReviewFindingSummary,
  ReviewCoverage
} from "@repo-guardian/shared-types";
import {
  createAnalysisWarning,
  dedupeAnalysisWarnings,
  getWarningMessages
} from "@repo-guardian/shared-types";
import { buildCodeReviewFindingSummary } from "./findings.js";
import type { ReviewFile } from "./checks.js";
import { runDeterministicReviewChecks } from "./checks.js";
import type { ReviewSelectionResult, ReviewTarget } from "./select-files.js";

export type SkippedReviewFile = ReviewTarget & {
  reason: string;
};

export type CodeReviewResult = {
  coverage: ReviewCoverage;
  findings: CodeReviewFinding[];
  summary: CodeReviewFindingSummary;
  warningDetails: AnalysisWarning[];
  warnings: string[];
};

type CreateCodeReviewResultOptions = {
  reviewedFiles: ReviewFile[];
  selection: ReviewSelectionResult;
  skippedFiles?: SkippedReviewFile[];
};

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildCoverage(
  selection: ReviewSelectionResult,
  reviewedFiles: ReviewFile[],
  skippedFiles: SkippedReviewFile[]
): ReviewCoverage {
  const selectedPaths = uniqueSorted(selection.targets.map((target) => target.path));
  const skippedPaths = uniqueSorted(skippedFiles.map((file) => file.path));
  const isPartial =
    skippedFiles.length > 0 ||
    selection.isCapped ||
    selection.targets.length < selection.totalFileCount;

  return {
    candidateFileCount: selection.candidateCount,
    isPartial,
    reviewedFileCount: reviewedFiles.length,
    selectedFileCount: selection.targets.length,
    selectedPaths,
    skippedFileCount: skippedFiles.length,
    skippedPaths,
    strategy: "targeted"
  };
}

function buildWarnings(
  selection: ReviewSelectionResult,
  coverage: ReviewCoverage,
  skippedFiles: SkippedReviewFile[]
): AnalysisWarning[] {
  const warningDetails: AnalysisWarning[] = [];

  if (selection.isCapped) {
    warningDetails.push(
      createAnalysisWarning({
        code: "REVIEW_SELECTION_CAPPED",
        message: `Targeted review selected ${selection.targets.length} of ${selection.candidateCount} candidate files to keep review bounded.`,
        paths: coverage.selectedPaths,
        source: "review-selection",
        stage: "review"
      })
    );
  }

  if (coverage.isPartial) {
    warningDetails.push(
      createAnalysisWarning({
        code: "REVIEW_SCOPE_LIMITED",
        message:
          coverage.reviewedFileCount > 0
            ? `Targeted review inspected ${coverage.reviewedFileCount} of ${selection.totalFileCount} repository files; full-repo review was not performed.`
            : `Targeted review did not inspect any files from the ${selection.totalFileCount}-file repository snapshot; full-repo review was not performed.`,
        paths: coverage.selectedPaths,
        source: "review-selection",
        stage: "review"
      })
    );
  }

  for (const skippedFile of skippedFiles) {
    warningDetails.push(
      createAnalysisWarning({
        code: "REVIEW_FILE_SKIPPED",
        message: skippedFile.reason,
        paths: [skippedFile.path],
        source: skippedFile.reason.includes("fetch")
          ? "github-file-fetch"
          : skippedFile.reason.includes("binary")
            ? "review-content"
            : "review-selection",
        stage: "review"
      })
    );
  }

  return dedupeAnalysisWarnings(warningDetails);
}

export function createCodeReviewResult(
  options: CreateCodeReviewResultOptions
): CodeReviewResult {
  const skippedFiles = options.skippedFiles ?? [];
  const coverage = buildCoverage(options.selection, options.reviewedFiles, skippedFiles);
  const findings = options.reviewedFiles
    .flatMap((file) => runDeterministicReviewChecks(file))
    .sort((left, right) => left.id.localeCompare(right.id));
  const warningDetails = buildWarnings(options.selection, coverage, skippedFiles);

  return {
    coverage,
    findings,
    summary: buildCodeReviewFindingSummary(findings, coverage),
    warningDetails,
    warnings: getWarningMessages(warningDetails)
  };
}
