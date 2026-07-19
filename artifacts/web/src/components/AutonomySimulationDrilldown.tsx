import type {
  AutonomySimulationOutcome,
  AutonomySimulationSummary
} from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./ui";

type AutonomySimulationDrilldownProps = {
  simulation: AutonomySimulationSummary;
};

function outcomeTone(
  outcome: AutonomySimulationOutcome
): "active" | "warning" | "danger" {
  if (outcome === "would_allow") {
    return "active";
  }

  if (outcome === "manual_review") {
    return "warning";
  }

  return "danger";
}

function readinessTone(
  readiness: "ready" | "needs_review" | "blocked"
): "active" | "warning" | "danger" {
  if (readiness === "ready") {
    return "active";
  }

  if (readiness === "needs_review") {
    return "warning";
  }

  return "danger";
}

function formatOutcomeLabel(outcome: AutonomySimulationOutcome): string {
  return outcome.replace(/_/gu, " ");
}

export function AutonomySimulationDrilldown({
  simulation
}: AutonomySimulationDrilldownProps) {
  return (
    <div className="autonomy-drilldown">
      <div className="fleet-panel-toolbar">
        <div>
          <p className="subsection-label">Autonomy drill-down</p>
          <p className="empty-copy">
            Compare the current supervised flow with the proposed dry-run profile,
            then inspect readiness, action previews, recommendations, and plan-only
            sweep outcomes.
          </p>
        </div>
        <div className="badge-row">
          <StatusBadge label={simulation.policyProfile.replace(/_/gu, " ")} tone="info" />
          <StatusBadge
            label={`Simulated ${formatTimestamp(simulation.generatedAt)}`}
            tone="up-next"
          />
        </div>
      </div>

      <section className="autonomy-section" aria-label="Manual versus simulated flow">
        <p className="subsection-label">Manual vs simulated flow</p>
        <div className="fleet-metric-grid">
          <article className="fleet-metric-card">
            <span>Current manual flow</span>
            <strong>{simulation.comparison.currentManualFlow.candidateActions}</strong>
            <p>
              Candidate actions still require explicit approval
              {simulation.comparison.currentManualFlow.requiresApproval
                ? " before any write."
                : "."}
            </p>
          </article>
          <article className="fleet-metric-card">
            <span>Simulated pull requests</span>
            <strong>
              {simulation.comparison.simulatedAutonomousFlow.pullRequestsOpened}
            </strong>
            <p>
              Proposed low-risk autonomy would open these PRs; unattended writes stay
              at {simulation.comparison.simulatedAutonomousFlow.unattendedWrites}.
            </p>
          </article>
          <article className="fleet-metric-card">
            <span>Simulated manual review</span>
            <strong>
              {simulation.comparison.simulatedAutonomousFlow.manualReviewActions}
            </strong>
            <p>Actions that remain supervised under the proposed dry-run profile.</p>
          </article>
        </div>
      </section>

      <section className="autonomy-section" aria-label="Repository readiness">
        <p className="subsection-label">Repository readiness</p>
        {simulation.repositoryReadiness.length > 0 ? (
          <div className="fleet-card-list">
            {simulation.repositoryReadiness.map((entry) => (
              <article className="fleet-entity-card" key={entry.trackedRepositoryId}>
                <div className="trace-card-header">
                  <div>
                    <h3>{entry.repositoryFullName}</h3>
                    <p className="trace-copy">
                      {entry.executablePatchPlans} executable · {entry.blockedPatchPlans}{" "}
                      blocked · {entry.stalePatchPlans} stale · {entry.openPullRequests}{" "}
                      open PRs
                    </p>
                  </div>
                  <StatusBadge
                    label={entry.readiness.replace(/_/gu, " ")}
                    tone={readinessTone(entry.readiness)}
                  />
                </div>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    {entry.installationBacked
                      ? "installation backed"
                      : "installation missing"}
                  </span>
                </div>
                {entry.blockers.length > 0 ? (
                  <ul className="autonomy-signal-list">
                    {entry.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                ) : null}
                {entry.warnings.length > 0 ? (
                  <ul className="autonomy-signal-list autonomy-signal-list-muted">
                    {entry.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>No repository readiness signals in this simulation.</EmptyState>
        )}
      </section>

      <section className="autonomy-section" aria-label="Action previews">
        <p className="subsection-label">Action previews</p>
        {simulation.actionPreviews.length > 0 ? (
          <div className="fleet-card-list">
            {simulation.actionPreviews.map((preview) => (
              <article
                className="fleet-entity-card"
                key={`${preview.trackedRepositoryId}:${preview.actionType}`}
              >
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">
                      {preview.actionType.replace(/_/gu, " ")}
                    </p>
                    <h3>{preview.repositoryFullName}</h3>
                    <p className="trace-copy">
                      {preview.candidateActionCount} candidate action
                      {preview.candidateActionCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusBadge
                    label={formatOutcomeLabel(preview.outcome)}
                    tone={outcomeTone(preview.outcome)}
                  />
                </div>
                {preview.reasons.length > 0 ? (
                  <ul className="autonomy-signal-list">
                    {preview.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="trace-chip-row">
                  {preview.evidence.map((item) => (
                    <span className="trace-chip trace-chip-muted" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>No candidate action previews in this simulation.</EmptyState>
        )}
      </section>

      <section className="autonomy-section" aria-label="Policy recommendations">
        <p className="subsection-label">Recommendations</p>
        {simulation.recommendations.length > 0 ? (
          <div className="fleet-card-list">
            {simulation.recommendations.map((recommendation) => (
              <article
                className="fleet-entity-card"
                key={recommendation.recommendationId}
              >
                <div className="trace-card-header">
                  <div>
                    <h3>{recommendation.title}</h3>
                    <p className="trace-copy">{recommendation.rationale}</p>
                  </div>
                  <StatusBadge
                    label={`${recommendation.blastRadius.repositoriesAffected} repos`}
                    tone="info"
                  />
                </div>
                <p className="trace-copy">
                  Blast radius: {recommendation.blastRadius.candidateActions} candidate
                  actions across {recommendation.blastRadius.repositoriesAffected}{" "}
                  repositories.
                </p>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    allow {recommendation.expectedActionCounts.wouldAllow}
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    review {recommendation.expectedActionCounts.manualReview}
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    block {recommendation.expectedActionCounts.wouldBlock}
                  </span>
                </div>
                {recommendation.evidence.length > 0 ? (
                  <ul className="autonomy-signal-list autonomy-signal-list-muted">
                    {recommendation.evidence.slice(0, 6).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>No policy recommendations in this simulation.</EmptyState>
        )}
      </section>

      <section className="autonomy-section" aria-label="Sweep schedule dry-run">
        <div className="fleet-panel-toolbar">
          <div>
            <p className="subsection-label">Sweep schedule dry-run</p>
            <p className="empty-copy">
              Plan-only sweep schedules are simulated without triggering jobs or
              opening pull requests.
            </p>
          </div>
          <div className="badge-row">
            <StatusBadge
              label={`${simulation.sweepScheduleOutcomeCounts.wouldAllow} allow`}
              tone="active"
            />
            <StatusBadge
              label={`${simulation.sweepScheduleOutcomeCounts.manualReview} review`}
              tone="warning"
            />
            <StatusBadge
              label={`${simulation.sweepScheduleOutcomeCounts.wouldBlock} block`}
              tone="danger"
            />
          </div>
        </div>
        {simulation.sweepSchedulePreviews.length > 0 ? (
          <div className="fleet-card-list">
            {simulation.sweepSchedulePreviews.map((preview) => (
              <article className="fleet-entity-card" key={preview.scheduleId}>
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">{preview.cadence}</p>
                    <h3>{preview.label}</h3>
                    <p className="trace-copy">
                      {preview.candidateRepositoryCount} candidate repositories ·{" "}
                      {preview.mode.replace(/_/gu, " ")}
                    </p>
                  </div>
                  <StatusBadge
                    label={formatOutcomeLabel(preview.outcome)}
                    tone={outcomeTone(preview.outcome)}
                  />
                </div>
                <div className="trace-chip-row">
                  <span className="trace-chip trace-chip-muted">
                    {preview.isActive ? "active" : "inactive"}
                  </span>
                  <span className="trace-chip trace-chip-muted">
                    {preview.selectionStrategy.replace(/_/gu, " ")}
                  </span>
                  <code>{preview.scheduleId}</code>
                </div>
                {preview.reasons.length > 0 ? (
                  <ul className="autonomy-signal-list">
                    {preview.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>No sweep schedules were included in this dry-run simulation.</EmptyState>
        )}
      </section>
    </div>
  );
}
