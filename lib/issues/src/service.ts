import type {
  CodeReviewFinding,
  DependencyFinding,
  IssueCandidate,
  IssueCandidateSummary
} from "@repo-guardian/shared-types";
import { createSuggestedBody, buildIssueCandidateSummary, conservativeConfidence, dedupeIssueCandidates, hasStrongSignal, maxSeverity, topLevelScope, uniqueSorted } from "./utils.js";

export type IssueCandidateResult = {
  candidates: IssueCandidate[];
  summary: IssueCandidateSummary;
};

function createIssueCandidate(input: Omit<IssueCandidate, "suggestedBody">): IssueCandidate {
  const candidate: IssueCandidate = {
    ...input,
    suggestedBody: ""
  };

  return {
    ...candidate,
    suggestedBody: createSuggestedBody(candidate)
  };
}

function buildDependencyCandidates(
  findings: DependencyFinding[]
): IssueCandidate[] {
  const grouped = new Map<string, DependencyFinding[]>();

  for (const finding of findings) {
    const key = `${finding.packageName}:${finding.isDirect ? "direct" : "transitive"}`;
    const existing = grouped.get(key) ?? [];
    existing.push(finding);
    grouped.set(key, existing);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const packageName = group[0]?.packageName ?? key;
    const severity = maxSeverity(group.map((finding) => finding.severity));
    const confidence = conservativeConfidence(group.map((finding) => finding.confidence));
    const candidateType = group.every((finding) => finding.remediationType === "upgrade")
      ? "dependency-upgrade"
      : "dependency-review";
    const affectedPaths = uniqueSorted(group.flatMap((finding) => finding.paths));
    const relatedFindingIds = uniqueSorted(group.map((finding) => finding.id));
    const directFindingCount = group.filter((finding) => finding.isDirect).length;
    const acceptanceCriteria =
      candidateType === "dependency-upgrade"
        ? [
            `Upgrade ${packageName} to a non-affected version and refresh the relevant lockfile entries.`,
            "Run the relevant dependency installation and validation commands for the affected workspace.",
            "Confirm the related advisories no longer match the resolved dependency version."
          ]
        : [
            `Review the current ${packageName} version against the related advisories and choose a safe remediation path.`,
            "Update the dependency chain or package version so the advisory no longer applies.",
            "Validate the affected workspace after the dependency change."
          ];

    return createIssueCandidate({
      acceptanceCriteria,
      affectedPackages: [packageName],
      affectedPaths,
      candidateType,
      confidence,
      id: `issue:${candidateType}:${packageName}`,
      labels: uniqueSorted(["dependencies", "security", severity]),
      relatedFindingIds,
      scope: "package",
      severity,
      summary:
        group.length > 1
          ? `${group.length} dependency findings affect ${packageName} across ${affectedPaths.length} tracked path${affectedPaths.length === 1 ? "" : "s"}.`
          : `${packageName} is affected by a dependency advisory in the current repository snapshot.`,
      title:
        candidateType === "dependency-upgrade"
          ? `Upgrade ${packageName} to address dependency advisories`
          : `Review ${packageName} dependency advisory exposure`,
      whyItMatters:
        directFindingCount > 0
          ? `The repository directly depends on ${packageName}, so the advisory exposure is more likely to affect production behavior or build outputs.`
          : `The repository currently resolves ${packageName} transitively, which can still expose downstream builds or runtime paths to known advisories.`
    });
  });
}

function buildWorkflowCandidates(
  findings: CodeReviewFinding[]
): IssueCandidate[] {
  const grouped = new Map<string, CodeReviewFinding[]>();

  for (const finding of findings.filter((finding) => finding.sourceType === "workflow")) {
    const workflowPath = finding.paths[0];
    if (!workflowPath) {
      continue;
    }

    const existing = grouped.get(workflowPath) ?? [];
    existing.push(finding);
    grouped.set(workflowPath, existing);
  }

  const candidates: IssueCandidate[] = [];

  for (const [workflowPath, group] of grouped.entries()) {
    if (!hasStrongSignal(group)) {
      continue;
    }

    const severity = maxSeverity(group.map((finding) => finding.severity));
    const confidence = conservativeConfidence(group.map((finding) => finding.confidence));
    const relatedFindingIds = uniqueSorted(group.map((finding) => finding.id));
    const categories = uniqueSorted(group.map((finding) => finding.category));

    candidates.push(
      createIssueCandidate({
        acceptanceCriteria: [
          "Reduce the workflow token permissions to the minimum set required for its jobs.",
          "Review high-risk workflow triggers and gate privileged steps for untrusted pull requests.",
          "Re-run the affected workflow after hardening changes to confirm behavior still matches expectations."
        ],
        affectedPackages: [],
        affectedPaths: [workflowPath],
        candidateType: "workflow-hardening",
        confidence,
        id: `issue:workflow-hardening:${workflowPath}`,
        labels: uniqueSorted(["security", "workflow", severity]),
        relatedFindingIds,
        scope: "workflow-file",
        severity,
        summary:
          categories.length > 1
            ? `The workflow file ${workflowPath} has multiple hardening findings that likely share one remediation pass.`
            : `The workflow file ${workflowPath} has a concrete hardening finding that should be tracked explicitly.`,
        title: `Harden workflow ${workflowPath}`,
        whyItMatters:
          "Workflow misconfiguration can expand token privileges or expose privileged automation to untrusted pull request content."
      })
    );
  }

  return candidates;
}

function buildSecretCandidates(
  findings: CodeReviewFinding[]
): IssueCandidate[] {
  const secretFindings = findings.filter((finding) => finding.category === "hardcoded-secret");
  const grouped = new Map<string, CodeReviewFinding[]>();

  for (const finding of secretFindings) {
    const path = finding.paths[0];
    if (!path) {
      continue;
    }

    const key = topLevelScope(path);
    const existing = grouped.get(key) ?? [];
    existing.push(finding);
    grouped.set(key, existing);
  }

  return [...grouped.entries()]
    .filter(([, group]) => hasStrongSignal(group))
    .map(([scopeKey, group]) => {
      const affectedPaths = uniqueSorted(group.flatMap((finding) => finding.paths));
      const severity = maxSeverity(group.map((finding) => finding.severity));
      const confidence = conservativeConfidence(group.map((finding) => finding.confidence));
      const scope = affectedPaths.length > 1 ? "subsystem" : "file";

      return createIssueCandidate({
        acceptanceCriteria: [
          "Move secret-like literals out of tracked files and into the appropriate secret or environment management mechanism.",
          "Rotate any exposed credentials that are still valid.",
          "Confirm the affected subsystem still reads secrets from approved runtime configuration paths."
        ],
        affectedPackages: [],
        affectedPaths,
        candidateType: "secret-remediation",
        confidence,
        id: `issue:secret-remediation:${scopeKey}`,
        labels: uniqueSorted(["security", "secrets", severity]),
        relatedFindingIds: uniqueSorted(group.map((finding) => finding.id)),
        scope,
        severity,
        summary:
          affectedPaths.length > 1
            ? `Secret-like literals were found across ${affectedPaths.length} files in the ${scopeKey} subsystem.`
            : `A secret-like literal was found in ${affectedPaths[0]}.`,
        title:
          scope === "subsystem"
            ? `Remediate hardcoded secrets in ${scopeKey}`
            : `Remediate hardcoded secret in ${affectedPaths[0]}`,
        whyItMatters:
          "Hardcoded credentials can leak through source control history and make incident response harder if a credential is valid outside the repository."
      });
    });
}

function buildExecutionCandidates(
  findings: CodeReviewFinding[],
  category: "dangerous-dynamic-execution" | "unsafe-shell-execution",
  candidateType: "dangerous-execution" | "shell-execution",
  titlePrefix: string,
  whyItMatters: string
): IssueCandidate[] {
  const grouped = new Map<string, CodeReviewFinding[]>();

  for (const finding of findings.filter((finding) => finding.category === category)) {
    const path = finding.paths[0];
    if (!path) {
      continue;
    }

    const existing = grouped.get(path) ?? [];
    existing.push(finding);
    grouped.set(path, existing);
  }

  return [...grouped.entries()]
    .filter(([, group]) => hasStrongSignal(group))
    .map(([path, group]) => {
      const severity = maxSeverity(group.map((finding) => finding.severity));
      const confidence = conservativeConfidence(group.map((finding) => finding.confidence));

      return createIssueCandidate({
        acceptanceCriteria: [
          `Replace the current ${category === "dangerous-dynamic-execution" ? "dynamic execution" : "shell execution"} pattern with a safer explicit implementation.`,
          "Validate the input path or command surface that currently reaches the risky construct.",
          "Run the relevant tests or checks for the affected file after the remediation."
        ],
        affectedPackages: [],
        affectedPaths: [path],
        candidateType,
        confidence,
        id: `issue:${candidateType}:${path}`,
        labels: uniqueSorted(["security", "code", severity]),
        relatedFindingIds: uniqueSorted(group.map((finding) => finding.id)),
        scope: "file",
        severity,
        summary:
          group.length > 1
            ? `${group.length} risky execution findings were detected in ${path}.`
            : `A risky execution pattern was detected in ${path}.`,
        title: `${titlePrefix} in ${path}`,
        whyItMatters
      });
    });
}

export function createIssueCandidateResult(input: {
  codeReviewFindings: CodeReviewFinding[];
  dependencyFindings: DependencyFinding[];
}): IssueCandidateResult {
  const candidates = dedupeIssueCandidates([
    ...buildDependencyCandidates(input.dependencyFindings),
    ...buildWorkflowCandidates(input.codeReviewFindings),
    ...buildSecretCandidates(input.codeReviewFindings),
    ...buildExecutionCandidates(
      input.codeReviewFindings,
      "dangerous-dynamic-execution",
      "dangerous-execution",
      "Remove dangerous dynamic execution",
      "Dynamic evaluation paths can turn untrusted input into code execution and are difficult to reason about safely."
    ),
    ...buildExecutionCandidates(
      input.codeReviewFindings,
      "unsafe-shell-execution",
      "shell-execution",
      "Harden shell execution usage",
      "Shell execution helpers can expose command injection risk when input handling is not tightly controlled."
    )
  ]);

  return {
    candidates,
    summary: buildIssueCandidateSummary(candidates)
  };
}
