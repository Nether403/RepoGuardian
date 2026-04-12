import { useEffect, useState } from "react";
import type {
  AnalysisJob,
  CodeReviewFinding,
  ExecutionPlanDetailResponse,
  ExecutionPlanEventsResponse,
  GetAnalysisRunResponse,
  IssueCandidate,
  PRCandidate,
  RepositoryActivityEvent,
  RepositoryActivityKind,
  TrackedRepositoryHistoryResponse
} from "@repo-guardian/shared-types";
import {
  buildTraceabilityViewModel,
  formatTimestamp
} from "../features/analysis/view-model";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type InspectorSelection =
  | {
      id: string;
      kind: "job";
    }
  | {
      id: string;
      kind: "plan";
    }
  | {
      id: string;
      kind: "repository";
    }
  | {
      id: string;
      kind: "run";
    };

type FleetInspectorPanelProps = {
  errorMessage: string | null;
  isLoading: boolean;
  jobDetail: AnalysisJob | null;
  onClose: () => void;
  onOpenPlan: (planId: string) => void;
  onOpenRun: (runId: string) => void;
  onRefresh: () => void;
  planDetail: ExecutionPlanDetailResponse | null;
  planEvents: ExecutionPlanEventsResponse | null;
  planRunDetail: GetAnalysisRunResponse | null;
  repositoryHistory: TrackedRepositoryHistoryResponse | null;
  runDetail: GetAnalysisRunResponse | null;
  selection: InspectorSelection | null;
};

function getJobTone(status: AnalysisJob["status"]): "active" | "muted" | "up-next" | "warning" {
  switch (status) {
    case "completed":
      return "active";
    case "running":
      return "up-next";
    case "failed":
      return "warning";
    default:
      return "muted";
  }
}

function getPlanTone(
  status: ExecutionPlanDetailResponse["status"]
): "active" | "muted" | "up-next" | "warning" {
  switch (status) {
    case "completed":
      return "active";
    case "executing":
    case "planned":
      return "up-next";
    case "failed":
    case "expired":
    case "cancelled":
      return "warning";
    default:
      return "muted";
  }
}

function getHistoryTitle(selection: InspectorSelection | null): string {
  switch (selection?.kind) {
    case "job":
      return "Job detail";
    case "plan":
      return "Plan detail";
    case "repository":
      return "Tracked repository history";
    case "run":
      return "Run detail";
    default:
      return "Fleet inspector";
  }
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item] as const)).values()];
}

function formatActivityKind(kind: RepositoryActivityKind): string {
  return kind.replace(/_/gu, " ");
}

function getActivityTone(activity: RepositoryActivityEvent): "active" | "muted" | "up-next" | "warning" {
  switch (activity.kind) {
    case "analysis_job":
      return getJobTone(activity.status as AnalysisJob["status"]);
    case "execution_plan":
      return getPlanTone(activity.status as ExecutionPlanDetailResponse["status"]);
    case "tracked_pull_request":
      return activity.status === "merged"
        ? "active"
        : activity.status === "closed"
          ? "warning"
          : "up-next";
    case "execution_event":
      return activity.status.includes("failed")
        ? "warning"
        : activity.status.includes("completed") || activity.status.includes("approved")
          ? "active"
          : "up-next";
    case "analysis_run":
      return "active";
  }
}

function getPrimaryActivityAction(activity: RepositoryActivityEvent): {
  label: string;
  targetId: string;
  type: "plan" | "run";
} | null {
  if (activity.planId) {
    return {
      label: "Open plan",
      targetId: activity.planId,
      type: "plan"
    };
  }

  if (activity.runId) {
    return {
      label: "Open run",
      targetId: activity.runId,
      type: "run"
    };
  }

  return null;
}

function collectPlanTraceability(planDetail: ExecutionPlanDetailResponse, planRunDetail: GetAnalysisRunResponse | null): {
  findings: Array<CodeReviewFinding | import("@repo-guardian/shared-types").DependencyFinding>;
  issueCandidates: IssueCandidate[];
  prCandidates: PRCandidate[];
} {
  if (!planRunDetail) {
    return {
      findings: [],
      issueCandidates: [],
      prCandidates: []
    };
  }

  const traceability = buildTraceabilityViewModel(planRunDetail.run.analysis);
  const prCandidates = dedupeById(
    planDetail.actions.flatMap((action) =>
      action.linkedPRCandidateIds
        .map((candidateId) => traceability.prCandidateById.get(candidateId))
        .filter((candidate): candidate is PRCandidate => Boolean(candidate))
    )
  );
  const issueCandidates = dedupeById(
    planDetail.actions.flatMap((action) =>
      action.linkedIssueCandidateIds
        .map((candidateId) => traceability.issueCandidateById.get(candidateId))
        .filter((candidate): candidate is IssueCandidate => Boolean(candidate))
    )
  );
  const findingIds = new Set<string>();

  for (const candidate of prCandidates) {
    for (const findingId of candidate.relatedFindingIds) {
      findingIds.add(findingId);
    }
  }

  for (const candidate of issueCandidates) {
    for (const findingId of candidate.relatedFindingIds) {
      findingIds.add(findingId);
    }
  }

  const findings = [...findingIds]
    .map((findingId) => traceability.findingById.get(findingId))
    .filter(
      (
        finding
      ): finding is CodeReviewFinding | import("@repo-guardian/shared-types").DependencyFinding =>
        Boolean(finding)
    );

  return {
    findings,
    issueCandidates,
    prCandidates
  };
}

export function FleetInspectorPanel({
  errorMessage,
  isLoading,
  jobDetail,
  onClose,
  onOpenPlan,
  onOpenRun,
  onRefresh,
  planDetail,
  planEvents,
  planRunDetail,
  repositoryHistory,
  runDetail,
  selection
}: FleetInspectorPanelProps) {
  const [activityKindFilter, setActivityKindFilter] = useState<"all" | RepositoryActivityKind>("all");

  useEffect(() => {
    setActivityKindFilter("all");
  }, [selection?.id, selection?.kind]);

  const repositoryTimeline =
    repositoryHistory === null
      ? []
      : repositoryHistory.activityFeed.events.filter(
          (activity) => activityKindFilter === "all" || activity.kind === activityKindFilter
        );
  const planTraceability =
    selection?.kind === "plan" && planDetail
      ? collectPlanTraceability(planDetail, planRunDetail)
      : {
          findings: [],
          issueCandidates: [],
          prCandidates: []
        };

  return (
    <Panel
      className="panel-half fleet-inspector-panel"
      eyebrow="Inspector"
      footer={
        <div className="fleet-inline-actions">
          <button className="secondary-button" onClick={onRefresh} type="button">
            Refresh detail
          </button>
          <button className="secondary-button" onClick={onClose} type="button">
            Close inspector
          </button>
        </div>
      }
      title={getHistoryTitle(selection)}
    >
      <div className="fleet-panel-shell">
        {!selection ? (
          <p className="empty-copy">
            Select a job, tracked repository, run, or linked plan to inspect the
            underlying remediation context without leaving Fleet Admin.
          </p>
        ) : null}
        {isLoading ? <p className="empty-copy">Loading inspector detail...</p> : null}
        {errorMessage ? (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {!isLoading && !errorMessage && selection?.kind === "job" && jobDetail ? (
          <div className="stack-list">
            <div className="trace-card-header">
              <div>
                <p className="subsection-label">{jobDetail.repositoryFullName}</p>
                <h3>{jobDetail.label ?? jobDetail.jobId}</h3>
              </div>
              <StatusBadge label={jobDetail.status} tone={getJobTone(jobDetail.status)} />
            </div>
            <div className="trace-chip-row">
              <span className="trace-chip trace-chip-muted">
                kind {jobDetail.jobKind.replace(/_/gu, " ")}
              </span>
              <span className="trace-chip trace-chip-muted">
                attempts {jobDetail.attemptCount}/{jobDetail.maxAttempts}
              </span>
              <span className="trace-chip trace-chip-muted">
                queued {formatTimestamp(jobDetail.queuedAt)}
              </span>
            </div>
            <dl className="meta-grid">
              <div>
                <dt>Started</dt>
                <dd>{jobDetail.startedAt ? formatTimestamp(jobDetail.startedAt) : "Not started"}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{jobDetail.completedAt ? formatTimestamp(jobDetail.completedAt) : "Not completed"}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{jobDetail.failedAt ? formatTimestamp(jobDetail.failedAt) : "No failure"}</dd>
              </div>
              <div>
                <dt>Tracked Repository</dt>
                <dd>{jobDetail.trackedRepositoryId ?? "Ad hoc"}</dd>
              </div>
            </dl>
            {jobDetail.errorMessage ? (
              <p className="form-message form-message-error">{jobDetail.errorMessage}</p>
            ) : null}
            <div className="fleet-inline-actions">
              {jobDetail.runId ? (
                <button
                  className="secondary-button"
                  onClick={() => onOpenRun(jobDetail.runId!)}
                  type="button"
                >
                  Open run
                </button>
              ) : null}
              {jobDetail.planId ? (
                <button
                  className="secondary-button"
                  onClick={() => onOpenPlan(jobDetail.planId!)}
                  type="button"
                >
                  Open plan
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {!isLoading &&
        !errorMessage &&
        selection?.kind === "repository" &&
        repositoryHistory ? (
          <div className="stack-list">
            <div className="trace-card-header">
              <div>
                <p className="subsection-label">{repositoryHistory.trackedRepository.fullName}</p>
                <h3>{repositoryHistory.trackedRepository.label ?? "Tracked repository"}</h3>
              </div>
              <StatusBadge
                label={repositoryHistory.currentStatus.stale ? "Stale run" : "Fresh run"}
                tone={repositoryHistory.currentStatus.stale ? "warning" : "active"}
              />
            </div>
            <div className="trace-chip-row">
              <span className="trace-chip trace-chip-muted">
                {repositoryHistory.currentStatus.patchPlanCounts.executable} executable
              </span>
              <span className="trace-chip trace-chip-muted">
                {repositoryHistory.currentStatus.patchPlanCounts.blocked} blocked
              </span>
              <span className="trace-chip trace-chip-muted">
                {repositoryHistory.currentStatus.patchPlanCounts.stale} stale
              </span>
            </div>
            <div className="fleet-inspector-block">
              <h3>Repository timeline</h3>
              <div className="trace-chip-row">
                <button
                  className="secondary-button"
                  onClick={() => setActivityKindFilter("all")}
                  type="button"
                >
                  All activity
                </button>
                {repositoryHistory.activityFeed.availableKinds.map((kind) => (
                  <button
                    className="secondary-button"
                    key={kind}
                    onClick={() => setActivityKindFilter(kind)}
                    type="button"
                  >
                    {formatActivityKind(kind)}
                  </button>
                ))}
              </div>
              {repositoryTimeline.length > 0 ? (
                <div className="fleet-timeline">
                  {repositoryTimeline.map((activity) => {
                    const primaryAction = getPrimaryActivityAction(activity);

                    return (
                    <article className="fleet-timeline-item" key={activity.activityId}>
                      <div className="fleet-timeline-marker" aria-hidden="true" />
                      <div className="fleet-timeline-content">
                        <div className="trace-card-header">
                          <div>
                            <p className="subsection-label">{formatActivityKind(activity.kind)}</p>
                            <h3>{activity.title}</h3>
                          </div>
                          <StatusBadge label={activity.status} tone={getActivityTone(activity)} />
                        </div>
                        <p className="trace-copy">{formatTimestamp(activity.occurredAt)}</p>
                        {activity.summary ? (
                          <p className="trace-copy">{activity.summary}</p>
                        ) : null}
                        <div className="fleet-inline-actions">
                          {primaryAction ? (
                            <button
                              className="secondary-button"
                              onClick={() =>
                                primaryAction.type === "plan"
                                  ? onOpenPlan(primaryAction.targetId)
                                  : onOpenRun(primaryAction.targetId)
                              }
                              type="button"
                            >
                              {primaryAction.label}
                            </button>
                          ) : null}
                          {activity.pullRequestUrl ? (
                            <a
                              className="secondary-button fleet-link-button"
                              href={activity.pullRequestUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Open GitHub PR
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-copy">
                  No {activityKindFilter === "all" ? "" : formatActivityKind(activityKindFilter) + " "}events recorded for this repository yet.
                </p>
              )}
            </div>
            <div className="fleet-inspector-block">
              <h3>Recent runs</h3>
              {repositoryHistory.recentRuns.length > 0 ? (
                <div className="fleet-card-list">
                  {repositoryHistory.recentRuns.map((run) => (
                    <article className="fleet-entity-card" key={run.id}>
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">{run.repositoryFullName}</p>
                          <h3>{run.label ?? run.id}</h3>
                        </div>
                        <StatusBadge
                          label={`${run.executablePatchPlans} executable`}
                          tone={run.executablePatchPlans > 0 ? "active" : "muted"}
                        />
                      </div>
                      <p className="trace-copy">
                        Snapshot {formatTimestamp(run.fetchedAt)} with {run.totalFindings} findings.
                      </p>
                      <div className="fleet-inline-actions">
                        <button
                          className="secondary-button"
                          onClick={() => onOpenRun(run.id)}
                          type="button"
                        >
                          Open run
                        </button>
                        {run.execution?.latestPlanId ? (
                          <button
                            className="secondary-button"
                            onClick={() => onOpenPlan(run.execution!.latestPlanId)}
                            type="button"
                          >
                            Open latest plan
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">No saved runs recorded for this repository yet.</p>
              )}
            </div>
            <div className="fleet-inspector-block">
              <h3>Recent jobs</h3>
              {repositoryHistory.recentJobs.length > 0 ? (
                <div className="fleet-card-list">
                  {repositoryHistory.recentJobs.map((job) => (
                    <article className="fleet-entity-card" key={job.jobId}>
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">{job.jobKind.replace(/_/gu, " ")}</p>
                          <h3>{job.label ?? job.jobId}</h3>
                        </div>
                        <StatusBadge label={job.status} tone={getJobTone(job.status)} />
                      </div>
                      <div className="fleet-inline-actions">
                        <button
                          className="secondary-button"
                          onClick={() => onOpenRun(job.runId ?? repositoryHistory.recentRuns[0]?.id ?? "")}
                          type="button"
                          disabled={!job.runId && !repositoryHistory.recentRuns[0]?.id}
                        >
                          Open run
                        </button>
                        {job.planId ? (
                          <button
                            className="secondary-button"
                            onClick={() => onOpenPlan(job.planId!)}
                            type="button"
                          >
                            Open plan
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">No queued history recorded for this repository yet.</p>
              )}
            </div>
            <div className="fleet-inspector-block">
              <h3>Related plans</h3>
              {repositoryHistory.recentPlans.length > 0 ? (
                <div className="fleet-card-list">
                  {repositoryHistory.recentPlans.map((plan) => (
                    <article className="fleet-entity-card" key={plan.planId}>
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">{plan.repositoryFullName}</p>
                          <h3>{plan.planId}</h3>
                        </div>
                        <StatusBadge label={plan.status} tone={getPlanTone(plan.status)} />
                      </div>
                      <p className="trace-copy">
                        Created {formatTimestamp(plan.createdAt)} with {plan.summary.totalActions} actions.
                      </p>
                      <div className="fleet-inline-actions">
                        <button
                          className="secondary-button"
                          onClick={() => onOpenPlan(plan.planId)}
                          type="button"
                        >
                          Open plan
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">No durable execution plans recorded yet.</p>
              )}
            </div>
            <div className="fleet-inspector-block">
              <h3>Tracked pull requests</h3>
              {repositoryHistory.trackedPullRequests.length > 0 ? (
                <div className="fleet-card-list">
                  {repositoryHistory.trackedPullRequests.map((pullRequest) => (
                    <article className="fleet-entity-card" key={pullRequest.trackedPullRequestId}>
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">#{pullRequest.pullRequestNumber}</p>
                          <h3>{pullRequest.title}</h3>
                        </div>
                        <StatusBadge
                          label={pullRequest.lifecycleStatus}
                          tone={
                            pullRequest.lifecycleStatus === "merged"
                              ? "active"
                              : pullRequest.lifecycleStatus === "closed"
                                ? "warning"
                                : "up-next"
                          }
                        />
                      </div>
                      <div className="fleet-inline-actions">
                        {pullRequest.planId ? (
                          <button
                            className="secondary-button"
                            onClick={() => onOpenPlan(pullRequest.planId!)}
                            type="button"
                          >
                            Open plan
                          </button>
                        ) : null}
                        <a
                          className="secondary-button fleet-link-button"
                          href={pullRequest.pullRequestUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open GitHub PR
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">No tracked remediation pull requests recorded yet.</p>
              )}
            </div>
          </div>
        ) : null}
        {!isLoading && !errorMessage && selection?.kind === "run" && runDetail ? (
          <div className="stack-list">
            <div className="trace-card-header">
              <div>
                <p className="subsection-label">{runDetail.summary.repositoryFullName}</p>
                <h3>{runDetail.summary.label ?? runDetail.summary.id}</h3>
              </div>
              <StatusBadge
                label={`${runDetail.summary.totalFindings} findings`}
                tone={runDetail.summary.totalFindings > 0 ? "warning" : "muted"}
              />
            </div>
            <dl className="meta-grid">
              <div>
                <dt>Fetched</dt>
                <dd>{formatTimestamp(runDetail.summary.fetchedAt)}</dd>
              </div>
              <div>
                <dt>Branch</dt>
                <dd>{runDetail.summary.defaultBranch}</dd>
              </div>
              <div>
                <dt>Issue Candidates</dt>
                <dd>{runDetail.summary.issueCandidates}</dd>
              </div>
              <div>
                <dt>PR Candidates</dt>
                <dd>{runDetail.summary.prCandidates}</dd>
              </div>
              <div>
                <dt>Executable Patch Plans</dt>
                <dd>{runDetail.summary.executablePatchPlans}</dd>
              </div>
              <div>
                <dt>Blocked Patch Plans</dt>
                <dd>{runDetail.summary.blockedPatchPlans}</dd>
              </div>
            </dl>
            {runDetail.summary.execution?.latestPlanId ? (
              <div className="fleet-inline-actions">
                <button
                  className="secondary-button"
                  onClick={() => onOpenPlan(runDetail.summary.execution!.latestPlanId)}
                  type="button"
                >
                  Open latest plan
                </button>
              </div>
            ) : null}
            <div className="trace-chip-row">
              <span className="trace-chip trace-chip-muted">
                dependency findings {runDetail.run.analysis.dependencyFindings.length}
              </span>
              <span className="trace-chip trace-chip-muted">
                review findings {runDetail.run.analysis.codeReviewFindings.length}
              </span>
              <span className="trace-chip trace-chip-muted">
                patch plans {runDetail.run.analysis.prPatchPlans.length}
              </span>
            </div>
            {runDetail.run.analysis.warnings.length > 0 ? (
              <div className="fleet-inspector-block">
                <h3>Warnings</h3>
                <ul className="tag-list">
                  {runDetail.run.analysis.warnings.slice(0, 5).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {!isLoading && !errorMessage && selection?.kind === "plan" && planDetail ? (
          <div className="stack-list">
            <div className="trace-card-header">
              <div>
                <p className="subsection-label">{planDetail.repository.fullName}</p>
                <h3>{planDetail.planId}</h3>
              </div>
              <StatusBadge label={planDetail.status} tone={getPlanTone(planDetail.status)} />
            </div>
            <dl className="meta-grid">
              <div>
                <dt>Created</dt>
                <dd>{formatTimestamp(planDetail.createdAt)}</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>{planDetail.approval.status}</dd>
              </div>
              <div>
                <dt>Execution</dt>
                <dd>{planDetail.executionId ?? "Not started"}</dd>
              </div>
              <div>
                <dt>Actions</dt>
                <dd>{planDetail.actions.length}</dd>
              </div>
            </dl>
            <div className="fleet-inline-actions">
              <button
                className="secondary-button"
                onClick={() => onOpenRun(planDetail.analysisRunId)}
                type="button"
              >
                Open source run
              </button>
            </div>
            <div className="fleet-inspector-block">
              <h3>Actions</h3>
              <div className="fleet-card-list">
                {planDetail.actions.map((action) => (
                  <article className="fleet-entity-card" key={action.id}>
                    <div className="trace-card-header">
                      <div>
                        <p className="subsection-label">{action.actionType.replace(/_/gu, " ")}</p>
                        <h3>{action.title}</h3>
                      </div>
                      <StatusBadge
                        label={action.succeeded ? "Succeeded" : action.eligibility}
                        tone={
                          action.succeeded
                            ? "active"
                            : action.blocked
                              ? "warning"
                              : action.eligibility === "eligible"
                                ? "up-next"
                                : "muted"
                        }
                      />
                    </div>
                    <p className="trace-copy">{action.reason}</p>
                    {action.linkedPRCandidateIds.length > 0 ||
                    action.linkedIssueCandidateIds.length > 0 ? (
                      <div className="trace-chip-row">
                        {action.linkedPRCandidateIds.length > 0 ? (
                          <a
                            className="secondary-button fleet-link-button"
                            href="#plan-traceability-pr-candidates"
                          >
                            Linked PR candidates
                          </a>
                        ) : null}
                        {action.linkedIssueCandidateIds.length > 0 ? (
                          <a
                            className="secondary-button fleet-link-button"
                            href="#plan-traceability-issue-candidates"
                          >
                            Linked issue candidates
                          </a>
                        ) : null}
                        {(action.linkedPRCandidateIds.length > 0 ||
                          action.linkedIssueCandidateIds.length > 0) &&
                        planTraceability.findings.length > 0 ? (
                          <a
                            className="secondary-button fleet-link-button"
                            href="#plan-traceability-findings"
                          >
                            Originating findings
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="fleet-inline-actions">
                      {action.issueUrl ? (
                        <a
                          className="secondary-button fleet-link-button"
                          href={action.issueUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open issue
                        </a>
                      ) : null}
                      {action.pullRequestUrl ? (
                        <a
                          className="secondary-button fleet-link-button"
                          href={action.pullRequestUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open PR
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
            {planRunDetail ? (
              <>
                <div className="fleet-inspector-block" id="plan-traceability-pr-candidates">
                  <h3>Linked PR candidates</h3>
                  {planTraceability.prCandidates.length > 0 ? (
                    <div className="fleet-card-list">
                      {planTraceability.prCandidates.map((candidate) => (
                        <article className="fleet-entity-card" key={candidate.id}>
                          <div className="trace-card-header">
                            <div>
                              <p className="subsection-label">{candidate.candidateType}</p>
                              <h3>{candidate.title}</h3>
                            </div>
                            <StatusBadge label={candidate.readiness} tone="up-next" />
                          </div>
                          <p className="trace-copy">{candidate.summary}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">No PR candidates are linked to this plan's actions.</p>
                  )}
                </div>
                <div className="fleet-inspector-block" id="plan-traceability-issue-candidates">
                  <h3>Linked issue candidates</h3>
                  {planTraceability.issueCandidates.length > 0 ? (
                    <div className="fleet-card-list">
                      {planTraceability.issueCandidates.map((candidate) => (
                        <article className="fleet-entity-card" key={candidate.id}>
                          <div className="trace-card-header">
                            <div>
                              <p className="subsection-label">{candidate.candidateType}</p>
                              <h3>{candidate.title}</h3>
                            </div>
                            <StatusBadge label={candidate.scope} tone="muted" />
                          </div>
                          <p className="trace-copy">{candidate.summary}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">
                      No issue candidates are linked to this plan's actions.
                    </p>
                  )}
                </div>
                <div className="fleet-inspector-block" id="plan-traceability-findings">
                  <h3>Originating findings</h3>
                  {planTraceability.findings.length > 0 ? (
                    <div className="fleet-card-list">
                      {planTraceability.findings.map((finding) => (
                        <article className="fleet-entity-card" key={finding.id}>
                          <div className="trace-card-header">
                            <div>
                              <p className="subsection-label">{finding.sourceType}</p>
                              <h3>{finding.title}</h3>
                            </div>
                            <StatusBadge label={finding.severity} tone="warning" />
                          </div>
                          <p className="trace-copy">{finding.summary}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">
                      No findings could be resolved from the linked plan actions.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="fleet-inspector-block">
                <h3>Traceability source</h3>
                <p className="empty-copy">
                  Open the source run to inspect the underlying findings and candidates.
                </p>
              </div>
            )}
            <div className="fleet-inspector-block">
              <h3>Audit events</h3>
              {planEvents && planEvents.events.length > 0 ? (
                <div className="fleet-card-list">
                  {planEvents.events.map((event) => (
                    <article className="fleet-entity-card" key={event.eventId}>
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">{event.eventType.replace(/_/gu, " ")}</p>
                          <h3>{formatTimestamp(event.createdAt)}</h3>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">No audit events recorded for this plan yet.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
