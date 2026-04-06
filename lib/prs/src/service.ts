import type {
  AnalysisWarning,
  CodeReviewFinding,
  DependencyFinding,
  DependencySnapshot,
  IssueCandidate,
  PRCandidate,
  PRCandidateReadiness,
  PRCandidateSummary,
  ReviewCoverage
} from "@repo-guardian/shared-types";
import {
  buildExpectedDependencyChangeReason,
  buildFindingIndex,
  buildIssueCandidateIndex,
  buildPRCandidateSummary,
  buildRiskLevel,
  conservativeConfidence,
  dedupePRCandidates,
  findRelevantWarnings,
  hasDependencyBlockingWarnings,
  hasReviewBlockingWarnings,
  maxSeverity,
  uniqueSorted
} from "./utils.js";

export type PRCandidateResult = {
  candidates: PRCandidate[];
  summary: PRCandidateSummary;
};

type CandidateContext = {
  codeReviewFindings: CodeReviewFinding[];
  dependencyFindings: DependencyFinding[];
  dependencySnapshot: DependencySnapshot;
  issueCandidates: IssueCandidate[];
  reviewCoverage: ReviewCoverage;
  warningDetails: AnalysisWarning[];
};

function buildDependencyReadiness(input: {
  confidence: IssueCandidate["confidence"];
  relevantWarnings: AnalysisWarning[];
}): PRCandidateReadiness {
  if (input.confidence === "low") {
    return "draft_only";
  }

  if (hasDependencyBlockingWarnings(input.relevantWarnings)) {
    return "ready_with_warnings";
  }

  return input.confidence === "high" ? "ready" : "ready_with_warnings";
}

function buildWorkflowReadiness(input: {
  confidence: IssueCandidate["confidence"];
  relevantWarnings: AnalysisWarning[];
}): PRCandidateReadiness {
  if (input.confidence === "low") {
    return "draft_only";
  }

  if (hasReviewBlockingWarnings(input.relevantWarnings)) {
    return "ready_with_warnings";
  }

  return input.confidence === "high" ? "ready" : "ready_with_warnings";
}

function buildExecutionReadiness(input: {
  confidence: IssueCandidate["confidence"];
  relevantWarnings: AnalysisWarning[];
}): PRCandidateReadiness {
  if (input.confidence === "low") {
    return "draft_only";
  }

  if (hasReviewBlockingWarnings(input.relevantWarnings)) {
    return "draft_only";
  }

  return input.confidence === "high" ? "ready_with_warnings" : "draft_only";
}

function buildSecretReadiness(): PRCandidateReadiness {
  return "draft_only";
}

function createDependencyPRCandidate(
  issueCandidate: IssueCandidate,
  dependencyFindings: DependencyFinding[],
  warningDetails: AnalysisWarning[]
): PRCandidate | null {
  if (issueCandidate.candidateType !== "dependency-upgrade") {
    return null;
  }

  if (
    issueCandidate.affectedPackages.length !== 1 ||
    issueCandidate.affectedPaths.length === 0
  ) {
    return null;
  }

  const packageName = issueCandidate.affectedPackages[0];

  if (!packageName) {
    return null;
  }

  const groupFindings = dependencyFindings.filter((finding) =>
    issueCandidate.relatedFindingIds.includes(finding.id)
  );

  if (
    groupFindings.length === 0 ||
    groupFindings.some((finding) => finding.remediationType !== "upgrade")
  ) {
    return null;
  }

  const readiness = buildDependencyReadiness({
    confidence: issueCandidate.confidence,
    relevantWarnings: findRelevantWarnings(
      warningDetails,
      issueCandidate.affectedPaths
    )
  });
  const severity = maxSeverity(groupFindings.map((finding) => finding.severity));
  const confidence = conservativeConfidence(
    groupFindings.map((finding) => finding.confidence)
  );

  return {
    affectedPackages: [packageName],
    affectedPaths: uniqueSorted(issueCandidate.affectedPaths),
    candidateType: "dependency-upgrade",
    confidence,
    expectedFileChanges: uniqueSorted(issueCandidate.affectedPaths).map((path) => ({
      changeType: "edit",
      path,
      reason: buildExpectedDependencyChangeReason(path, packageName)
    })),
    id: `pr:dependency-upgrade:${packageName}`,
    labels: uniqueSorted(["dependencies", "security", "candidate-pr", severity]),
    linkedIssueCandidateIds: [issueCandidate.id],
    rationale:
      `The remediation path is bounded to ${packageName} version updates and the matching manifest or lockfile entries already identified in the repository snapshot.`,
    readiness,
    relatedFindingIds: uniqueSorted(issueCandidate.relatedFindingIds),
    riskLevel: buildRiskLevel("dependency-upgrade"),
    rollbackNote:
      `Revert the ${packageName} version change and restore the previous lockfile entries if the upgrade causes regressions.`,
    severity,
    summary:
      `Update ${packageName} and refresh the tracked dependency files so the current advisory match no longer applies.`,
    testPlan: [
      "Install dependencies and refresh the affected lockfile entries.",
      "Run the repository validation commands that cover the affected workspace.",
      "Re-analyze the repository to confirm the advisory no longer matches the resolved version."
    ],
    title: `Upgrade ${packageName} and refresh dependency locks`
  };
}

function createWorkflowPRCandidate(
  issueCandidate: IssueCandidate,
  codeReviewFindings: CodeReviewFinding[],
  warningDetails: AnalysisWarning[]
): PRCandidate | null {
  if (issueCandidate.candidateType !== "workflow-hardening") {
    return null;
  }

  if (issueCandidate.affectedPaths.length !== 1) {
    return null;
  }

  const workflowPath = issueCandidate.affectedPaths[0];

  if (!workflowPath) {
    return null;
  }

  const groupFindings = codeReviewFindings.filter((finding) =>
    issueCandidate.relatedFindingIds.includes(finding.id)
  );

  if (groupFindings.length === 0) {
    return null;
  }

  const severity = maxSeverity(groupFindings.map((finding) => finding.severity));
  const confidence = conservativeConfidence(
    groupFindings.map((finding) => finding.confidence)
  );
  const readiness = buildWorkflowReadiness({
    confidence,
    relevantWarnings: findRelevantWarnings(warningDetails, [workflowPath])
  });

  return {
    affectedPackages: [],
    affectedPaths: [workflowPath],
    candidateType: "workflow-hardening",
    confidence,
    expectedFileChanges: [
      {
        changeType: "edit",
        path: workflowPath,
        reason:
          "Tighten workflow permissions and adjust high-risk trigger behavior in the workflow definition."
      }
    ],
    id: `pr:workflow-hardening:${workflowPath}`,
    labels: uniqueSorted(["workflow", "security", "candidate-pr", severity]),
    linkedIssueCandidateIds: [issueCandidate.id],
    rationale:
      `The findings are localized to ${workflowPath}, so the remediation can stay inside one workflow file and one review concern.`,
    readiness,
    relatedFindingIds: uniqueSorted(issueCandidate.relatedFindingIds),
    riskLevel: buildRiskLevel("workflow-hardening"),
    rollbackNote:
      `Revert the workflow file change if the hardened permissions or trigger rules block expected automation.`,
    severity,
    summary:
      `Harden ${workflowPath} by tightening permissions and revisiting the risky trigger behavior already flagged in analysis.`,
    testPlan: [
      "Run the workflow or its equivalent validation after the permission change.",
      "Confirm privileged steps still have the minimum access they need.",
      "Verify untrusted pull request paths no longer reach the risky trigger pattern."
    ],
    title: `Harden ${workflowPath}`
  };
}

function createExecutionPRCandidate(
  issueCandidate: IssueCandidate,
  codeReviewFindings: CodeReviewFinding[],
  warningDetails: AnalysisWarning[]
): PRCandidate | null {
  if (
    issueCandidate.candidateType !== "dangerous-execution" &&
    issueCandidate.candidateType !== "shell-execution"
  ) {
    return null;
  }

  if (issueCandidate.affectedPaths.length !== 1) {
    return null;
  }

  const path = issueCandidate.affectedPaths[0];

  if (!path) {
    return null;
  }

  const groupFindings = codeReviewFindings.filter((finding) =>
    issueCandidate.relatedFindingIds.includes(finding.id)
  );

  if (groupFindings.length === 0) {
    return null;
  }

  const severity = maxSeverity(groupFindings.map((finding) => finding.severity));
  const confidence = conservativeConfidence(
    groupFindings.map((finding) => finding.confidence)
  );
  const readiness = buildExecutionReadiness({
    confidence,
    relevantWarnings: findRelevantWarnings(warningDetails, [path])
  });

  return {
    affectedPackages: [],
    affectedPaths: [path],
    candidateType: issueCandidate.candidateType,
    confidence,
    expectedFileChanges: [
      {
        changeType: "edit",
        path,
        reason:
          issueCandidate.candidateType === "dangerous-execution"
            ? "Replace dynamic evaluation with a safer explicit implementation."
            : "Replace shell-backed execution with a safer command invocation pattern."
      }
    ],
    id: `pr:${issueCandidate.candidateType}:${path}`,
    labels: uniqueSorted(["code", "security", "candidate-pr", severity]),
    linkedIssueCandidateIds: [issueCandidate.id],
    rationale:
      `The flagged behavior is localized to ${path}, which makes the remediation reviewable as one targeted code hardening change.`,
    readiness,
    relatedFindingIds: uniqueSorted(issueCandidate.relatedFindingIds),
    riskLevel: buildRiskLevel(issueCandidate.candidateType),
    rollbackNote:
      "Revert the localized hardening change if the safer execution path breaks expected behavior, then reassess the surrounding call site with additional context.",
    severity,
    summary:
      issueCandidate.candidateType === "dangerous-execution"
        ? `Replace the dynamic execution path in ${path} with a safer explicit alternative.`
        : `Harden the shell execution path in ${path} with a safer invocation pattern.`,
    testPlan: [
      "Run the tests or commands that exercise the affected execution path.",
      "Verify the risky construct is no longer present after the refactor.",
      "Confirm the affected code path still behaves correctly with representative inputs."
    ],
    title:
      issueCandidate.candidateType === "dangerous-execution"
        ? `Remove dangerous dynamic execution in ${path}`
        : `Harden shell execution in ${path}`
  };
}

function createSecretPRCandidate(
  issueCandidate: IssueCandidate,
  codeReviewFindings: CodeReviewFinding[]
): PRCandidate | null {
  if (issueCandidate.candidateType !== "secret-remediation") {
    return null;
  }

  if (
    issueCandidate.affectedPaths.length === 0 ||
    issueCandidate.affectedPaths.length > 3
  ) {
    return null;
  }

  const groupFindings = codeReviewFindings.filter((finding) =>
    issueCandidate.relatedFindingIds.includes(finding.id)
  );

  if (groupFindings.length === 0) {
    return null;
  }

  const severity = maxSeverity(groupFindings.map((finding) => finding.severity));
  const confidence = conservativeConfidence(
    groupFindings.map((finding) => finding.confidence)
  );

  return {
    affectedPackages: [],
    affectedPaths: uniqueSorted(issueCandidate.affectedPaths),
    candidateType: "secret-remediation",
    confidence,
    expectedFileChanges: uniqueSorted(issueCandidate.affectedPaths).map((path) => ({
      changeType: "edit",
      path,
      reason:
        "Remove the tracked secret-like literal and switch the code path to a runtime secret source."
    })),
    id: `pr:secret-remediation:${issueCandidate.id}`,
    labels: uniqueSorted(["security", "secrets", "candidate-pr", severity]),
    linkedIssueCandidateIds: [issueCandidate.id],
    rationale:
      "The secret exposure is concrete, but safe remediation may also require credential rotation and runtime configuration coordination.",
    readiness: buildSecretReadiness(),
    relatedFindingIds: uniqueSorted(issueCandidate.relatedFindingIds),
    riskLevel: buildRiskLevel("secret-remediation"),
    rollbackNote:
      "Do not roll back by reintroducing a real secret into source control; restore behavior through the approved secret-management path if needed.",
    severity,
    summary:
      `Remove the hardcoded secret-like literals from ${issueCandidate.affectedPaths.length} tracked file${issueCandidate.affectedPaths.length === 1 ? "" : "s"} and move them behind runtime configuration.`,
    testPlan: [
      "Verify the affected subsystem still loads the secret from the intended runtime configuration path.",
      "Rotate any exposed credentials that are still valid before merging a remediation patch.",
      "Run the validation commands that cover the affected subsystem after the configuration change."
    ],
    title:
      issueCandidate.affectedPaths.length === 1
        ? `Remove hardcoded secret from ${issueCandidate.affectedPaths[0]}`
        : `Remediate hardcoded secrets in ${issueCandidate.affectedPaths[0]?.split("/")[0] ?? "subsystem"}`
  };
}

export function createPRCandidateResult(
  input: CandidateContext
): PRCandidateResult {
  const issueIndex = buildIssueCandidateIndex(input.issueCandidates);
  const findingIndex = buildFindingIndex([
    ...input.dependencyFindings,
    ...input.codeReviewFindings
  ]);

  const candidates = dedupePRCandidates(
    input.issueCandidates.flatMap((issueCandidate) => {
      const relatedFindingIds = issueCandidate.relatedFindingIds.filter((findingId) =>
        findingIndex.has(findingId)
      );

      if (relatedFindingIds.length === 0 || !issueIndex.has(issueCandidate.id)) {
        return [];
      }

      const candidate =
        createDependencyPRCandidate(
          issueCandidate,
          input.dependencyFindings,
          input.warningDetails
        ) ??
        createWorkflowPRCandidate(
          issueCandidate,
          input.codeReviewFindings,
          input.warningDetails
        ) ??
        createExecutionPRCandidate(
          issueCandidate,
          input.codeReviewFindings,
          input.warningDetails
        ) ??
        createSecretPRCandidate(issueCandidate, input.codeReviewFindings);

      return candidate ? [candidate] : [];
    })
  );

  return {
    candidates,
    summary: buildPRCandidateSummary(candidates)
  };
}
