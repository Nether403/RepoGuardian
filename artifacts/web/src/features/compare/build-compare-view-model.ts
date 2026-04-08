import type {
  CompareAnalysisRunsResponse,
  CompareEntitySetDelta,
  CompareMetricDelta
} from "@repo-guardian/shared-types";

export type CompareMetricViewModel = {
  base: number;
  delta: number;
  deltaLabel: string;
  label: string;
  target: number;
};

export type CompareEntitySetViewModel = {
  added: string[];
  label: string;
  removed: string[];
  unchanged: string[];
};

export type CompareRunsViewModel = {
  candidateMetrics: CompareMetricViewModel[];
  findingMetrics: CompareMetricViewModel[];
  isSameRepository: boolean;
  newFindingIds: string[];
  repositoryLabel: string;
  resolvedFindingIds: string[];
  structureChanges: CompareEntitySetViewModel[];
};

function formatDelta(delta: number): string {
  if (delta > 0) {
    return `+${delta.toLocaleString()}`;
  }

  return delta.toLocaleString();
}

function createMetric(
  label: string,
  metric: CompareMetricDelta
): CompareMetricViewModel {
  return {
    base: metric.base,
    delta: metric.delta,
    deltaLabel: formatDelta(metric.delta),
    label,
    target: metric.target
  };
}

function createSetChange(
  label: string,
  change: CompareEntitySetDelta
): CompareEntitySetViewModel {
  return {
    added: change.added,
    label,
    removed: change.removed,
    unchanged: change.unchanged
  };
}

export function buildCompareRunsViewModel(
  comparison: CompareAnalysisRunsResponse
): CompareRunsViewModel {
  return {
    candidateMetrics: [
      createMetric("Issue candidates", comparison.candidates.issueCandidates),
      createMetric("PR candidates", comparison.candidates.prCandidates),
      createMetric(
        "Executable patch plans",
        comparison.candidates.executablePatchPlans
      ),
      createMetric("Blocked patch plans", comparison.candidates.blockedPatchPlans)
    ],
    findingMetrics: [createMetric("Total findings", comparison.findings.total)],
    isSameRepository: comparison.repository.sameRepository,
    newFindingIds: comparison.findings.newFindingIds,
    repositoryLabel: comparison.repository.sameRepository
      ? comparison.repository.targetRepositoryFullName
      : `${comparison.repository.baseRepositoryFullName} vs ${comparison.repository.targetRepositoryFullName}`,
    resolvedFindingIds: comparison.findings.resolvedFindingIds,
    structureChanges: [
      createSetChange("Ecosystems", comparison.structure.ecosystems),
      createSetChange("Manifests", comparison.structure.manifests),
      createSetChange("Lockfiles", comparison.structure.lockfiles)
    ]
  };
}
