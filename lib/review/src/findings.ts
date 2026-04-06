import type {
  CodeReviewFinding,
  CodeReviewFindingSummary,
  FindingsBySeverity,
  ReviewCoverage
} from "@repo-guardian/shared-types";

function createEmptySeverityCounts(): FindingsBySeverity {
  return {
    critical: 0,
    high: 0,
    info: 0,
    low: 0,
    medium: 0
  };
}

export function buildCodeReviewFindingSummary(
  findings: CodeReviewFinding[],
  coverage: ReviewCoverage
): CodeReviewFindingSummary {
  const findingsBySeverity = createEmptySeverityCounts();

  for (const finding of findings) {
    findingsBySeverity[finding.severity] += 1;
  }

  return {
    findingsBySeverity,
    isPartial: coverage.isPartial,
    reviewedFileCount: coverage.reviewedFileCount,
    totalFindings: findings.length
  };
}
