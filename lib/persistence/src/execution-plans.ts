import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type {
  ApprovalStatus,
  ExecutionActionPlan,
  ExecutionPlanDetailResponse,
  ExecutionPlanEventsResponse,
  ExecutionPlanLifecycleStatus,
  ExecutionPlanResponse,
  ExecutionPlanSummary,
  ExecutionResult,
  PersistedExecutionAction
} from "@repo-guardian/shared-types";
import {
  ExecutionActionPlanSchema,
  ExecutionPlanDetailResponseSchema,
  ExecutionPlanEventsResponseSchema,
  ExecutionPlanLifecycleStatusValues,
  ExecutionPlanSummarySchema,
  ExecutionPlanStatusEventSchema,
  ExecutionPlanStatusEventTypeValues,
  ExecutionResultSummarySchema,
  PersistedExecutionActionSchema
} from "@repo-guardian/shared-types";
import type { PostgresClient, PostgresSession } from "./client.js";
import { PersistenceError } from "./errors.js";
import {
  canTransitionExecutionPlanStatus,
  resolveExpiredPlannedStatus
} from "./lifecycle.js";

type ExecutionPlanRow = QueryResultRow & {
  actor_user_id: string | null;
  analysis_run_id: string;
  approval_confirmation_text: string;
  approval_notes: unknown;
  approval_required: boolean;
  approval_status: ApprovalStatus;
  approval_verified_at: Date | string | null;
  cancelled_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  execution_id: string | null;
  execution_status: string | null;
  expires_at: Date | string;
  failed_at: Date | string | null;
  plan_hash: string;
  plan_id: string;
  repository_default_branch: string;
  repository_full_name: string;
  repository_owner: string;
  repository_repo: string;
  selected_issue_candidate_ids: unknown;
  selected_pr_candidate_ids: unknown;
  started_at: Date | string | null;
  status: string;
  summary_payload: unknown;
};

type ExecutionPlanActionRow = QueryResultRow & {
  action_id: string;
  action_index: number;
  action_payload: unknown;
  completed_at: Date | string | null;
  started_at: Date | string | null;
};

type ExecutionAuditEventRow = QueryResultRow & {
  action_id: string | null;
  actor_user_id: string | null;
  created_at: Date | string;
  details: unknown;
  event_id: string;
  event_type: string;
  execution_id: string | null;
  plan_id: string;
  repository_full_name: string;
};

export type StoredExecutionPlan = {
  actions: ExecutionActionPlan[];
  actorUserId: string | null;
  analysisRunId: string;
  approval: ExecutionPlanResponse["approval"];
  createdAt: string;
  expiresAt: string;
  planHash: string;
  planId: string;
  repository: {
    defaultBranch: string;
    fullName: string;
    owner: string;
    repo: string;
  };
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
  summary: ExecutionPlanResponse["summary"];
};

export type ClaimedExecutionPlan = {
  actions: ExecutionActionPlan[];
  analysisRunId: string;
  executionId: string;
  planHash: string;
  planId: string;
  repositoryFullName: string;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
};

const lifecycleValues = new Set<string>(ExecutionPlanLifecycleStatusValues);
const eventTypeValues = new Set<string>(ExecutionPlanStatusEventTypeValues);

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function assertValidPlanId(planId: string): void {
  if (!/^[a-z0-9._:-]+$/iu.test(planId)) {
    throw new PersistenceError("invalid_plan_id", "Execution plan id is invalid.");
  }
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function parsePlanStatus(status: string): ExecutionPlanLifecycleStatus {
  return lifecycleValues.has(status)
    ? (status as ExecutionPlanLifecycleStatus)
    : "failed";
}

function parseActionRow(row: ExecutionPlanActionRow): PersistedExecutionAction {
  const action = ExecutionActionPlanSchema.parse(row.action_payload);
  return PersistedExecutionActionSchema.parse({
    ...action,
    completedAt: toIsoString(row.completed_at),
    startedAt: toIsoString(row.started_at)
  });
}

function parseEventType(eventType: string) {
  return eventTypeValues.has(eventType) ? eventType : "execution_failed";
}

export class ExecutionPlanRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async savePlan(input: StoredExecutionPlan): Promise<void> {
    await this.client.transaction(async (session) => {
      await session.query(
        `INSERT INTO execution_plans (
          plan_id,
          plan_hash,
          analysis_run_id,
          repository_full_name,
          repository_owner,
          repository_repo,
          repository_default_branch,
          actor_user_id,
          selected_issue_candidate_ids,
          selected_pr_candidate_ids,
          approval_required,
          approval_confirmation_text,
          approval_status,
          approval_notes,
          approval_verified_at,
          status,
          summary_payload,
          created_at,
          expires_at,
          started_at,
          completed_at,
          failed_at,
          cancelled_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14::jsonb, NULL, $15, $16::jsonb, $17, $18, NULL, NULL, NULL, NULL
        )`,
        [
          input.planId,
          input.planHash,
          input.analysisRunId,
          input.repository.fullName,
          input.repository.owner,
          input.repository.repo,
          input.repository.defaultBranch,
          input.actorUserId,
          JSON.stringify(input.selectedIssueCandidateIds),
          JSON.stringify(input.selectedPRCandidateIds),
          input.approval.required,
          input.approval.confirmationText,
          "required",
          JSON.stringify(["Awaiting explicit execution approval."]),
          "planned",
          JSON.stringify(input.summary),
          input.createdAt,
          input.expiresAt
        ]
      );

      for (const [index, action] of input.actions.entries()) {
        await session.query(
          `INSERT INTO execution_plan_actions (
            plan_id,
            action_id,
            action_index,
            action_payload,
            started_at,
            completed_at
          ) VALUES ($1, $2, $3, $4::jsonb, NULL, NULL)`,
          [input.planId, action.id, index, JSON.stringify(action)]
        );
      }

      await this.insertAuditEvent(session, {
        actorUserId: input.actorUserId,
        details: {
          selectedIssueCandidateIds: input.selectedIssueCandidateIds,
          selectedPRCandidateIds: input.selectedPRCandidateIds,
          status: "planned"
        },
        eventType: "plan_created",
        executionId: null,
        planId: input.planId,
        repositoryFullName: input.repository.fullName
      });
    });
  }

  async getPlanDetail(planId: string): Promise<ExecutionPlanDetailResponse> {
    assertValidPlanId(planId);
    await this.expirePlanIfNeeded(planId);
    const row = await this.getPlanRow(planId);
    const actions = await this.getPlanActions(planId);

    return ExecutionPlanDetailResponseSchema.parse({
      actions,
      actorUserId: row.actor_user_id,
      analysisRunId: row.analysis_run_id,
      approval: {
        confirmationText: row.approval_confirmation_text,
        notes: Array.isArray(row.approval_notes) ? row.approval_notes : [],
        required: row.approval_required,
        status: row.approval_status,
        verifiedAt: toIsoString(row.approval_verified_at)
      },
      cancelledAt: toIsoString(row.cancelled_at),
      completedAt: toIsoString(row.completed_at),
      createdAt: toIsoString(row.created_at),
      executionId: row.execution_id,
      executionResultStatus:
        row.execution_status === "completed" || row.execution_status === "failed"
          ? row.execution_status
          : null,
      executionSummary:
        row.summary_payload === null
          ? null
          : ExecutionResultSummarySchema.parse(row.summary_payload),
      expiresAt: toIsoString(row.expires_at),
      failedAt: toIsoString(row.failed_at),
      planHash: row.plan_hash,
      planId: row.plan_id,
      repository: {
        defaultBranch: row.repository_default_branch,
        fullName: row.repository_full_name,
        owner: row.repository_owner,
        repo: row.repository_repo
      },
      selectedIssueCandidateIds: parseStringArray(row.selected_issue_candidate_ids),
      selectedPRCandidateIds: parseStringArray(row.selected_pr_candidate_ids),
      startedAt: toIsoString(row.started_at),
      status: parsePlanStatus(row.status)
    });
  }

  async getPlanEvents(planId: string): Promise<ExecutionPlanEventsResponse> {
    await this.getPlanDetail(planId);
    const result = await this.client.query<ExecutionAuditEventRow>(
      `SELECT
        event_id,
        plan_id,
        execution_id,
        action_id,
        event_type,
        repository_full_name,
        actor_user_id,
        details,
        created_at
      FROM execution_audit_events
      WHERE plan_id = $1
      ORDER BY created_at ASC, event_id ASC`,
      [planId]
    );

    return ExecutionPlanEventsResponseSchema.parse({
      events: result.rows.map((row: ExecutionAuditEventRow) =>
        ExecutionPlanStatusEventSchema.parse({
          actionId: row.action_id,
          actorUserId: row.actor_user_id,
          createdAt: toIsoString(row.created_at),
          details:
            row.details && typeof row.details === "object" ? row.details : {},
          eventId: row.event_id,
          eventType: parseEventType(row.event_type),
          executionId: row.execution_id,
          planId: row.plan_id,
          repositoryFullName: row.repository_full_name
        })
      ),
      planId
    });
  }

  async listPlanSummariesByRepositoryFullName(input: {
    limit?: number;
    repositoryFullName: string;
  }): Promise<ExecutionPlanSummary[]> {
    const result = await this.client.query<ExecutionPlanRow>(
      `SELECT
        execution_plans.plan_id,
        execution_plans.plan_hash,
        execution_plans.analysis_run_id,
        execution_plans.repository_full_name,
        execution_plans.repository_owner,
        execution_plans.repository_repo,
        execution_plans.repository_default_branch,
        execution_plans.actor_user_id,
        execution_plans.selected_issue_candidate_ids,
        execution_plans.selected_pr_candidate_ids,
        execution_plans.approval_required,
        execution_plans.approval_confirmation_text,
        execution_plans.approval_status,
        execution_plans.approval_notes,
        execution_plans.approval_verified_at,
        execution_plans.status,
        execution_plans.summary_payload,
        execution_plans.created_at,
        execution_plans.expires_at,
        execution_plans.started_at,
        execution_plans.completed_at,
        execution_plans.failed_at,
        execution_plans.cancelled_at,
        execution_attempts.execution_id,
        execution_attempts.status AS execution_status
      FROM execution_plans
      LEFT JOIN execution_attempts
        ON execution_attempts.plan_id = execution_plans.plan_id
      WHERE execution_plans.repository_full_name = $1
      ORDER BY execution_plans.created_at DESC, execution_plans.plan_id DESC
      LIMIT $2`,
      [input.repositoryFullName, input.limit ?? 10]
    );

    return result.rows.map((row) =>
      ExecutionPlanSummarySchema.parse({
        analysisRunId: row.analysis_run_id,
        approvalStatus: row.approval_status,
        cancelledAt: toIsoString(row.cancelled_at),
        completedAt: toIsoString(row.completed_at),
        createdAt: toIsoString(row.created_at),
        executionId: row.execution_id,
        executionResultStatus:
          row.execution_status === "completed" || row.execution_status === "failed"
            ? row.execution_status
            : null,
        expiresAt: toIsoString(row.expires_at),
        failedAt: toIsoString(row.failed_at),
        planId: row.plan_id,
        repositoryFullName: row.repository_full_name,
        selectedIssueCandidateCount: parseStringArray(row.selected_issue_candidate_ids).length,
        selectedPRCandidateCount: parseStringArray(row.selected_pr_candidate_ids).length,
        startedAt: toIsoString(row.started_at),
        status: parsePlanStatus(row.status),
        summary: ExecutionResultSummarySchema.parse(row.summary_payload)
      })
    );
  }

  async claimExecution(input: {
    actorUserId: string | null;
    planId: string;
  }): Promise<ClaimedExecutionPlan> {
    assertValidPlanId(input.planId);

    return this.client.transaction(async (session) => {
      const row = await this.getPlanRow(input.planId, session, true);
      const currentStatus = parsePlanStatus(row.status);
      const nextStatus = resolveExpiredPlannedStatus({
        expiresAt: toIsoString(row.expires_at)!,
        status: currentStatus
      });

      if (nextStatus === "expired") {
        if (currentStatus !== "expired") {
          await this.transitionPlanStatus(session, input.planId, currentStatus, "expired");
          await this.insertAuditEvent(session, {
            actorUserId: input.actorUserId,
            details: {
              previousStatus: currentStatus,
              status: "expired"
            },
            eventType: "plan_expired",
            executionId: null,
            planId: input.planId,
            repositoryFullName: row.repository_full_name
          });
        }
        throw new PersistenceError("conflict", "Plan is already executing or no longer active.");
      }

      if (currentStatus !== "planned") {
        throw new PersistenceError("conflict", "Plan is already executing or no longer active.");
      }

      await this.transitionPlanStatus(session, input.planId, "planned", "executing");
      const executionId = `exec_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const startedAt = new Date().toISOString();

      try {
        await session.query(
          `INSERT INTO execution_attempts (
            execution_id,
            plan_id,
            actor_user_id,
            status,
            started_at,
            completed_at,
            error_message
          ) VALUES ($1, $2, $3, $4, $5, NULL, NULL)`,
          [executionId, input.planId, input.actorUserId, "executing", startedAt]
        );
      } catch {
        throw new PersistenceError("conflict", "Plan is already executing or no longer active.");
      }

      await session.query(
        `UPDATE execution_plans
        SET
          approval_status = 'granted',
          approval_notes = $2::jsonb,
          approval_verified_at = $3,
          started_at = $3
        WHERE plan_id = $1`,
        [
          input.planId,
          JSON.stringify(["Explicit approval verified via token."]),
          startedAt
        ]
      );

      await this.insertAuditEvent(session, {
        actorUserId: input.actorUserId,
        details: {
          executionId,
          status: "executing"
        },
        eventType: "execution_started",
        executionId,
        planId: input.planId,
        repositoryFullName: row.repository_full_name
      });

      const actions = await this.getPlanActions(input.planId, session);

      return {
        actions: actions.map((action) => ExecutionActionPlanSchema.parse(action)),
        analysisRunId: row.analysis_run_id,
        executionId,
        planHash: row.plan_hash,
        planId: row.plan_id,
        repositoryFullName: row.repository_full_name,
        selectedIssueCandidateIds: parseStringArray(row.selected_issue_candidate_ids),
        selectedPRCandidateIds: parseStringArray(row.selected_pr_candidate_ids)
      };
    });
  }

  async recordActionStarted(input: {
    action: ExecutionActionPlan;
    actorUserId: string | null;
    executionId: string;
    planId: string;
    repositoryFullName: string;
  }): Promise<void> {
    await this.client.transaction(async (session) => {
      const startedAt = new Date().toISOString();
      await session.query(
        `UPDATE execution_plan_actions
        SET
          action_payload = $3::jsonb,
          started_at = COALESCE(started_at, $4)
        WHERE plan_id = $1 AND action_id = $2`,
        [
          input.planId,
          input.action.id,
          JSON.stringify(input.action),
          startedAt
        ]
      );
      await this.insertAuditEvent(session, {
        actionId: input.action.id,
        actorUserId: input.actorUserId,
        details: {
          actionType: input.action.actionType,
          eligibility: input.action.eligibility
        },
        eventType: "action_started",
        executionId: input.executionId,
        planId: input.planId,
        repositoryFullName: input.repositoryFullName
      });
    });
  }

  async recordActionCompleted(input: {
    action: ExecutionActionPlan;
    actorUserId: string | null;
    executionId: string;
    planId: string;
    repositoryFullName: string;
  }): Promise<void> {
    await this.client.transaction(async (session) => {
      const completedAt = new Date().toISOString();
      await session.query(
        `UPDATE execution_plan_actions
        SET
          action_payload = $3::jsonb,
          completed_at = $4
        WHERE plan_id = $1 AND action_id = $2`,
        [
          input.planId,
          input.action.id,
          JSON.stringify(input.action),
          completedAt
        ]
      );
      await this.insertAuditEvent(session, {
        actionId: input.action.id,
        actorUserId: input.actorUserId,
        details: {
          actionType: input.action.actionType,
          errorMessage: input.action.errorMessage,
          succeeded: input.action.succeeded
        },
        eventType: input.action.succeeded ? "action_succeeded" : "action_failed",
        executionId: input.executionId,
        planId: input.planId,
        repositoryFullName: input.repositoryFullName
      });
    });
  }

  async finalizeExecution(input: {
    actorUserId: string | null;
    executionId: string;
    planId: string;
    repositoryFullName: string;
    result: ExecutionResult;
  }): Promise<void> {
    await this.client.transaction(async (session) => {
      const nextStatus: ExecutionPlanLifecycleStatus =
        input.result.status === "completed" ? "completed" : "failed";
      const finishedAt = new Date().toISOString();
      await this.transitionPlanStatus(session, input.planId, "executing", nextStatus);
      await session.query(
        `UPDATE execution_plans
        SET
          summary_payload = $2::jsonb,
          completed_at = CASE WHEN $3 = 'completed' THEN $4 ELSE completed_at END,
          failed_at = CASE WHEN $3 = 'failed' THEN $4 ELSE failed_at END
        WHERE plan_id = $1`,
        [input.planId, JSON.stringify(input.result.summary), nextStatus, finishedAt]
      );
      await session.query(
        `UPDATE execution_attempts
        SET
          status = $2,
          completed_at = $3,
          error_message = $4
        WHERE execution_id = $1`,
        [
          input.executionId,
          nextStatus,
          finishedAt,
          input.result.errors[0] ?? null
        ]
      );
      await this.insertAuditEvent(session, {
        actorUserId: input.actorUserId,
        details: {
          errors: input.result.errors,
          status: nextStatus,
          warnings: input.result.warnings
        },
        eventType:
          nextStatus === "completed" ? "execution_completed" : "execution_failed",
        executionId: input.executionId,
        planId: input.planId,
        repositoryFullName: input.repositoryFullName
      });
    });
  }

  async markExecutionFailure(input: {
    actorUserId: string | null;
    errorMessage: string;
    executionId: string;
    planId: string;
    repositoryFullName: string;
  }): Promise<void> {
    await this.client.transaction(async (session) => {
      const failedAt = new Date().toISOString();
      await this.transitionPlanStatus(session, input.planId, "executing", "failed");
      await session.query(
        `UPDATE execution_plans
        SET failed_at = $2
        WHERE plan_id = $1`,
        [input.planId, failedAt]
      );
      await session.query(
        `UPDATE execution_attempts
        SET
          status = 'failed',
          completed_at = $2,
          error_message = $3
        WHERE execution_id = $1`,
        [input.executionId, failedAt, input.errorMessage]
      );
      await this.insertAuditEvent(session, {
        actorUserId: input.actorUserId,
        details: {
          errorMessage: input.errorMessage,
          status: "failed"
        },
        eventType: "execution_failed",
        executionId: input.executionId,
        planId: input.planId,
        repositoryFullName: input.repositoryFullName
      });
    });
  }

  async upsertLegacyPlan(input: StoredExecutionPlan): Promise<boolean> {
    const existing = await this.client.query<{ plan_id: string }>(
      "SELECT plan_id FROM execution_plans WHERE plan_id = $1",
      [input.planId]
    );

    if (existing.rows.length > 0) {
      return false;
    }

    await this.savePlan(input);
    return true;
  }

  private async expirePlanIfNeeded(planId: string): Promise<void> {
    await this.client.transaction(async (session) => {
      const row = await this.getPlanRow(planId, session, true);
      const status = parsePlanStatus(row.status);
      const nextStatus = resolveExpiredPlannedStatus({
        expiresAt: toIsoString(row.expires_at)!,
        status
      });

      if (nextStatus === status) {
        return;
      }

      await this.transitionPlanStatus(session, planId, status, nextStatus);
      await this.insertAuditEvent(session, {
        actorUserId: row.actor_user_id,
        details: {
          previousStatus: status,
          status: nextStatus
        },
        eventType: "plan_expired",
        executionId: row.execution_id,
        planId,
        repositoryFullName: row.repository_full_name
      });
    });
  }

  private async getPlanRow(
    planId: string,
    session?: PostgresSession,
    lock = false
  ): Promise<ExecutionPlanRow> {
    const executor = session ?? this.client;
    const result = await executor.query<ExecutionPlanRow>(
      `SELECT
        execution_plans.plan_id,
        execution_plans.plan_hash,
        execution_plans.analysis_run_id,
        execution_plans.repository_full_name,
        execution_plans.repository_owner,
        execution_plans.repository_repo,
        execution_plans.repository_default_branch,
        execution_plans.actor_user_id,
        execution_plans.selected_issue_candidate_ids,
        execution_plans.selected_pr_candidate_ids,
        execution_plans.approval_required,
        execution_plans.approval_confirmation_text,
        execution_plans.approval_status,
        execution_plans.approval_notes,
        execution_plans.approval_verified_at,
        execution_plans.status,
        execution_plans.summary_payload,
        execution_plans.created_at,
        execution_plans.expires_at,
        execution_plans.started_at,
        execution_plans.completed_at,
        execution_plans.failed_at,
        execution_plans.cancelled_at,
        execution_attempts.execution_id,
        execution_attempts.status AS execution_status
      FROM execution_plans
      LEFT JOIN execution_attempts
        ON execution_attempts.plan_id = execution_plans.plan_id
      WHERE execution_plans.plan_id = $1
      ${lock ? "FOR UPDATE" : ""}`,
      [planId]
    );

    if (result.rows.length === 0) {
      throw new PersistenceError("not_found", "Plan not found.");
    }

    return result.rows[0]!;
  }

  private async getPlanActions(
    planId: string,
    session?: PostgresSession
  ): Promise<PersistedExecutionAction[]> {
    const executor = session ?? this.client;
    const result = await executor.query<ExecutionPlanActionRow>(
      `SELECT
        action_id,
        action_index,
        action_payload,
        started_at,
        completed_at
      FROM execution_plan_actions
      WHERE plan_id = $1
      ORDER BY action_index ASC`,
      [planId]
    );

    return result.rows.map(parseActionRow);
  }

  private async transitionPlanStatus(
    session: PostgresSession,
    planId: string,
    from: ExecutionPlanLifecycleStatus,
    to: ExecutionPlanLifecycleStatus
  ): Promise<void> {
    if (!canTransitionExecutionPlanStatus(from, to)) {
      throw new PersistenceError(
        "conflict",
        `Plan cannot transition from ${from} to ${to}.`
      );
    }

    const result = await session.query(
      `UPDATE execution_plans
      SET status = $3
      WHERE plan_id = $1 AND status = $2`,
      [planId, from, to]
    );

    if (result.rowCount !== 1) {
      throw new PersistenceError("conflict", "Plan is already executing or no longer active.");
    }
  }

  private async insertAuditEvent(
    session: PostgresSession,
    input: {
      actionId?: string | null;
      actorUserId: string | null;
      details: Record<string, unknown>;
      eventType: string;
      executionId: string | null;
      planId: string;
      repositoryFullName: string;
    }
  ): Promise<void> {
    await session.query(
      `INSERT INTO execution_audit_events (
        event_id,
        plan_id,
        execution_id,
        action_id,
        event_type,
        repository_full_name,
        actor_user_id,
        details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
      [
        `evt_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        input.planId,
        input.executionId,
        input.actionId ?? null,
        input.eventType,
        input.repositoryFullName,
        input.actorUserId,
        JSON.stringify(input.details),
        new Date().toISOString()
      ]
    );
  }
}
