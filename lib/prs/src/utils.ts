import type {
  AnalysisWarning,
  CodeReviewFinding,
  DependencyFinding,
  FindingConfidence,
  FindingSeverity,
  IssueCandidate,
  PRCandidate,
  PRCandidateReadiness,
  PRCandidateRiskLevel,
  PRCandidateSummary,
  PRCandidateType
} from "@repo-guardian/shared-types";

export type SupportedFinding = DependencyFinding | CodeReviewFinding;

const severityOrder: Record<FindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};

const confidenceOrder: Record<FindingConfidence, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const readinessOrder: Record<PRCandidateReadiness, number> = {
  ready: 0,
  ready_with_warnings: 1,
  draft_only: 2
};

const riskOrder: Record<PRCandidateRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2
};

const dependencyWarningCodes = new Set<AnalysisWarning["code"]>([
  "MANIFEST_WITHOUT_LOCKFILE",
  "LOCKFILE_WITHOUT_MANIFEST",
  "FILE_FETCH_SKIPPED",
  "FILE_PARSE_FAILED",
  "DECLARATION_ONLY_VERSION",
  "MULTIPLE_RESOLVED_VERSIONS",
  "ADVISORY_LOOKUP_PARTIAL",
  "ADVISORY_PROVIDER_FAILED"
]);

const reviewWarningCodes = new Set<AnalysisWarning["code"]>([
  "REVIEW_FILE_SKIPPED",
  "REVIEW_SELECTION_CAPPED"
]);

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function maxSeverity(
  severities: Iterable<FindingSeverity>
): FindingSeverity {
  let result: FindingSeverity = "info";

  for (const severity of severities) {
    if (severityOrder[severity] < severityOrder[result]) {
      result = severity;
    }
  }

  return result;
}

export function conservativeConfidence(
  confidences: Iterable<FindingConfidence>
): FindingConfidence {
  let result: FindingConfidence = "high";

  for (const confidence of confidences) {
    if (confidenceOrder[confidence] > confidenceOrder[result]) {
      result = confidence;
    }
  }

  return result;
}

export function dedupePRCandidates(candidates: PRCandidate[]): PRCandidate[] {
  const deduped = new Map<string, PRCandidate>();

  for (const candidate of candidates) {
    const key = [
      candidate.candidateType,
      candidate.affectedPackages.join("|"),
      candidate.affectedPaths.join("|")
    ].join("::");

    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const readinessDifference =
      readinessOrder[left.readiness] - readinessOrder[right.readiness];

    if (readinessDifference !== 0) {
      return readinessDifference;
    }

    const riskDifference = riskOrder[left.riskLevel] - riskOrder[right.riskLevel];

    if (riskDifference !== 0) {
      return riskDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

export function buildPRCandidateSummary(
  candidates: PRCandidate[]
): PRCandidateSummary {
  const byType = new Map<PRCandidateType, number>();
  const byReadiness = new Map<PRCandidateReadiness, number>();
  const byRiskLevel = new Map<PRCandidateRiskLevel, number>();

  for (const candidate of candidates) {
    byType.set(candidate.candidateType, (byType.get(candidate.candidateType) ?? 0) + 1);
    byReadiness.set(candidate.readiness, (byReadiness.get(candidate.readiness) ?? 0) + 1);
    byRiskLevel.set(candidate.riskLevel, (byRiskLevel.get(candidate.riskLevel) ?? 0) + 1);
  }

  return {
    byReadiness: [...byReadiness.entries()]
      .map(([readiness, count]) => ({ readiness, count }))
      .sort((left, right) => readinessOrder[left.readiness] - readinessOrder[right.readiness]),
    byRiskLevel: [...byRiskLevel.entries()]
      .map(([riskLevel, count]) => ({ riskLevel, count }))
      .sort((left, right) => riskOrder[left.riskLevel] - riskOrder[right.riskLevel]),
    byType: [...byType.entries()]
      .map(([candidateType, count]) => ({ candidateType, count }))
      .sort((left, right) => left.candidateType.localeCompare(right.candidateType)),
    totalCandidates: candidates.length
  };
}

export function findRelevantWarnings(
  warnings: AnalysisWarning[],
  affectedPaths: string[]
): AnalysisWarning[] {
  if (affectedPaths.length === 0) {
    return [];
  }

  return warnings.filter((warning) => {
    if (warning.paths.length === 0) {
      return false;
    }

    return warning.paths.some((path) => affectedPaths.includes(path));
  });
}

export function hasDependencyBlockingWarnings(warnings: AnalysisWarning[]): boolean {
  return warnings.some((warning) => dependencyWarningCodes.has(warning.code));
}

export function hasReviewBlockingWarnings(warnings: AnalysisWarning[]): boolean {
  return warnings.some((warning) => reviewWarningCodes.has(warning.code));
}

export function buildRiskLevel(candidateType: PRCandidateType): PRCandidateRiskLevel {
  switch (candidateType) {
    case "dependency-upgrade":
    case "workflow-hardening":
      return "low";
    case "secret-remediation":
      return "high";
    case "dependency-review":
    case "dangerous-execution":
    case "shell-execution":
    case "general-hardening":
      return "medium";
  }
}

export function buildExpectedDependencyChangeReason(path: string, packageName: string): string {
  if (/lock/i.test(path)) {
    return `Refresh ${path} so ${packageName} resolves to the remediated version.`;
  }

  return `Update the ${packageName} dependency declaration in ${path}.`;
}

export function buildIssueCandidateIndex(
  issueCandidates: IssueCandidate[]
): Map<string, IssueCandidate> {
  return new Map(issueCandidates.map((candidate) => [candidate.id, candidate]));
}

export function buildFindingIndex(
  findings: SupportedFinding[]
): Map<string, SupportedFinding> {
  return new Map(findings.map((finding) => [finding.id, finding]));
}
