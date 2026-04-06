import type {
  DependencyFinding,
  DependencyFindingSummary,
  DependencySnapshot
} from "@repo-guardian/shared-types";
import { AdvisoryProviderError, type AdvisoryProvider } from "./provider.js";
import { matchAdvisoriesToTargets, buildDependencyFindingSummary } from "./findings.js";
import { createAdvisoryLookupPlan } from "./targets.js";

export type DependencyFindingResult = {
  findings: DependencyFinding[];
  isPartial: boolean;
  summary: DependencyFindingSummary;
  warnings: string[];
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export async function createDependencyFindingResult(
  dependencySnapshot: DependencySnapshot,
  provider: AdvisoryProvider
): Promise<DependencyFindingResult> {
  const plan = createAdvisoryLookupPlan(dependencySnapshot);
  const warnings = [...plan.warnings];

  if (plan.targets.length === 0) {
    const isPartial = dependencySnapshot.isPartial || plan.isPartial;

    return {
      findings: [],
      isPartial,
      summary: buildDependencyFindingSummary([], isPartial),
      warnings: uniqueSorted(warnings)
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

    return {
      findings,
      isPartial,
      summary: buildDependencyFindingSummary(findings, isPartial),
      warnings: uniqueSorted([...warnings, ...lookupResult.warnings])
    };
  } catch (error) {
    if (error instanceof AdvisoryProviderError) {
      const isPartial = true;

      return {
        findings: [],
        isPartial,
        summary: buildDependencyFindingSummary([], isPartial),
        warnings: uniqueSorted([
          ...warnings,
          `Advisory lookup could not be completed: ${error.message}`
        ])
      };
    }

    throw error;
  }
}
