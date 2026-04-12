import { describe, expect, it } from "vitest";
import {
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
});
