import type {
  AnalyzeRepoResponse,
  DependencyFinding,
  PRPatchPlan,
  PRWriteBackEligibility
} from "@repo-guardian/shared-types";
import type { TraceabilityViewModel, TraceableFinding } from "./types.js";

export const fallbackWriteBackEligibility: PRWriteBackEligibility = {
  approvalRequired: true,
  details: [
    "This analysis payload did not include write-back eligibility details."
  ],
  status: "blocked",
  summary: "Write-back eligibility details were not included in this analysis payload."
};

export function getWriteBackEligibility(
  plan: PRPatchPlan
): PRWriteBackEligibility {
  return plan.writeBackEligibility ?? fallbackWriteBackEligibility;
}

export function isDependencyFinding(
  finding: TraceableFinding
): finding is DependencyFinding {
  return finding.sourceType === "dependency";
}

export function buildEmptyTraceabilityViewModel(): TraceabilityViewModel {
  return {
    findingById: new Map<string, TraceableFinding>(),
    issueCandidateById: new Map(),
    patchPlanById: new Map(),
    patchPlansByCandidateId: new Map(),
    patchPlansByFindingId: new Map(),
    patchPlansByIssueCandidateId: new Map(),
    prCandidateById: new Map(),
    referencedCandidates: [],
    referencedFindings: [],
    referencedIssueCandidates: []
  };
}

export function buildTraceabilityViewModel(
  analysis: AnalyzeRepoResponse,
  patchPlans: PRPatchPlan[] = analysis.prPatchPlans
): TraceabilityViewModel {
  const viewModel = buildEmptyTraceabilityViewModel();
  const mergedFindings: TraceableFinding[] = [
    ...analysis.dependencyFindings,
    ...analysis.codeReviewFindings
  ];

  for (const candidate of analysis.prCandidates) {
    viewModel.prCandidateById.set(candidate.id, candidate);
  }

  for (const candidate of analysis.issueCandidates) {
    viewModel.issueCandidateById.set(candidate.id, candidate);
  }

  for (const finding of mergedFindings) {
    viewModel.findingById.set(finding.id, finding);
  }

  for (const plan of patchPlans) {
    viewModel.patchPlanById.set(plan.id, plan);

    const candidatePlans =
      viewModel.patchPlansByCandidateId.get(plan.prCandidateId) ?? [];
    candidatePlans.push(plan);
    viewModel.patchPlansByCandidateId.set(plan.prCandidateId, candidatePlans);

    for (const findingId of plan.relatedFindingIds) {
      const findingPlans = viewModel.patchPlansByFindingId.get(findingId) ?? [];
      findingPlans.push(plan);
      viewModel.patchPlansByFindingId.set(findingId, findingPlans);
    }

    for (const issueCandidateId of plan.linkedIssueCandidateIds) {
      const issuePlans =
        viewModel.patchPlansByIssueCandidateId.get(issueCandidateId) ?? [];
      issuePlans.push(plan);
      viewModel.patchPlansByIssueCandidateId.set(issueCandidateId, issuePlans);
    }
  }

  return {
    ...viewModel,
    referencedCandidates: analysis.prCandidates.filter((candidate) =>
      viewModel.patchPlansByCandidateId.has(candidate.id)
    ),
    referencedFindings: mergedFindings.filter((finding) =>
      viewModel.patchPlansByFindingId.has(finding.id)
    ),
    referencedIssueCandidates: analysis.issueCandidates.filter((candidate) =>
      viewModel.patchPlansByIssueCandidateId.has(candidate.id)
    )
  };
}
