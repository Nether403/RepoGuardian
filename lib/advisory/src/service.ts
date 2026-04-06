import type {
  AnalysisWarning,
  DependencyFinding,
  DependencyFindingSummary,
  DependencySnapshot
} from "@repo-guardian/shared-types";
import {
  createAnalysisWarning,
  dedupeAnalysisWarnings,
  getWarningMessages
} from "@repo-guardian/shared-types";
import { AdvisoryProviderError, type AdvisoryProvider } from "./provider.js";
import { matchAdvisoriesToTargets, buildDependencyFindingSummary } from "./findings.js";
import { createAdvisoryLookupPlan } from "./targets.js";

export type DependencyFindingResult = {
  findings: DependencyFinding[];
  isPartial: boolean;
  summary: DependencyFindingSummary;
  warningDetails: AnalysisWarning[];
  warnings: string[];
};

export async function createDependencyFindingResult(
  dependencySnapshot: DependencySnapshot,
  provider: AdvisoryProvider
): Promise<DependencyFindingResult> {
  const plan = createAdvisoryLookupPlan(dependencySnapshot);
  const warningDetails = [...plan.warningDetails];

  if (plan.targets.length === 0) {
    const isPartial = dependencySnapshot.isPartial || plan.isPartial;
    const dedupedWarningDetails = dedupeAnalysisWarnings(warningDetails);

    return {
      findings: [],
      isPartial,
      summary: buildDependencyFindingSummary([], isPartial),
      warningDetails: dedupedWarningDetails,
      warnings: getWarningMessages(dedupedWarningDetails)
    };
  }

  try {
    const lookupResult = await provider.lookupAdvisories(
      plan.targets.map((target) => target.query)
    );
    const isPartial =
      dependencySnapshot.isPartial || plan.isPartial || lookupResult.isPartial;
    const findings = matchAdvisoriesToTargets(
      plan.targets,
      lookupResult.advisoriesByQueryKey,
      isPartial
    );
    const dedupedWarningDetails = dedupeAnalysisWarnings([
      ...warningDetails,
      ...(lookupResult.warningDetails ?? [])
    ]);

    return {
      findings,
      isPartial,
      summary: buildDependencyFindingSummary(findings, isPartial),
      warningDetails: dedupedWarningDetails,
      warnings: getWarningMessages(dedupedWarningDetails)
    };
  } catch (error) {
    if (error instanceof AdvisoryProviderError) {
      const isPartial = true;
      const dedupedWarningDetails = dedupeAnalysisWarnings([
        ...warningDetails,
        createAnalysisWarning({
          code: "ADVISORY_PROVIDER_FAILED",
          message: `Advisory lookup could not be completed: ${error.message}`,
          source: provider.name,
          stage: "advisory"
        })
      ]);

      return {
        findings: [],
        isPartial,
        summary: buildDependencyFindingSummary([], isPartial),
        warningDetails: dedupedWarningDetails,
        warnings: getWarningMessages(dedupedWarningDetails)
      };
    }

    throw error;
  }
}
