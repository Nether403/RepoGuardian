import type {
  CodeReviewFinding,
  DependencyFinding,
  FindingConfidence,
  FindingSeverity,
  FindingsBySeverity,
  IssueCandidate,
  IssueCandidateSummary,
  IssueCandidateType
} from "@repo-guardian/shared-types";

export type SupportedIssueFinding = DependencyFinding | CodeReviewFinding;

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

export function createSeverityCounts(): FindingsBySeverity {
  return {
    critical: 0,
    high: 0,
    info: 0,
    low: 0,
    medium: 0
  };
}

export function buildIssueCandidateSummary(
  candidates: IssueCandidate[]
): IssueCandidateSummary {
  const bySeverity = createSeverityCounts();
  const byType = new Map<IssueCandidateType, number>();

  for (const candidate of candidates) {
    bySeverity[candidate.severity] += 1;
    byType.set(candidate.candidateType, (byType.get(candidate.candidateType) ?? 0) + 1);
  }

  return {
    bySeverity,
    byType: [...byType.entries()]
      .map(([candidateType, count]) => ({
        candidateType,
        count
      }))
      .sort((left, right) => left.candidateType.localeCompare(right.candidateType)),
    totalCandidates: candidates.length
  };
}

export function dedupeIssueCandidates(
  candidates: IssueCandidate[]
): IssueCandidate[] {
  const deduped = new Map<string, IssueCandidate>();

  for (const candidate of candidates) {
    const key = [
      candidate.candidateType,
      candidate.scope,
      candidate.affectedPackages.join("|"),
      candidate.affectedPaths.join("|")
    ].join("::");

    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const severityDifference = severityOrder[left.severity] - severityOrder[right.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

export function createSuggestedBody(candidate: IssueCandidate): string {
  const packageLine =
    candidate.affectedPackages.length > 0
      ? `Affected packages: ${candidate.affectedPackages.join(", ")}`
      : "Affected packages: none";
  const pathLine =
    candidate.affectedPaths.length > 0
      ? `Affected paths: ${candidate.affectedPaths.join(", ")}`
      : "Affected paths: none";

  return [
    "## Summary",
    candidate.summary,
    "",
    "## Why It Matters",
    candidate.whyItMatters,
    "",
    "## Scope",
    packageLine,
    pathLine,
    "",
    "## Acceptance Criteria",
    ...candidate.acceptanceCriteria.map((criterion) => `- ${criterion}`)
  ].join("\n");
}

export function dirname(path: string): string {
  const segments = path.split("/");
  segments.pop();
  return segments.join("/");
}

export function topLevelScope(path: string): string {
  const directory = dirname(path);
  if (directory.length === 0) {
    return path;
  }

  const segments = directory.split("/");
  return segments[0] ?? directory;
}

export function hasStrongSignal(
  findings: SupportedIssueFinding[]
): boolean {
  return findings.some(
    (finding) =>
      (finding.severity === "critical" || finding.severity === "high" || finding.severity === "medium") &&
      finding.confidence !== "low"
  );
}
