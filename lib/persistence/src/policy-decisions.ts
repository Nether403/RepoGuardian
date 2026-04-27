import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import {
  PolicyDecisionEventSchema,
  type PolicyActionType,
  type PolicyDecision,
  type PolicyDecisionEvent,
  type PolicyScopeType
} from "@repo-guardian/shared-types";
import type { PostgresClient } from "./client.js";
import { resolveWorkspaceId } from "./scope.js";

type PolicyDecisionEventRow = QueryResultRow & {
  action_type: string;
  actor_user_id: string | null;
  created_at: Date | string;
  decision: string;
  details: unknown;
  github_installation_id: string | null;
  job_id: string | null;
  plan_id: string | null;
  policy_decision_event_id: string;
  reason: string;
  repository_full_name: string | null;
  run_id: string | null;
  scope_type: string;
  sweep_schedule_id: string | null;
  workspace_id: string;
};

export type RecordPolicyDecisionInput = {
  actionType: PolicyActionType;
  actorUserId?: string | null;
  decision: PolicyDecision;
  details?: Record<string, unknown>;
  githubInstallationId?: string | null;
  jobId?: string | null;
  planId?: string | null;
  reason: string;
  repositoryFullName?: string | null;
  runId?: string | null;
  scopeType: PolicyScopeType;
  sweepScheduleId?: string | null;
  workspaceId?: string | null;
};

export type ListPolicyDecisionInput = {
  actionType?: PolicyActionType;
  decision?: PolicyDecision;
  limit?: number;
  occurredAfter?: string;
  occurredBefore?: string;
  page?: number;
  pageSize?: number;
  repositoryFullName?: string;
  workspaceId?: string | null;
};

export type ListPolicyDecisionPage = {
  decisions: PolicyDecisionEvent[];
  page: number;
  pageSize: number;
  totalDecisions: number;
  totalPages: number;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parsePolicyDecisionEvent(row: PolicyDecisionEventRow): PolicyDecisionEvent {
  return PolicyDecisionEventSchema.parse({
    actionType: row.action_type,
    actorUserId: row.actor_user_id,
    createdAt: toIsoString(row.created_at),
    decision: row.decision,
    details: row.details && typeof row.details === "object" ? row.details : {},
    eventId: row.policy_decision_event_id,
    githubInstallationId: row.github_installation_id,
    jobId: row.job_id,
    planId: row.plan_id,
    reason: row.reason,
    repositoryFullName: row.repository_full_name,
    runId: row.run_id,
    scopeType: row.scope_type,
    sweepScheduleId: row.sweep_schedule_id,
    workspaceId: row.workspace_id
  });
}

export class PolicyDecisionRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient) {
    this.client = client;
  }

  async recordDecision(input: RecordPolicyDecisionInput): Promise<PolicyDecisionEvent> {
    const eventId = `policy_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    const createdAt = new Date().toISOString();

    const result = await this.client.query<PolicyDecisionEventRow>(
      `INSERT INTO policy_decision_events (
        policy_decision_event_id,
        workspace_id,
        actor_user_id,
        github_installation_id,
        repository_full_name,
        run_id,
        plan_id,
        job_id,
        sweep_schedule_id,
        action_type,
        decision,
        scope_type,
        reason,
        details,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15
      )
      RETURNING
        policy_decision_event_id,
        workspace_id,
        actor_user_id,
        github_installation_id,
        repository_full_name,
        run_id,
        plan_id,
        job_id,
        sweep_schedule_id,
        action_type,
        decision,
        scope_type,
        reason,
        details,
        created_at`,
      [
        eventId,
        workspaceId,
        input.actorUserId ?? null,
        input.githubInstallationId ?? null,
        input.repositoryFullName ?? null,
        input.runId ?? null,
        input.planId ?? null,
        input.jobId ?? null,
        input.sweepScheduleId ?? null,
        input.actionType,
        input.decision,
        input.scopeType,
        input.reason,
        JSON.stringify(input.details ?? {}),
        createdAt
      ]
    );

    return parsePolicyDecisionEvent(result.rows[0]!);
  }

  async listRecentDecisions(input: ListPolicyDecisionInput = {}): Promise<PolicyDecisionEvent[]> {
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const result = await this.client.query<PolicyDecisionEventRow>(
      `SELECT
        policy_decision_event_id,
        workspace_id,
        actor_user_id,
        github_installation_id,
        repository_full_name,
        run_id,
        plan_id,
        job_id,
        sweep_schedule_id,
        action_type,
        decision,
        scope_type,
        reason,
        details,
        created_at
      FROM policy_decision_events
      WHERE workspace_id = $1
      ORDER BY created_at DESC, policy_decision_event_id DESC
      LIMIT $2`,
      [workspaceId, limit]
    );

    return result.rows.map(parsePolicyDecisionEvent);
  }

  async listDecisions(input: ListPolicyDecisionInput = {}): Promise<ListPolicyDecisionPage> {
    const workspaceId = resolveWorkspaceId(input.workspaceId);
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? input.limit ?? 25, 1), 100);
    const offset = (page - 1) * pageSize;
    const values: Array<string | number> = [workspaceId];
    const whereClauses = ["workspace_id = $1"];

    if (input.actionType) {
      values.push(input.actionType);
      whereClauses.push(`action_type = $${values.length}`);
    }

    if (input.decision) {
      values.push(input.decision);
      whereClauses.push(`decision = $${values.length}`);
    }

    if (input.repositoryFullName) {
      values.push(input.repositoryFullName);
      whereClauses.push(`repository_full_name = $${values.length}`);
    }

    if (input.occurredAfter) {
      values.push(input.occurredAfter);
      whereClauses.push(`created_at >= $${values.length}`);
    }

    if (input.occurredBefore) {
      values.push(input.occurredBefore);
      whereClauses.push(`created_at <= $${values.length}`);
    }

    const whereSql = whereClauses.join(" AND ");
    const countResult = await this.client.query<{ total_decisions: string }>(
      `SELECT COUNT(*)::text AS total_decisions
      FROM policy_decision_events
      WHERE ${whereSql}`,
      values
    );
    const totalDecisions = Number.parseInt(countResult.rows[0]?.total_decisions ?? "0", 10);
    const totalPages = totalDecisions === 0 ? 0 : Math.ceil(totalDecisions / pageSize);
    const listValues = [...values, pageSize, offset];
    const result = await this.client.query<PolicyDecisionEventRow>(
      `SELECT
        policy_decision_event_id,
        workspace_id,
        actor_user_id,
        github_installation_id,
        repository_full_name,
        run_id,
        plan_id,
        job_id,
        sweep_schedule_id,
        action_type,
        decision,
        scope_type,
        reason,
        details,
        created_at
      FROM policy_decision_events
      WHERE ${whereSql}
      ORDER BY created_at DESC, policy_decision_event_id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}`,
      listValues
    );

    return {
      decisions: result.rows.map(parsePolicyDecisionEvent),
      page,
      pageSize,
      totalDecisions,
      totalPages
    };
  }
}
