import { describe, expect, it } from "vitest";
import {
  ExecutionBatchExecuteRequestSchema,
  ExecutionBatchExecuteResponseSchema,
  ExecutionPlanRequestSchema,
  ExecutionResultSchema
} from "../analyze.js";

describe("execution schemas", () => {
  it("accepts the execution plan request contract", () => {
    const result = ExecutionPlanRequestSchema.safeParse({
      analysisRunId: "run_test_id",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: []
    });

    expect(result.success).toBe(true);
  });

  it("accepts the execution result contract", () => {
    const result = ExecutionResultSchema.safeParse({
      actions: [
        {
          actionType: "skip",
          affectedPackages: [],
          affectedPaths: [],
          approvalNotes: ["No write action will run in this milestone."],
          approvalRequired: false,
          approvalStatus: "not_required",
          attempted: false,
          blocked: true,
          branchName: null,
          commitSha: null,
          errorMessage: null,
          eligibility: "blocked",
          id: "execution:skip:request:no-selections",
          issueNumber: null,
          issueUrl: null,
          linkedIssueCandidateIds: [],
          linkedPRCandidateIds: [],
          plannedSteps: ["Select at least one candidate before planning execution."],
          pullRequestNumber: null,
          pullRequestUrl: null,
          reason: "No issue or PR candidates were selected for execution planning.",
          succeeded: false,
          targetId: "selection",
          targetType: "request",
          title: "Skip empty execution request"
        }
      ],
      approvalNotes: ["Dry-run planning does not perform remote writes."],
      approvalRequired: false,
      approvalStatus: "not_required",
      completedAt: "2026-04-06T12:00:00.000Z",
      errors: [],
      executionId: "execution-1",
      mode: "dry_run",
      startedAt: "2026-04-06T12:00:00.000Z",
      status: "blocked",
      summary: {
        approvalRequiredActions: 0,
        blockedActions: 1,
        eligibleActions: 0,
        issueSelections: 0,
        prSelections: 0,
        skippedActions: 1,
        totalActions: 1,
        totalSelections: 0
      },
      warnings: ["No issue or PR candidates were selected for execution planning."]
    });

    expect(result.success).toBe(true);
  });

  it("accepts the batch execute request and partial success response contracts", () => {
    expect(
      ExecutionBatchExecuteRequestSchema.safeParse({
        approvalToken: "token",
        batchHash: "sha256:test",
        batchId: "batch_test",
        confirm: true,
        confirmationText: "I approve this supervised batch execution.",
        plans: [
          {
            planHash: "sha256:plan-a",
            planId: "plan_a"
          },
          {
            planHash: "sha256:plan-b",
            planId: "plan_b"
          }
        ]
      }).success
    ).toBe(true);

    expect(
      ExecutionBatchExecuteResponseSchema.safeParse({
        batchId: "batch_test",
        batchHash: "sha256:test",
        completedAt: "2026-04-06T12:01:00.000Z",
        results: [
          {
            errors: [],
            executionId: "exec_a",
            planId: "plan_a",
            repositoryFullName: "openai/openai-node",
            result: {
              actions: [],
              approvalNotes: ["Explicit approval verified via token."],
              approvalRequired: true,
              approvalStatus: "granted",
              completedAt: "2026-04-06T12:01:00.000Z",
              errors: [],
              executionId: "exec_a",
              mode: "execute_approved",
              startedAt: "2026-04-06T12:00:00.000Z",
              status: "completed",
              summary: {
                approvalRequiredActions: 0,
                blockedActions: 0,
                eligibleActions: 0,
                issueSelections: 0,
                prSelections: 0,
                skippedActions: 0,
                totalActions: 0,
                totalSelections: 0
              },
              warnings: []
            },
            status: "completed"
          },
          {
            errors: ["GitHub rejected the pull request."],
            executionId: "exec_b",
            planId: "plan_b",
            repositoryFullName: "openai/another-repo",
            result: null,
            status: "failed"
          }
        ],
        retry: {
          blockedPlanIds: ["plan_b"],
          retryablePlanIds: [],
          guidance:
            "Regenerate failed plans before retrying so each approved plan still maps to one concern."
        },
        startedAt: "2026-04-06T12:00:00.000Z",
        status: "partial_success",
        summary: {
          completedPlans: 1,
          failedPlans: 1,
          planCount: 2,
          retryablePlans: 0
        }
      }).success
    ).toBe(true);
  });
});
