import type { CompareAnalysisRunsResponse } from "@repo-guardian/shared-types";
import { buildCompareRunsViewModel } from "../features/compare/build-compare-view-model";
import { EmptyState } from "./ui";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type CompareRunsPanelProps = {
  comparison: CompareAnalysisRunsResponse | null;
};

function getMetricTone(
  label: string,
  delta: number
): "active" | "muted" | "warning" {
  if (delta === 0) {
    return "muted";
  }

  if (label === "Blocked patch plans" || label === "Total findings") {
    return delta > 0 ? "warning" : "active";
  }

  return delta > 0 ? "active" : "warning";
}

function EntitySetList({
  label,
  values
}: {
  label: string;
  values: string[];
}) {
  return values.length > 0 ? (
    <div>
      <p className="subsection-label">{label}</p>
      <ul className="simple-list">
        {values.map((value) => (
          <li key={`${label}:${value}`}>
            <code>{value}</code>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
}

export function CompareRunsPanel({ comparison }: CompareRunsPanelProps) {
  if (!comparison) {
    return (
      <Panel
        className="panel-wide"
        eyebrow="Compare"
        title="Saved run comparison"
      >
        <EmptyState>Select two saved runs and compare them to see finding, candidate,
          patch-plan, ecosystem, manifest, and lockfile deltas.</EmptyState>
      </Panel>
    );
  }

  const viewModel = buildCompareRunsViewModel(comparison);

  return (
    <Panel
      className="panel-wide"
      eyebrow="Compare"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={viewModel.isSameRepository ? "Same repository" : "Different repositories"}
            tone={viewModel.isSameRepository ? "active" : "warning"}
          />
          <StatusBadge
            label={`${viewModel.newFindingIds.length} new finding${viewModel.newFindingIds.length === 1 ? "" : "s"}`}
            tone={viewModel.newFindingIds.length > 0 ? "warning" : "muted"}
          />
          <StatusBadge
            label={`${viewModel.resolvedFindingIds.length} resolved finding${viewModel.resolvedFindingIds.length === 1 ? "" : "s"}`}
            tone={viewModel.resolvedFindingIds.length > 0 ? "active" : "muted"}
          />
        </div>
      }
      title="Saved run comparison"
    >
      <div className="compare-runs-shell">
        <div className="trace-card-header">
          <div>
            <p className="subsection-label">{viewModel.repositoryLabel}</p>
            <h3>
              {comparison.baseRun.label ?? comparison.baseRun.repositoryFullName} to{" "}
              {comparison.targetRun.label ?? comparison.targetRun.repositoryFullName}
            </h3>
          </div>
        </div>
        <p className="trace-copy">
          Base saved {formatTimestamp(comparison.baseRun.createdAt)}. Target saved{" "}
          {formatTimestamp(comparison.targetRun.createdAt)}.
        </p>
        <div className="compare-metric-grid">
          {[...viewModel.findingMetrics, ...viewModel.candidateMetrics].map((metric) => (
            <article className="compare-metric-card" key={metric.label}>
              <p className="subsection-label">{metric.label}</p>
              <strong>{metric.target.toLocaleString()}</strong>
              <StatusBadge
                label={metric.deltaLabel}
                tone={getMetricTone(metric.label, metric.delta)}
              />
              <p className="trace-copy">
                Base {metric.base.toLocaleString()} to target{" "}
                {metric.target.toLocaleString()}.
              </p>
            </article>
          ))}
        </div>
        <div className="trace-meta-grid">
          <EntitySetList label="New findings" values={viewModel.newFindingIds} />
          <EntitySetList
            label="Resolved findings"
            values={viewModel.resolvedFindingIds}
          />
        </div>
        <div className="compare-structure-list">
          {viewModel.structureChanges.map((change) => (
            <article className="trace-card" key={change.label}>
              <div className="trace-card-header">
                <div>
                  <p className="subsection-label">Structure delta</p>
                  <h3>{change.label}</h3>
                </div>
                <div className="badge-row">
                  <StatusBadge
                    label={`${change.added.length} added`}
                    tone={change.added.length > 0 ? "active" : "muted"}
                  />
                  <StatusBadge
                    label={`${change.removed.length} removed`}
                    tone={change.removed.length > 0 ? "warning" : "muted"}
                  />
                </div>
              </div>
              <div className="trace-meta-grid">
                <EntitySetList label="Added" values={change.added} />
                <EntitySetList label="Removed" values={change.removed} />
                <EntitySetList label="Unchanged" values={change.unchanged} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}
