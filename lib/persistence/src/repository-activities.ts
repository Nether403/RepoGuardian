import type { QueryResultRow } from "pg";
import {
  RepositoryActivityEventSchema,
  RepositoryActivityKindSchema,
  type RepositoryActivityEvent,
  type RepositoryActivityKind
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";

type RepositoryActivityRow = QueryResultRow & {
  action_id: string | null;
  activity_id: string;
  execution_event_id: string | null;
  execution_id: string | null;
  job_id: string | null;
  kind: RepositoryActivityKind;
  occurred_at: Date | string;
  plan_id: string | null;
  pull_request_url: string | null;
  repository_full_name: string;
  run_id: string | null;
  status: string;
  summary: string | null;
  title: string;
  tracked_pull_request_id: string | null;
};

const repositoryActivityKinds = [...RepositoryActivityKindSchema.options];

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatExecutionEventTitle(eventType: string): string {
  return eventType
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function parseRepositoryActivity(row: RepositoryActivityRow): RepositoryActivityEvent {
  return RepositoryActivityEventSchema.parse({
    actionId: row.action_id,
    activityId: row.activity_id,
    executionEventId: row.execution_event_id,
    executionId: row.execution_id,
    jobId: row.job_id,
    kind: row.kind,
    occurredAt: toIsoString(row.occurred_at),
    planId: row.plan_id,
    pullRequestUrl: row.pull_request_url,
    repositoryFullName: row.repository_full_name,
    runId: row.run_id,
    status: row.status,
    summary: row.summary,
    title:
      row.kind === "execution_event" ? formatExecutionEventTitle(row.title) : row.title,
    trackedPullRequestId: row.tracked_pull_request_id
  });
}

export class RepositoryActivityRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async listActivitiesByRepositoryFullName(input: {
    kinds?: RepositoryActivityKind[];
    limit?: number;
    offset?: number;
    occurredAfter?: string | null;
    occurredBefore?: string | null;
    repositoryFullName: string;
    statuses?: string[];
  }): Promise<{
    appliedKinds: RepositoryActivityKind[];
    appliedStatuses: string[];
    availableKinds: RepositoryActivityKind[];
    events: RepositoryActivityEvent[];
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    occurredAfter: string | null;
    occurredBefore: string | null;
    page: number;
    pageSize: number;
    totalPages: number;
    totalEvents: number;
  }> {
    const pageSize = input.limit ?? 40;
    const offset = Math.max(0, input.offset ?? 0);
    const page = Math.floor(offset / pageSize) + 1;
    const appliedKinds = (input.kinds ?? []).filter((kind, index, kinds) =>
      repositoryActivityKinds.includes(kind) && kinds.indexOf(kind) === index
    );
    const appliedStatuses = (input.statuses ?? []).filter(
      (status, index, statuses) => status.trim().length > 0 && statuses.indexOf(status) === index
    );
    const kinds = appliedKinds.length > 0 ? appliedKinds : null;
    const statuses = appliedStatuses.length > 0 ? appliedStatuses : null;
    const occurredAfter = input.occurredAfter ?? null;
    const occurredBefore = input.occurredBefore ?? null;
    const queryText = `WITH repository_events AS (
        SELECT
          CONCAT('run:', runs.run_id) AS activity_id,
          'analysis_run' AS kind,
          runs.created_at AS occurred_at,
          'snapshot_saved' AS status,
          COALESCE(runs.label, runs.run_id) AS title,
          CONCAT(runs.total_findings, ' findings, ', runs.executable_patch_plans, ' executable patch plans') AS summary,
          runs.repository_full_name,
          runs.run_id,
          NULL::TEXT AS plan_id,
          NULL::TEXT AS job_id,
          NULL::TEXT AS tracked_pull_request_id,
          NULL::TEXT AS execution_event_id,
          NULL::TEXT AS execution_id,
          NULL::TEXT AS action_id,
          NULL::TEXT AS pull_request_url
        FROM analysis_runs AS runs
        WHERE runs.repository_full_name = $1

        UNION ALL

        SELECT
          CONCAT('job:', jobs.job_id) AS activity_id,
          'analysis_job' AS kind,
          COALESCE(jobs.completed_at, jobs.failed_at, jobs.started_at, jobs.queued_at) AS occurred_at,
          jobs.status,
          COALESCE(jobs.label, jobs.job_id) AS title,
          jobs.job_kind AS summary,
          jobs.repository_full_name,
          jobs.run_id,
          jobs.plan_id,
          jobs.job_id,
          NULL::TEXT AS tracked_pull_request_id,
          NULL::TEXT AS execution_event_id,
          NULL::TEXT AS execution_id,
          NULL::TEXT AS action_id,
          NULL::TEXT AS pull_request_url
        FROM analysis_jobs AS jobs
        WHERE jobs.repository_full_name = $1

        UNION ALL

        SELECT
          CONCAT('plan:', plans.plan_id) AS activity_id,
          'execution_plan' AS kind,
          COALESCE(plans.completed_at, plans.failed_at, plans.cancelled_at, plans.started_at, plans.created_at) AS occurred_at,
          plans.status,
          plans.plan_id AS title,
          CASE
            WHEN plans.summary_payload IS NOT NULL AND plans.summary_payload ? 'totalActions'
              THEN CONCAT(plans.summary_payload->>'totalActions', ' actions')
            ELSE NULL
          END AS summary,
          plans.repository_full_name,
          plans.analysis_run_id AS run_id,
          plans.plan_id,
          NULL::TEXT AS job_id,
          NULL::TEXT AS tracked_pull_request_id,
          NULL::TEXT AS execution_event_id,
          attempts.execution_id,
          NULL::TEXT AS action_id,
          NULL::TEXT AS pull_request_url
        FROM execution_plans AS plans
        LEFT JOIN execution_attempts AS attempts
          ON attempts.plan_id = plans.plan_id
        WHERE plans.repository_full_name = $1

        UNION ALL

        SELECT
          CONCAT('execution-event:', audit.event_id) AS activity_id,
          'execution_event' AS kind,
          audit.created_at AS occurred_at,
          audit.event_type AS status,
          audit.event_type AS title,
          CASE
            WHEN audit.action_id IS NOT NULL THEN CONCAT('Action ', audit.action_id)
            ELSE NULL
          END AS summary,
          audit.repository_full_name,
          NULL::TEXT AS run_id,
          audit.plan_id,
          NULL::TEXT AS job_id,
          NULL::TEXT AS tracked_pull_request_id,
          audit.event_id AS execution_event_id,
          audit.execution_id,
          audit.action_id,
          NULL::TEXT AS pull_request_url
        FROM execution_audit_events AS audit
        WHERE audit.repository_full_name = $1

        UNION ALL

        SELECT
          CONCAT('pull-request:', prs.tracked_pull_request_id) AS activity_id,
          'tracked_pull_request' AS kind,
          COALESCE(prs.merged_at, prs.closed_at, prs.updated_at, prs.created_at) AS occurred_at,
          prs.lifecycle_status AS status,
          CONCAT('#', prs.pull_request_number, ' ', prs.title) AS title,
          prs.branch_name AS summary,
          prs.repository_full_name,
          NULL::TEXT AS run_id,
          prs.plan_id,
          NULL::TEXT AS job_id,
          prs.tracked_pull_request_id,
          NULL::TEXT AS execution_event_id,
          prs.execution_id,
          NULL::TEXT AS action_id,
          prs.pull_request_url
        FROM tracked_pull_requests AS prs
        WHERE prs.repository_full_name = $1
      )
      SELECT
        activity_id,
        kind,
        occurred_at,
        status,
        title,
        summary,
        repository_full_name,
        run_id,
        plan_id,
        job_id,
        tracked_pull_request_id,
        execution_event_id,
        execution_id,
        action_id,
        pull_request_url
      FROM repository_events
      WHERE $2::TEXT[] IS NULL OR kind = ANY($2::TEXT[])
        AND ($3::TEXT[] IS NULL OR status = ANY($3::TEXT[]))
        AND ($4::TIMESTAMPTZ IS NULL OR occurred_at >= $4)
        AND ($5::TIMESTAMPTZ IS NULL OR occurred_at <= $5)
      ORDER BY occurred_at DESC, activity_id DESC
      LIMIT $6
      OFFSET $7`;
    const countQueryText = `WITH repository_events AS (
        SELECT
          'analysis_run' AS kind,
          runs.created_at AS occurred_at,
          'snapshot_saved' AS status
        FROM analysis_runs AS runs
        WHERE runs.repository_full_name = $1

        UNION ALL

        SELECT
          'analysis_job' AS kind,
          COALESCE(jobs.completed_at, jobs.failed_at, jobs.started_at, jobs.queued_at) AS occurred_at,
          jobs.status
        FROM analysis_jobs AS jobs
        WHERE jobs.repository_full_name = $1

        UNION ALL

        SELECT
          'execution_plan' AS kind,
          COALESCE(plans.completed_at, plans.failed_at, plans.cancelled_at, plans.started_at, plans.created_at) AS occurred_at,
          plans.status
        FROM execution_plans AS plans
        WHERE plans.repository_full_name = $1

        UNION ALL

        SELECT
          'execution_event' AS kind,
          audit.created_at AS occurred_at,
          audit.event_type AS status
        FROM execution_audit_events AS audit
        WHERE audit.repository_full_name = $1

        UNION ALL

        SELECT
          'tracked_pull_request' AS kind,
          COALESCE(prs.merged_at, prs.closed_at, prs.updated_at, prs.created_at) AS occurred_at,
          prs.lifecycle_status AS status
        FROM tracked_pull_requests AS prs
        WHERE prs.repository_full_name = $1
      )
      SELECT COUNT(*)::INT AS total_events
      FROM repository_events
      WHERE ($2::TEXT[] IS NULL OR kind = ANY($2::TEXT[]))
        AND ($3::TEXT[] IS NULL OR status = ANY($3::TEXT[]))
        AND ($4::TIMESTAMPTZ IS NULL OR occurred_at >= $4)
        AND ($5::TIMESTAMPTZ IS NULL OR occurred_at <= $5)`;
    const [result, countResult] = await Promise.all([
      this.client.query<RepositoryActivityRow>(queryText, [
        input.repositoryFullName,
        kinds,
        statuses,
        occurredAfter,
        occurredBefore,
        pageSize,
        offset
      ]),
      this.client.query<{ total_events: number }>(countQueryText, [
        input.repositoryFullName,
        kinds,
        statuses,
        occurredAfter,
        occurredBefore
      ])
    ]);
    const totalEvents = countResult.rows[0]?.total_events ?? 0;
    const totalPages = totalEvents === 0 ? 0 : Math.ceil(totalEvents / pageSize);

    return {
      appliedKinds,
      appliedStatuses,
      availableKinds: repositoryActivityKinds,
      events: result.rows.map(parseRepositoryActivity),
      hasNextPage: offset + result.rows.length < totalEvents,
      hasPreviousPage: offset > 0,
      occurredAfter,
      occurredBefore,
      page,
      pageSize,
      totalEvents,
      totalPages
    };
  }
}
