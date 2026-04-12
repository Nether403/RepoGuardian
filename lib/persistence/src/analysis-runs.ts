import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type {
  AnalyzeRepoResponse,
  CompareAnalysisRunsResponse,
  ExecutionPlanLifecycleStatus,
  GetAnalysisRunResponse,
  ListAnalysisRunsResponse,
  SaveAnalysisRunResponse,
  SavedAnalysisRun,
  SavedAnalysisRunSummary
} from "@repo-guardian/shared-types";
import {
  CompareAnalysisRunsResponseSchema,
  SavedAnalysisRunSchema,
  SaveAnalysisRunResponseSchema
} from "@repo-guardian/shared-types";
import {
  compareAnalysisRuns,
  createAnalysisRunSummary,
  createRunId
} from "@repo-guardian/runs";
import type { PostgresClient } from "./client.js";
import { PersistenceError } from "./errors.js";

type AnalysisRunRow = QueryResultRow & {
  analysis_payload: unknown;
  blocked_patch_plans: number;
  created_at: Date | string;
  default_branch: string;
  executable_patch_plans: number;
  fetched_at: Date | string;
  high_severity_findings: number;
  issue_candidates: number;
  label: string | null;
  latest_execution_completed_at: Date | string | null;
  latest_plan_id: string | null;
  latest_plan_status: string | null;
  pr_candidates: number;
  repository_full_name: string;
  run_id: string;
  total_findings: number;
};

function assertValidRunId(runId: string): void {
  if (!/^[a-z0-9._-]+$/iu.test(runId)) {
    throw new PersistenceError("invalid_run_id", "Saved analysis run id is invalid.");
  }
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseSavedRun(row: AnalysisRunRow): SavedAnalysisRun {
  return SavedAnalysisRunSchema.parse({
    analysis: row.analysis_payload,
    createdAt: toIsoString(row.created_at),
    id: row.run_id,
    label: row.label
  });
}

function enrichSummary(
  summary: SavedAnalysisRunSummary,
  row: AnalysisRunRow
): SavedAnalysisRunSummary {
  if (!row.latest_plan_id || !row.latest_plan_status) {
    return summary;
  }

  return {
    ...summary,
    execution: {
      latestExecutionCompletedAt: toIsoString(row.latest_execution_completed_at),
      latestPlanId: row.latest_plan_id,
      latestPlanStatus:
        row.latest_plan_status as ExecutionPlanLifecycleStatus
    }
  };
}

export class AnalysisRunRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async saveRun(input: {
    analysis: AnalyzeRepoResponse;
    label?: string | null;
  }): Promise<SaveAnalysisRunResponse> {
    const createdAt = new Date().toISOString();
    const run: SavedAnalysisRun = {
      analysis: input.analysis,
      createdAt,
      id: createRunId(input.analysis, createdAt, randomUUID),
      label: input.label?.trim() ? input.label.trim() : null
    };

    await this.upsertRun(run);

    return SaveAnalysisRunResponseSchema.parse({
      run,
      summary: createAnalysisRunSummary(run)
    });
  }

  async upsertRun(run: SavedAnalysisRun): Promise<void> {
    const summary = createAnalysisRunSummary(run);

    await this.client.query(
      `INSERT INTO analysis_runs (
        run_id,
        created_at,
        label,
        repository_full_name,
        default_branch,
        fetched_at,
        total_findings,
        high_severity_findings,
        issue_candidates,
        pr_candidates,
        executable_patch_plans,
        blocked_patch_plans,
        analysis_payload
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
      )
      ON CONFLICT (run_id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        label = EXCLUDED.label,
        repository_full_name = EXCLUDED.repository_full_name,
        default_branch = EXCLUDED.default_branch,
        fetched_at = EXCLUDED.fetched_at,
        total_findings = EXCLUDED.total_findings,
        high_severity_findings = EXCLUDED.high_severity_findings,
        issue_candidates = EXCLUDED.issue_candidates,
        pr_candidates = EXCLUDED.pr_candidates,
        executable_patch_plans = EXCLUDED.executable_patch_plans,
        blocked_patch_plans = EXCLUDED.blocked_patch_plans,
        analysis_payload = EXCLUDED.analysis_payload`,
      [
        run.id,
        run.createdAt,
        run.label,
        summary.repositoryFullName,
        summary.defaultBranch,
        summary.fetchedAt,
        summary.totalFindings,
        summary.highSeverityFindings,
        summary.issueCandidates,
        summary.prCandidates,
        summary.executablePatchPlans,
        summary.blockedPatchPlans,
        JSON.stringify(run.analysis)
      ]
    );
  }

  async listRuns(): Promise<ListAnalysisRunsResponse["runs"]> {
    const result = await this.client.query<AnalysisRunRow>(
      `SELECT
        runs.run_id,
        runs.created_at,
        runs.label,
        runs.repository_full_name,
        runs.default_branch,
        runs.fetched_at,
        runs.total_findings,
        runs.high_severity_findings,
        runs.issue_candidates,
        runs.pr_candidates,
        runs.executable_patch_plans,
        runs.blocked_patch_plans,
        runs.analysis_payload,
        plans.plan_id AS latest_plan_id,
        plans.status AS latest_plan_status,
        plans.completed_at AS latest_execution_completed_at
      FROM analysis_runs AS runs
      LEFT JOIN LATERAL (
        SELECT
          execution_plans.plan_id,
          execution_plans.status,
          execution_plans.completed_at
        FROM execution_plans
        WHERE execution_plans.analysis_run_id = runs.run_id
        ORDER BY execution_plans.created_at DESC
        LIMIT 1
      ) AS plans ON TRUE
      ORDER BY runs.created_at DESC`
    );

    return result.rows.map((row: AnalysisRunRow) =>
      enrichSummary(createAnalysisRunSummary(parseSavedRun(row)), row)
    );
  }

  async getRun(runId: string): Promise<GetAnalysisRunResponse> {
    assertValidRunId(runId);
    const row = await this.getRunRow(runId);
    const run = parseSavedRun(row);

    return SaveAnalysisRunResponseSchema.parse({
      run,
      summary: enrichSummary(createAnalysisRunSummary(run), row)
    });
  }

  async compareRuns(input: {
    baseRunId: string;
    targetRunId: string;
  }): Promise<CompareAnalysisRunsResponse> {
    const [base, target] = await Promise.all([
      this.getRun(input.baseRunId),
      this.getRun(input.targetRunId)
    ]);

    return CompareAnalysisRunsResponseSchema.parse(
      compareAnalysisRuns(base.run, target.run)
    );
  }

  private async getRunRow(runId: string): Promise<AnalysisRunRow> {
    const result = await this.client.query<AnalysisRunRow>(
      `SELECT
        runs.run_id,
        runs.created_at,
        runs.label,
        runs.repository_full_name,
        runs.default_branch,
        runs.fetched_at,
        runs.total_findings,
        runs.high_severity_findings,
        runs.issue_candidates,
        runs.pr_candidates,
        runs.executable_patch_plans,
        runs.blocked_patch_plans,
        runs.analysis_payload,
        plans.plan_id AS latest_plan_id,
        plans.status AS latest_plan_status,
        plans.completed_at AS latest_execution_completed_at
      FROM analysis_runs AS runs
      LEFT JOIN LATERAL (
        SELECT
          execution_plans.plan_id,
          execution_plans.status,
          execution_plans.completed_at
        FROM execution_plans
        WHERE execution_plans.analysis_run_id = runs.run_id
        ORDER BY execution_plans.created_at DESC
        LIMIT 1
      ) AS plans ON TRUE
      WHERE runs.run_id = $1`,
      [runId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Saved analysis run was not found.");
    }

    return result.rows[0]!;
  }
}
