import { describe, expect, it } from "vitest";
import {
  ExecutionRequestSchema,
  ExecutionResultSchema
} from "../analyze.js";

describe("execution schemas", () => {
  it("accepts the execution request contract", () => {
    const result = ExecutionRequestSchema.safeParse({
      analysis: {
        issueCandidates: [],
        prCandidates: [],
        prPatchPlans: [],
        repository: {
          canonicalUrl: "https://github.com/openai/openai-node",
          defaultBranch: "main",
          description: null,
          fullName: "openai/openai-node",
          forks: 12,
          htmlUrl: "https://github.com/openai/openai-node",
          owner: "openai",
          primaryLanguage: "TypeScript",
          repo: "openai-node",
          stars: 42
        }
      },
      mode: "dry_run",
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
          eligibility: "blocked",
          id: "execution:skip:request:no-selections",
          linkedIssueCandidateIds: [],
          linkedPRCandidateIds: [],
          plannedSteps: ["Select at least one candidate before planning execution."],
          reason: "No issue or PR candidates were selected for execution planning.",
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
