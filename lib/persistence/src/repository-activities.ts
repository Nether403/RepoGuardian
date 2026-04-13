import type { QueryResultRow } from "pg";
import {
  RepositoryActivityCursorDirectionSchema,
  RepositoryActivityEventSchema,
  RepositoryActivityKindSchema,
  RepositoryActivitySortPresetSchema,
  RepositoryTimelineExpansionModeSchema,
  type RepositoryActivityEvent,
  type RepositoryActivityKind,
  type RepositoryTimelineExpansionMode,
  type RepositoryTimelinePage
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";
import { PersistenceError } from "./errors.js";

type RepositoryActivityRow = QueryResultRow & {
  action_id: string | null;
  activity_id: string;
  actor_user_id: string | null;
  audit_details: unknown;
  blocked_patch_plan_count: number | null;
  branch_name: string | null;
  candidate_selection_count: number | null;
  execution_event_id: string | null;
  execution_id: string | null;
  executable_patch_plan_count: number | null;
  finding_count: number | null;
  job_id: string | null;
  job_kind: string | null;
  kind: RepositoryActivityKind;
  label: string | null;
  lifecycle_status: string | null;
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

const repositoryEventsCteSql = `WITH repository_events AS (
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
      NULL::TEXT AS actor_user_id,
      NULL::JSONB AS audit_details,
      NULL::TEXT AS pull_request_url,
      runs.total_findings AS finding_count,
      runs.executable_patch_plans AS executable_patch_plan_count,
      runs.blocked_patch_plans AS blocked_patch_plan_count,
      NULL::INT AS candidate_selection_count,
      NULL::TEXT AS branch_name,
      NULL::TEXT AS job_kind,
      runs.label,
      NULL::TEXT AS lifecycle_status
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
      NULL::TEXT AS actor_user_id,
      NULL::JSONB AS audit_details,
      NULL::TEXT AS pull_request_url,
      NULL::INT AS finding_count,
      NULL::INT AS executable_patch_plan_count,
      NULL::INT AS blocked_patch_plan_count,
      NULL::INT AS candidate_selection_count,
      NULL::TEXT AS branch_name,
      jobs.job_kind,
      jobs.label,
      NULL::TEXT AS lifecycle_status
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
      NULL::TEXT AS actor_user_id,
      NULL::JSONB AS audit_details,
      NULL::TEXT AS pull_request_url,
      NULL::INT AS finding_count,
      NULL::INT AS executable_patch_plan_count,
      NULL::INT AS blocked_patch_plan_count,
      (plans.selected_issue_candidate_count + plans.selected_pr_candidate_count) AS candidate_selection_count,
      NULL::TEXT AS branch_name,
      NULL::TEXT AS job_kind,
      NULL::TEXT AS label,
      NULL::TEXT AS lifecycle_status
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
      audit.actor_user_id,
      audit.details AS audit_details,
      NULL::TEXT AS pull_request_url,
      NULL::INT AS finding_count,
      NULL::INT AS executable_patch_plan_count,
      NULL::INT AS blocked_patch_plan_count,
      NULL::INT AS candidate_selection_count,
      NULL::TEXT AS branch_name,
      NULL::TEXT AS job_kind,
      NULL::TEXT AS label,
      NULL::TEXT AS lifecycle_status
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
      NULL::TEXT AS actor_user_id,
      NULL::JSONB AS audit_details,
      prs.pull_request_url,
      NULL::INT AS finding_count,
      NULL::INT AS executable_patch_plan_count,
      NULL::INT AS blocked_patch_plan_count,
      NULL::INT AS candidate_selection_count,
      prs.branch_name,
      NULL::TEXT AS job_kind,
      NULL::TEXT AS label,
      prs.lifecycle_status
    FROM tracked_pull_requests AS prs
    WHERE prs.repository_full_name = $1
  )`;

const repositoryActivitySelectColumnsSql = `activity_id,
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
      actor_user_id,
      audit_details,
      pull_request_url,
      finding_count,
      executable_patch_plan_count,
      blocked_patch_plan_count,
      candidate_selection_count,
      branch_name,
      job_kind,
      label,
      lifecycle_status`;

const repositoryActivityKinds = [...RepositoryActivityKindSchema.options];
const repositoryActivitySortPresets = [...RepositoryActivitySortPresetSchema.options];
const repositoryActivityCursorDirections = [
  ...RepositoryActivityCursorDirectionSchema.options
];
const repositoryTimelineExpansionModes = [
  ...RepositoryTimelineExpansionModeSchema.options
];

type RepositoryActivitySortPreset = (typeof repositoryActivitySortPresets)[number];
type RepositoryActivityCursorDirection =
  (typeof repositoryActivityCursorDirections)[number];
type RepositoryTimelineExpansionModeValue =
  (typeof repositoryTimelineExpansionModes)[number];

type ActivityCursor = {
  activityId: string;
  occurredAt: string;
};

function encodeActivityCursor(cursor: ActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeActivityCursor(cursor: string): ActivityCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as Partial<ActivityCursor>;

    if (
      typeof parsed.activityId !== "string" ||
      parsed.activityId.trim().length === 0 ||
      typeof parsed.occurredAt !== "string" ||
      Number.isNaN(new Date(parsed.occurredAt).valueOf())
    ) {
      return null;
    }

    return {
      activityId: parsed.activityId,
      occurredAt: new Date(parsed.occurredAt).toISOString()
    };
  } catch {
    return null;
  }
}

function createActivityCursor(row: RepositoryActivityRow): string {
  return encodeActivityCursor({
    activityId: row.activity_id,
    occurredAt: toIsoString(row.occurred_at)
  });
}

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
    detail: {
      actorUserId: row.actor_user_id,
      auditDetails:
        row.audit_details && typeof row.audit_details === "object"
          ? (row.audit_details as Record<string, unknown>)
          : null,
      auditEventType: row.kind === "execution_event" ? row.status : null,
      blockedPatchPlanCount: row.blocked_patch_plan_count,
      branchName: row.branch_name,
      candidateSelectionCount: row.candidate_selection_count,
      executablePatchPlanCount: row.executable_patch_plan_count,
      findingCount: row.finding_count,
      jobKind: row.job_kind,
      label: row.label,
      lifecycleStatus: row.lifecycle_status,
      relatedActionId: row.action_id,
      relatedExecutionId: row.execution_id,
      relatedJobId: row.job_id,
      relatedPlanId: row.plan_id,
      relatedRunId: row.run_id,
      relatedTrackedPullRequestId: row.tracked_pull_request_id
    },
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

function parseRepositoryActivityForExpansion(
  row: RepositoryActivityRow,
  expansionMode: RepositoryTimelineExpansionModeValue
): RepositoryActivityEvent {
  const activity = parseRepositoryActivity(row);

  if (expansionMode === "detail") {
    return activity;
  }

  return RepositoryActivityEventSchema.parse({
    ...activity,
    detail: null
  });
}

export class RepositoryActivityRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async listTimelineByRepositoryFullName(input: {
    cursor?: string | null;
    cursorDirection?: RepositoryActivityCursorDirection;
    expansionMode?: RepositoryTimelineExpansionMode;
    kinds?: RepositoryActivityKind[];
    limit?: number;
    occurredAfter?: string | null;
    occurredBefore?: string | null;
    repositoryFullName: string;
    sortPreset?: RepositoryActivitySortPreset;
    statuses?: string[];
  }): Promise<RepositoryTimelinePage> {
    const pageSize = input.limit ?? 40;
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
    const appliedSortPreset = repositoryActivitySortPresets.includes(
      input.sortPreset ?? "newest_first"
    )
      ? (input.sortPreset ?? "newest_first")
      : "newest_first";
    const appliedCursorDirection = repositoryActivityCursorDirections.includes(
      input.cursorDirection ?? "next"
    )
      ? (input.cursorDirection ?? "next")
      : "next";
    const expansionMode = repositoryTimelineExpansionModes.includes(
      input.expansionMode ?? "summary"
    )
      ? (input.expansionMode ?? "summary")
      : "summary";
    const decodedCursor = input.cursor ? decodeActivityCursor(input.cursor) : null;
    const naturalSortDirection = appliedSortPreset === "oldest_first" ? "ASC" : "DESC";
    const reverseSortDirection = naturalSortDirection === "ASC" ? "DESC" : "ASC";
    const useReverseCursorQuery = decodedCursor !== null && appliedCursorDirection === "previous";
    const effectiveSortDirection = useReverseCursorQuery
      ? reverseSortDirection
      : naturalSortDirection;
    const cursorComparator =
      naturalSortDirection === "ASC"
        ? appliedCursorDirection === "previous"
          ? "<"
          : ">"
        : appliedCursorDirection === "previous"
          ? ">"
          : "<";
    const queryText = `${repositoryEventsCteSql}
      SELECT
        ${repositoryActivitySelectColumnsSql}
      FROM repository_events
      WHERE (($2::TEXT[] IS NULL) OR kind = ANY($2::TEXT[]))
        AND ($3::TEXT[] IS NULL OR status = ANY($3::TEXT[]))
        AND ($4::TIMESTAMPTZ IS NULL OR occurred_at >= $4)
        AND ($5::TIMESTAMPTZ IS NULL OR occurred_at <= $5)
        AND (
          $6::TIMESTAMPTZ IS NULL OR $7::TEXT IS NULL OR
          (
            occurred_at ${cursorComparator} $6 OR
            (occurred_at = $6 AND activity_id ${cursorComparator} $7)
          )
        )
      ORDER BY occurred_at ${effectiveSortDirection}, activity_id ${effectiveSortDirection}
      LIMIT $8`;
    const result = await this.client.query<RepositoryActivityRow>(queryText, [
      input.repositoryFullName,
      kinds,
      statuses,
      occurredAfter,
      occurredBefore,
      decodedCursor?.occurredAt ?? null,
      decodedCursor?.activityId ?? null,
      pageSize + 1
    ]);
    const hasExtra = result.rows.length > pageSize;
    const limitedRows = hasExtra ? result.rows.slice(0, pageSize) : result.rows;
    const sortedRows = useReverseCursorQuery ? [...limitedRows].reverse() : limitedRows;
    const hasPreviousPage =
      decodedCursor !== null
        ? appliedCursorDirection === "previous"
          ? hasExtra
          : true
        : false;
    const hasNextPage =
      decodedCursor !== null
        ? appliedCursorDirection === "previous"
          ? sortedRows.length > 0
          : hasExtra
        : hasExtra;

    return {
      appliedCursor: decodedCursor ? input.cursor ?? null : null,
      appliedCursorDirection,
      appliedKinds,
      appliedSortPreset,
      appliedStatuses,
      availableKinds: repositoryActivityKinds,
      events: sortedRows.map((row) =>
        parseRepositoryActivityForExpansion(row, expansionMode)
      ),
      expansionMode,
      hasNextPage,
      hasPreviousPage,
      limit: pageSize,
      nextCursor:
        hasNextPage && sortedRows.length > 0
          ? createActivityCursor(sortedRows[sortedRows.length - 1]!)
          : null,
      occurredAfter,
      occurredBefore,
      previousCursor:
        hasPreviousPage && sortedRows.length > 0
          ? createActivityCursor(sortedRows[0]!)
          : null,
      returnedCount: sortedRows.length
    };
  }

  async getActivityByRepositoryFullName(input: {
    activityId: string;
    expansionMode?: RepositoryTimelineExpansionMode;
    repositoryFullName: string;
  }): Promise<RepositoryActivityEvent> {
    const expansionMode = repositoryTimelineExpansionModes.includes(
      input.expansionMode ?? "detail"
    )
      ? (input.expansionMode ?? "detail")
      : "detail";
    const queryText = `${repositoryEventsCteSql}
      SELECT
        ${repositoryActivitySelectColumnsSql}
      FROM repository_events
      WHERE activity_id = $2
      LIMIT 1`;
    const result = await this.client.query<RepositoryActivityRow>(queryText, [
      input.repositoryFullName,
      input.activityId
    ]);
    const row = result.rows[0];

    if (!row) {
      throw new PersistenceError("not_found", "Repository activity event was not found.");
    }

    return parseRepositoryActivityForExpansion(row, expansionMode);
  }

  async listActivitiesByRepositoryFullName(input: {
    cursor?: string | null;
    cursorDirection?: RepositoryActivityCursorDirection;
    includeDetails?: boolean;
    kinds?: RepositoryActivityKind[];
    limit?: number;
    offset?: number;
    occurredAfter?: string | null;
    occurredBefore?: string | null;
    repositoryFullName: string;
    sortPreset?: RepositoryActivitySortPreset;
    statuses?: string[];
  }): Promise<{
    appliedCursor: string | null;
    appliedCursorDirection: RepositoryActivityCursorDirection;
    appliedKinds: RepositoryActivityKind[];
    appliedSortPreset: RepositoryActivitySortPreset;
    appliedStatuses: string[];
    availableKinds: RepositoryActivityKind[];
    detailsIncluded: boolean;
    events: RepositoryActivityEvent[];
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    occurredAfter: string | null;
    occurredBefore: string | null;
    page: number;
    pageSize: number;
    previousCursor: string | null;
    totalPages: number;
    totalEvents: number;
  }> {
    const pageSize = input.limit ?? 40;
    const offset = Math.max(0, input.offset ?? 0);
    const page = Math.floor(offset / pageSize) + 1;
    const detailsIncluded = input.includeDetails ?? false;
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
    const appliedSortPreset = repositoryActivitySortPresets.includes(
      input.sortPreset ?? "newest_first"
    )
      ? (input.sortPreset ?? "newest_first")
      : "newest_first";
    const appliedCursorDirection = repositoryActivityCursorDirections.includes(
      input.cursorDirection ?? "next"
    )
      ? (input.cursorDirection ?? "next")
      : "next";
    const decodedCursor = input.cursor ? decodeActivityCursor(input.cursor) : null;
    const usesCursor = decodedCursor !== null;
    const naturalSortDirection = appliedSortPreset === "oldest_first" ? "ASC" : "DESC";
    const reverseSortDirection = naturalSortDirection === "ASC" ? "DESC" : "ASC";
    const useReverseCursorQuery = usesCursor && appliedCursorDirection === "previous";
    const effectiveSortDirection = useReverseCursorQuery
      ? reverseSortDirection
      : naturalSortDirection;
    const cursorComparator =
      naturalSortDirection === "ASC"
        ? appliedCursorDirection === "previous"
          ? "<"
          : ">"
        : appliedCursorDirection === "previous"
          ? ">"
          : "<";
    const queryText = `${repositoryEventsCteSql}
      SELECT
        ${repositoryActivitySelectColumnsSql}
      FROM repository_events
      WHERE (($2::TEXT[] IS NULL) OR kind = ANY($2::TEXT[]))
        AND ($3::TEXT[] IS NULL OR status = ANY($3::TEXT[]))
        AND ($4::TIMESTAMPTZ IS NULL OR occurred_at >= $4)
        AND ($5::TIMESTAMPTZ IS NULL OR occurred_at <= $5)
        AND (
          $6::TIMESTAMPTZ IS NULL OR $7::TEXT IS NULL OR
          (
            occurred_at ${cursorComparator} $6 OR
            (occurred_at = $6 AND activity_id ${cursorComparator} $7)
          )
        )
      ORDER BY occurred_at ${effectiveSortDirection}, activity_id ${effectiveSortDirection}
      LIMIT $8`;
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
        decodedCursor?.occurredAt ?? null,
        decodedCursor?.activityId ?? null,
        usesCursor ? pageSize + 1 : pageSize
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
    const hasExtra = result.rows.length > pageSize;
    const limitedRows = hasExtra ? result.rows.slice(0, pageSize) : result.rows;
    const sortedRows = useReverseCursorQuery ? [...limitedRows].reverse() : limitedRows;
    const hasPreviousPage = usesCursor
      ? appliedCursorDirection === "previous"
        ? hasExtra
        : true
      : offset > 0;
    const hasNextPage = usesCursor
      ? appliedCursorDirection === "previous"
        ? sortedRows.length > 0
        : hasExtra
      : offset + limitedRows.length < totalEvents;
    const nextCursor =
      hasNextPage && sortedRows.length > 0
        ? createActivityCursor(sortedRows[sortedRows.length - 1]!)
        : null;
    const previousCursor =
      hasPreviousPage && sortedRows.length > 0
        ? createActivityCursor(sortedRows[0]!)
        : null;

    return {
      appliedCursor: decodedCursor ? input.cursor ?? null : null,
      appliedCursorDirection,
      appliedKinds,
      appliedSortPreset,
      appliedStatuses,
      availableKinds: repositoryActivityKinds,
      detailsIncluded,
      events: sortedRows.map((row) =>
        detailsIncluded
          ? parseRepositoryActivity(row)
          : RepositoryActivityEventSchema.parse({
              ...parseRepositoryActivity(row),
              detail: null
            })
      ),
      hasNextPage,
      hasPreviousPage,
      nextCursor,
      occurredAfter,
      occurredBefore,
      page,
      pageSize,
      previousCursor,
      totalEvents,
      totalPages
    };
  }
}
