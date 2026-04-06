import type {
  AnalysisWarning,
  CodeReviewFinding,
  DependencyFinding,
  IssueCandidate,
  PRCandidate,
  PRPatchPlan,
  PRPatchPlanSummary
} from "@repo-guardian/shared-types";
import { assessPatchability } from "./assessment.js";
import { buildPatchPlan } from "./plans.js";
import { buildPRPatchPlanSummary } from "./utils.js";
import { buildValidationResult } from "./validation.js";

export type PRPatchPlanResult = {
  plans: PRPatchPlan[];
  summary: PRPatchPlanSummary;
};

function createPRPatchPlanId(prCandidateId: string): string {
  return `patch-plan:${prCandidateId}`;
}

function buildIssueCandidateIndex(issueCandidates: IssueCandidate[]): Set<string> {
  return new Set(issueCandidates.map((candidate) => candidate.id));
}

function buildFindingIndex(
  dependencyFindings: DependencyFinding[],
  codeReviewFindings: CodeReviewFinding[]
): Set<string> {
  return new Set([
    ...dependencyFindings.map((finding) => finding.id),
    ...codeReviewFindings.map((finding) => finding.id)
  ]);
}

function createPatchPlanRecord(input: {
  candidate: PRCandidate;
  issueCandidateIndex: Set<string>;
  findingIndex: Set<string>;
  warningDetails: AnalysisWarning[];
}): PRPatchPlan {
  const linkedIssueCandidateIds = input.candidate.linkedIssueCandidateIds.filter((id) =>
    input.issueCandidateIndex.has(id)
  );
  const relatedFindingIds = input.candidate.relatedFindingIds.filter((id) =>
    input.findingIndex.has(id)
  );
  const assessment = assessPatchability({
    candidate: {
      ...input.candidate,
      linkedIssueCandidateIds,
      relatedFindingIds
    },
    warningDetails: input.warningDetails
  });
  const patchPlan = buildPatchPlan({
    candidate: input.candidate,
    patchability: assessment.patchability
  });
  const validation = buildValidationResult({
    patchability: assessment.patchability,
    readiness: input.candidate.readiness,
    reasons: assessment.reasons,
    relevantWarnings: assessment.relevantWarnings
  });

  return {
    affectedPackages: input.candidate.affectedPackages,
    affectedPaths: input.candidate.affectedPaths,
    candidateType: input.candidate.candidateType,
    confidence: input.candidate.confidence,
    id: createPRPatchPlanId(input.candidate.id),
    linkedIssueCandidateIds,
    patchability: assessment.patchability,
    patchPlan,
    patchWarnings: validation.patchWarnings,
    prCandidateId: input.candidate.id,
    readiness: input.candidate.readiness,
    relatedFindingIds,
    riskLevel: input.candidate.riskLevel,
    severity: input.candidate.severity,
    title: input.candidate.title,
    validationNotes: validation.validationNotes,
    validationStatus: validation.validationStatus
  };
}

export function createPRPatchPlanResult(input: {
  prCandidates: PRCandidate[];
  issueCandidates: IssueCandidate[];
  dependencyFindings: DependencyFinding[];
  codeReviewFindings: CodeReviewFinding[];
  warningDetails: AnalysisWarning[];
}): PRPatchPlanResult {
  const issueCandidateIndex = buildIssueCandidateIndex(input.issueCandidates);
  const findingIndex = buildFindingIndex(
    input.dependencyFindings,
    input.codeReviewFindings
  );

  const plans = input.prCandidates.map((candidate) =>
    createPatchPlanRecord({
      candidate,
      findingIndex,
      issueCandidateIndex,
      warningDetails: input.warningDetails
    })
  );

  return {
    plans,
    summary: buildPRPatchPlanSummary(plans)
  };
}
