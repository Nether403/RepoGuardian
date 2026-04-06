import type {
  DependencyFinding,
  DependencyFindingSummary,
  FindingConfidence,
  FindingSeverity,
  FindingsBySeverity
} from "@repo-guardian/shared-types";
import type { NormalizedAdvisory } from "./provider.js";
import type { AdvisoryLookupTarget } from "./targets.js";

type AdvisoryMatch = {
  advisory: NormalizedAdvisory;
  target: AdvisoryLookupTarget;
};

function createSeverityCounts(): FindingsBySeverity {
  return {
    critical: 0,
    high: 0,
    info: 0,
    low: 0,
    medium: 0
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function buildDependencyFindingSummary(
  findings: DependencyFinding[],
  isPartial: boolean
): DependencyFindingSummary {
  const findingsBySeverity = createSeverityCounts();

  for (const finding of findings) {
    findingsBySeverity[finding.severity] += 1;
  }

  return {
    findingsBySeverity,
    isPartial,
    totalFindings: findings.length,
    vulnerableDirectCount: findings.filter((finding) => finding.isDirect).length,
    vulnerableTransitiveCount: findings.filter((finding) => !finding.isDirect).length
  };
}

function buildFindingConfidence(
  target: AdvisoryLookupTarget,
  isPartial: boolean
): FindingConfidence {
  if (!isPartial && target.hasLockfileEvidence && target.confidence === "high") {
    return "high";
  }

  if (target.hasLockfileEvidence || target.confidence !== "low") {
    return "medium";
  }

  return "low";
}

function buildRecommendedAction(
  advisory: NormalizedAdvisory,
  target: AdvisoryLookupTarget
): { remediationType: "none" | "review" | "upgrade"; text: string } {
  if (advisory.fixedVersion) {
    return {
      remediationType: "upgrade",
      text: target.isDirect
        ? `Upgrade ${target.packageName} to ${advisory.fixedVersion} or later and refresh the lockfile.`
        : `Update the dependency chain so ${target.packageName} resolves to ${advisory.fixedVersion} or later.`
    };
  }

  return {
    remediationType: "review",
    text: `Review the advisory references for ${target.packageName} and update to a non-affected version.`
  };
}

function createFindingId(
  advisory: NormalizedAdvisory,
  target: AdvisoryLookupTarget
): string {
  return [
    "dependency",
    advisory.id,
    target.packageName,
    target.version,
    target.workspacePath ?? ".",
    target.isDirect ? "direct" : "transitive"
  ].join(":");
}

export function createDependencyFinding(
  match: AdvisoryMatch,
  isPartial: boolean
): DependencyFinding {
  const confidence = buildFindingConfidence(match.target, isPartial);
  const remediation = buildRecommendedAction(match.advisory, match.target);

  return {
    advisoryId: match.advisory.id,
    advisorySource: match.advisory.source,
    affectedRange: match.advisory.affectedVersionRange,
    candidateIssue: false,
    candidatePr: false,
    category: "dependency-vulnerability",
    confidence,
    dependencyType: match.target.dependencyType,
    evidence: [
      {
        label: "Dependency",
        value: match.target.packageName
      },
      {
        label: "Installed version",
        value: match.target.version
      },
      {
        label: "Matched advisory",
        value: match.advisory.id
      },
      {
        label: "Matched range",
        value: match.advisory.affectedVersionRange ?? "Version-specific OSV match"
      },
      {
        label: "Source file",
        value: match.target.sourceFile
      }
    ],
    id: createFindingId(match.advisory, match.target),
    installedVersion: match.target.version,
    isDirect: match.target.isDirect,
    lineSpans: [],
    packageName: match.target.packageName,
    paths: match.target.paths,
    recommendedAction: remediation.text,
    referenceUrls: uniqueSorted(
      match.advisory.references.map((reference) => reference.url)
    ),
    remediationType: remediation.remediationType,
    remediationVersion: match.advisory.fixedVersion,
    severity: match.advisory.severity,
    sourceType: "dependency",
    summary: `${match.target.packageName} ${match.target.version} matches ${match.advisory.id}: ${match.advisory.summary}`,
    title: `${match.target.packageName} is affected by ${match.advisory.id}`
  };
}

export function matchAdvisoriesToTargets(
  targets: AdvisoryLookupTarget[],
  advisoriesByQueryKey: Map<string, NormalizedAdvisory[]>,
  isPartial: boolean
): DependencyFinding[] {
  const findings = new Map<string, DependencyFinding>();

  for (const target of targets) {
    for (const advisory of advisoriesByQueryKey.get(target.query.key) ?? []) {
      const finding = createDependencyFinding(
        {
          advisory,
          target
        },
        isPartial
      );

      findings.set(finding.id, finding);
    }
  }

  return [...findings.values()].sort((left, right) => {
    const severityOrder: Record<FindingSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4
    };

    const severityDifference =
      (severityOrder[left.severity] ?? 0) - (severityOrder[right.severity] ?? 0);

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return left.id.localeCompare(right.id);
  });
}
