import type { FleetStatusResponse } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";
import { Button, EmptyState } from "./ui";

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

function renderQueueCard(input: {
  items: string[];
  label: string;
}) {
  return (
    <article className="fleet-metric-card" key={input.label}>
      <span>{input.label}</span>
      <strong>{input.items.length}</strong>
      <p>{input.items.length > 0 ? input.items.slice(0, 3).join(", ") : "Clear"}</p>
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
  const health = fleetStatus?.remediationHealth;
  const queues = fleetStatus?.attentionQueues;
  const simulation = fleetStatus?.autonomySimulation;
  const severityTotal = health
    ? Object.values(health.findingSeverityMix).reduce((sum, value) => sum + value, 0)
    : 0;
  const queueCards = queues
    ? [
        {
          items: queues.staleRepositories,
          label: "Stale queue"
        },
        {
          items: queues.blockedPlanRepositories,
          label: "Blocked queue"
        },
        {
          items: queues.failedJobs.map((job) => job.jobId),
          label: "Failed job queue"
        },
        {
          items: queues.openPullRequests.map(
            (pullRequest) =>
              `${pullRequest.repositoryFullName}#${pullRequest.pullRequestNumber}`
          ),
          label: "Open PR queue"
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
          <EmptyState>Review tracked repository health, queue outcomes, and remediation PR
            lifecycle without leaving the supervised Repo Guardian workflow.</EmptyState>
          <Button
            disabled={isLoading}
            icon={isLoading ? undefined : "refresh"}
            loading={isLoading}
            onClick={onRefresh}
          >
            {isLoading ? "Refreshing fleet..." : "Refresh fleet"}
          </Button>
        </div>
        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {fleetStatus ? (
          <>
            <div className="fleet-metric-grid">
              {metrics.map(renderMetricCard)}
            </div>
            {health ? (
              <div className="fleet-metric-grid">
                {renderMetricCard({
                  description: `${health.findingSeverityMix.critical} critical, ${health.findingSeverityMix.high} high, ${health.findingSeverityMix.medium} medium.`,
                  label: "Finding Mix",
                  value: severityTotal
                })}
                {renderMetricCard({
                  description:
                    health.ecosystemCoverage.length > 0
                      ? health.ecosystemCoverage
                          .map(
                            (entry) => `${entry.ecosystem}: ${entry.repositories}`
                          )
                          .join(", ")
                      : "No ecosystems in the latest fleet snapshot.",
                  label: "Ecosystems",
                  value: health.ecosystemCoverage.length
                })}
                {renderMetricCard({
                  description: `${health.installationCoverage.unlinkedRepositories} repositories still need installation-backed access.`,
                  label: "Installation coverage",
                  value:
                    health.installationCoverage.installationBackedRepositories
                })}
              </div>
            ) : null}
            {queueCards.length > 0 ? (
              <div className="fleet-metric-grid">
                {queueCards.map(renderQueueCard)}
              </div>
            ) : null}
            {simulation ? (
              <>
                <div className="fleet-panel-toolbar">
                  <p className="empty-copy">
                    Autonomy simulation previews proposed policy outcomes without
                    opening pull requests or performing unattended writes.
                  </p>
                  <StatusBadge label="No unattended writes" tone="muted" />
                </div>
                <div className="fleet-metric-grid">
                  {renderMetricCard({
                    description:
                      "Candidate actions that proposed low-risk autonomy would allow.",
                    label: "Would allow",
                    value: simulation.outcomeCounts.wouldAllow
                  })}
                  {renderMetricCard({
                    description:
                      "Candidate actions that still require supervised operator review.",
                    label: "Manual review",
                    value: simulation.outcomeCounts.manualReview
                  })}
                  {renderMetricCard({
                    description:
                      "Candidate actions blocked by stale analysis or missing executable plans.",
                    label: "Would block",
                    value: simulation.outcomeCounts.wouldBlock
                  })}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <EmptyState>Switch to Fleet Admin and refresh to load tracked repositories, jobs,
            schedules, and PR lifecycle state.</EmptyState>
        )}
      </div>
    </Panel>
  );
}
