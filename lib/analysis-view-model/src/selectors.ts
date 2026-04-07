import type { AnalyzeRepoResponse, PRPatchPlan } from "@repo-guardian/shared-types";
import {
  TRACEABILITY_FINDINGS_SECTION_ID,
  TRACEABILITY_ISSUE_CANDIDATES_SECTION_ID,
  TRACEABILITY_PATCH_PLANS_SECTION_ID,
  TRACEABILITY_PR_CANDIDATES_SECTION_ID
} from "./anchors.js";
import { getWriteBackEligibility } from "./traceability.js";
import type {
  CandidateTypeFilter,
  EligibilityFilter,
  TraceabilityMapSummaryItem,
  TraceabilityViewModel,
  WriteBackReadinessSummary
} from "./types.js";

export function getCandidateTypeFilterOptions(
  patchPlans: PRPatchPlan[]
): PRPatchPlan["candidateType"][] {
  return Array.from(new Set(patchPlans.map((plan) => plan.candidateType)));
}

export function filterPatchPlans(input: {
  candidateTypeFilter: CandidateTypeFilter;
  eligibilityFilter: EligibilityFilter;
  patchPlans: PRPatchPlan[];
}): PRPatchPlan[] {
  return input.patchPlans.filter((plan) => {
    const eligibilityMatches =
      input.eligibilityFilter === "all" ||
      getWriteBackEligibility(plan).status === input.eligibilityFilter;
    const candidateTypeMatches =
      input.candidateTypeFilter === "all" ||
      plan.candidateType === input.candidateTypeFilter;

    return eligibilityMatches && candidateTypeMatches;
  });
}

export function summarizeWriteBackReadiness(
  patchPlans: PRPatchPlan[]
): WriteBackReadinessSummary {
  return patchPlans.reduce(
    (summary, plan) => {
      const eligibility = getWriteBackEligibility(plan);

      if (eligibility.status === "executable") {
        summary.executable += 1;
      } else {
        summary.blocked += 1;
      }

      return summary;
    },
    {
      blocked: 0,
      executable: 0
    }
  );
}

export function buildTraceabilityMapSummary(
  traceability: TraceabilityViewModel
): TraceabilityMapSummaryItem[] {
  return [
    {
      count: traceability.patchPlanById.size,
      href: `#${TRACEABILITY_PATCH_PLANS_SECTION_ID}`,
      label: "Patch plans"
    },
    {
      count: traceability.referencedCandidates.length,
      href: `#${TRACEABILITY_PR_CANDIDATES_SECTION_ID}`,
      label: "PR candidates"
    },
    {
      count: traceability.referencedIssueCandidates.length,
      href: `#${TRACEABILITY_ISSUE_CANDIDATES_SECTION_ID}`,
      label: "Issue candidates"
    },
    {
      count: traceability.referencedFindings.length,
      href: `#${TRACEABILITY_FINDINGS_SECTION_ID}`,
      label: "Findings"
    }
  ];
}

export function buildAnalysisTraceability(input: {
  analysis: AnalyzeRepoResponse | null;
  candidateTypeFilter: CandidateTypeFilter;
  eligibilityFilter: EligibilityFilter;
  buildTraceabilityViewModel: (
    analysis: AnalyzeRepoResponse,
    patchPlans: PRPatchPlan[]
  ) => TraceabilityViewModel;
  emptyTraceability: TraceabilityViewModel;
}): {
  candidateTypeFilterOptions: PRPatchPlan["candidateType"][];
  traceability: TraceabilityViewModel;
  traceabilityMapSummary: TraceabilityMapSummaryItem[];
  visiblePatchPlans: PRPatchPlan[];
  writeBackReadinessSummary: WriteBackReadinessSummary | null;
} {
  if (!input.analysis) {
    return {
      candidateTypeFilterOptions: [],
      traceability: input.emptyTraceability,
      traceabilityMapSummary: [],
      visiblePatchPlans: [],
      writeBackReadinessSummary: null
    };
  }

  const visiblePatchPlans = filterPatchPlans({
    candidateTypeFilter: input.candidateTypeFilter,
    eligibilityFilter: input.eligibilityFilter,
    patchPlans: input.analysis.prPatchPlans
  });
  const traceability = input.buildTraceabilityViewModel(
    input.analysis,
    visiblePatchPlans
  );

  return {
    candidateTypeFilterOptions: getCandidateTypeFilterOptions(
      input.analysis.prPatchPlans
    ),
    traceability,
    traceabilityMapSummary: buildTraceabilityMapSummary(traceability),
    visiblePatchPlans,
    writeBackReadinessSummary: summarizeWriteBackReadiness(visiblePatchPlans)
  };
}

export function updateSelectedIds(
  selectedIds: string[],
  candidateId: string,
  selected: boolean
): string[] {
  if (selected) {
    return selectedIds.includes(candidateId)
      ? selectedIds
      : [...selectedIds, candidateId];
  }

  return selectedIds.filter((selectedId) => selectedId !== candidateId);
}
