import { describe, expect, it } from "vitest";
import {
  evaluateAnalysisPolicy,
  evaluateExecutionPlanPolicy,
  evaluateExecutionWritePolicy,
  evaluateSweepSchedulePolicy
} from "../policy.js";

describe("evaluateAnalysisPolicy", () => {
  it("allows supervised repository analysis inside the active workspace", () => {
    const decision = evaluateAnalysisPolicy({
      repositoryFullName: "openai/openai-node"
    });

    expect(decision).toEqual({
      decision: "allowed",
      reason: "Supervised repository analysis may proceed.",
      details: {
        policyRecordId: "default:workspace:supervised-analysis",
        repositoryFullName: "openai/openai-node"
      }
    });
  });
});

describe("evaluateExecutionWritePolicy", () => {
  it("allows planned execution when the approved plan hash matches", () => {
    const decision = evaluateExecutionWritePolicy({
      actions: [
        {
          actionType: "create_issue",
          eligibility: "eligible"
        }
      ],
      planHashMatches: true,
      planStatus: "planned"
    });

    expect(decision).toEqual({
      decision: "allowed",
      reason: "Approved write execution may proceed.",
      details: {
        eligibleWriteActions: 1,
        planHashMatches: true,
        planStatus: "planned",
        totalActions: 1,
        writeActions: 1
      }
    });
  });

  it("denies execution when the persisted plan hash does not match the approval token", () => {
    const decision = evaluateExecutionWritePolicy({
      actions: [
        {
          actionType: "create_issue",
          eligibility: "eligible"
        }
      ],
      planHashMatches: false,
      planStatus: "planned"
    });

    expect(decision).toMatchObject({
      decision: "denied",
      reason: "Execution is denied because the approved plan hash does not match the persisted plan."
    });
  });

  it("denies execution for plans that are no longer planned", () => {
    const decision = evaluateExecutionWritePolicy({
      actions: [
        {
          actionType: "create_issue",
          eligibility: "eligible"
        }
      ],
      planHashMatches: true,
      planStatus: "expired"
    });

    expect(decision).toMatchObject({
      decision: "denied",
      reason: "Execution is denied because the plan status is expired."
    });
  });
});

describe("evaluateExecutionPlanPolicy", () => {
  it("allows plan generation when at least one candidate is selected", () => {
    const decision = evaluateExecutionPlanPolicy({
      selectionStrategy: "provided_candidates",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: ["pr:workflow-hardening:.github/workflows/ci.yml"]
    });

    expect(decision).toEqual({
      decision: "allowed",
      reason: "Execution plan generation may proceed for selected candidates.",
      details: {
        issueSelections: 0,
        policyRecordId: "default:repository:deterministic-pr-candidates",
        prSelections: 1,
        selectionStrategy: "provided_candidates",
        totalSelections: 1
      }
    });
  });

  it("denies plan generation when no candidates are selected", () => {
    const decision = evaluateExecutionPlanPolicy({
      selectionStrategy: "provided_candidates",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: []
    });

    expect(decision).toMatchObject({
      decision: "denied",
      reason: "Execution plan generation is denied because no candidates were selected."
    });
  });

  it("allows scheduled plan generation using the executable PR selection policy", () => {
    const decision = evaluateExecutionPlanPolicy({
      selectionStrategy: "all_executable_prs",
      selectedIssueCandidateIds: [],
      selectedPRCandidateIds: []
    });

    expect(decision).toEqual({
      decision: "allowed",
      reason: "Execution plan generation may proceed for executable PR candidates.",
      details: {
        issueSelections: 0,
        policyRecordId: "default:repository:deterministic-pr-candidates",
        prSelections: 0,
        selectionStrategy: "all_executable_prs",
        totalSelections: 0
      }
    });
  });
});

describe("evaluateSweepSchedulePolicy", () => {
  it("allows supervised plan-only sweep schedules", () => {
    const decision = evaluateSweepSchedulePolicy({
      cadence: "weekly",
      selectionStrategy: "all_executable_prs"
    });

    expect(decision).toEqual({
      decision: "allowed",
      reason: "Plan-only sweep scheduling may proceed.",
      details: {
        cadence: "weekly",
        policyRecordId: "default:workspace:plan-only-sweeps",
        selectionStrategy: "all_executable_prs"
      }
    });
  });
});
