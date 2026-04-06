import type {
  AnalysisWarning,
  PRCandidate,
  PRPatchPlan,
  PRPatchPlanSummary,
  PRPatchability,
  ValidationStatus
} from "@repo-guardian/shared-types";

const patchabilityOrder: Record<PRPatchability, number> = {
  patch_candidate: 0,
  patch_plan_only: 1,
  not_patchable: 2
};

const validationStatusOrder: Record<ValidationStatus, number> = {
  ready: 0,
  ready_with_warnings: 1,
  not_run: 2,
  blocked: 3,
  not_applicable: 4
};

const globalPatchWarningCodes = new Set<AnalysisWarning["code"]>([
  "TREE_TRUNCATED",
  "PAYLOAD_CAPPED",
  "ADVISORY_LOOKUP_PARTIAL",
  "ADVISORY_PROVIDER_FAILED"
]);

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function selectPatchWarnings(
  warnings: AnalysisWarning[],
  candidate: Pick<PRCandidate, "affectedPaths">
): AnalysisWarning[] {
  return warnings.filter((warning) => {
    if (warning.paths.length === 0) {
      return globalPatchWarningCodes.has(warning.code);
    }

    return warning.paths.some((path) => candidate.affectedPaths.includes(path));
  });
}

export function buildPRPatchPlanSummary(
  plans: PRPatchPlan[]
): PRPatchPlanSummary {
  const byPatchability = new Map<PRPatchability, number>();
  const byValidationStatus = new Map<ValidationStatus, number>();

  for (const plan of plans) {
    byPatchability.set(
      plan.patchability,
      (byPatchability.get(plan.patchability) ?? 0) + 1
    );
    byValidationStatus.set(
      plan.validationStatus,
      (byValidationStatus.get(plan.validationStatus) ?? 0) + 1
    );
  }

  return {
    byPatchability: [...byPatchability.entries()]
      .map(([patchability, count]) => ({ patchability, count }))
      .sort(
        (left, right) =>
          patchabilityOrder[left.patchability] - patchabilityOrder[right.patchability]
      ),
    byValidationStatus: [...byValidationStatus.entries()]
      .map(([validationStatus, count]) => ({ validationStatus, count }))
      .sort(
        (left, right) =>
          validationStatusOrder[left.validationStatus] -
          validationStatusOrder[right.validationStatus]
      ),
    totalPatchCandidates: plans.filter(
      (plan) => plan.patchability === "patch_candidate"
    ).length,
    totalPlans: plans.length
  };
}

export function dedupePatchPlanWarnings(messages: string[]): string[] {
  return uniqueSorted(messages.filter((message) => message.trim().length > 0));
}
