import type { FleetStatusResponse } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type FleetOverviewPanelProps = {
  errorMessage: string | null;
  fleetStatus: FleetStatusResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
};

function renderMetricCard(input: {
  description: string;
  label: string;
  value: number;
}) {
  return (
    <article className="fleet-metric-card" key={input.label}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
      <p>{input.description}</p>
    </article>
  );
}

export function FleetOverviewPanel({
  errorMessage,
  fleetStatus,
  isLoading,
  onRefresh
}: FleetOverviewPanelProps) {
  const summary = fleetStatus?.summary;
  const metrics = summary
    ? [
        {
          description: "Tracked repositories currently enrolled in repeat analysis.",
          label: "Tracked Repos",
          value: summary.trackedRepositories
        },
        {
          description: "Repositories whose latest saved run is stale.",
          label: "Stale Repos",
          value: summary.staleRepositories
        },
        {
          description: "Patch plans currently executable without widening policy.",
          label: "Executable Plans",
          value: summary.executablePatchPlans
        },
        {
          description: "Patch plans blocked by current readiness or policy constraints.",
          label: "Blocked Plans",
          value: summary.blockedPatchPlans
        },
        {
          description: "Patch plans counted as stale because the run is outdated.",
          label: "Stale Plans",
          value: summary.stalePatchPlans
        },
        {
          description: "Recent background jobs that currently need operator attention.",
          label: "Failed Jobs",
          value: summary.failedJobs
        },
        {
          description: "Tracked remediation pull requests still open.",
          label: "Open PRs",
          value: summary.openPullRequests
        },
        {
          description: "Tracked remediation pull requests already merged.",
          label: "Merged PRs",
          value: summary.mergedPullRequests
        }
      ]
    : [];

  return (
    <Panel
      className="panel-wide"
      eyebrow="Fleet Overview"
      footer={
        <div className="badge-row">
          <StatusBadge
            label={fleetStatus ? "Fleet snapshot loaded" : "Fleet snapshot not loaded"}
            tone={fleetStatus ? "active" : "muted"}
          />
          {fleetStatus ? (
            <StatusBadge
              label={`Updated ${formatTimestamp(fleetStatus.generatedAt)}`}
              tone="up-next"
            />
          ) : null}
        </div>
      }
      title="Fleet status"
    >
      <div className="fleet-panel-shell">
        <div className="fleet-panel-toolbar">
          <p className="empty-copy">
            Review tracked repository health, queue outcomes, and remediation PR
            lifecycle without leaving the supervised Repo Guardian workflow.
          </p>
          <button
            className="secondary-button"
            disabled={isLoading}
            onClick={onRefresh}
            type="button"
          >
            {isLoading ? "Refreshing fleet..." : "Refresh fleet"}
          </button>
        </div>
        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {fleetStatus ? (
          <div className="fleet-metric-grid">
            {metrics.map(renderMetricCard)}
          </div>
        ) : (
          <p className="empty-copy">
            Switch to Fleet Admin and refresh to load tracked repositories, jobs,
            schedules, and PR lifecycle state.
          </p>
        )}
      </div>
    </Panel>
  );
}
