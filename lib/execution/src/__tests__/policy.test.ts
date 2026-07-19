import { describe, expect, it } from "vitest";
import type { FleetTrackedRepositoryStatus, TrackedPullRequest } from "@repo-guardian/shared-types";
import {
  evaluateAnalysisPolicy,
  evaluateBatchExecutionPolicy,
  evaluateExecutionPlanPolicy,
  evaluateExecutionWritePolicy,
  evaluateSweepSchedulePolicy,
  simulateAutonomyPolicy
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

describe("evaluateBatchExecutionPolicy", () => {
  const plannedPlan = {
    eligibleActions: 2,
    planId: "plan_one",
    status: "planned" as const,
    totalActions: 2
  };

  it("allows a bounded selection of planned eligible plans", () => {
    expect(
      evaluateBatchExecutionPolicy({
        maxPlans: 5,
        plans: [plannedPlan]
      })
    ).toMatchObject({
      decision: "allowed",
      reason: "Supervised batch execution planning may proceed for selected plans."
    });
  });

  it("denies empty selections, oversized batches, inactive plans, and zero-eligible batches", () => {
    expect(
      evaluateBatchExecutionPolicy({
        maxPlans: 5,
        plans: []
      }).decision
    ).toBe("denied");

    expect(
      evaluateBatchExecutionPolicy({
        maxPlans: 1,
        plans: [plannedPlan, { ...plannedPlan, planId: "plan_two" }]
      }).reason
    ).toContain("at most 1 plans");

    expect(
      evaluateBatchExecutionPolicy({
        maxPlans: 5,
        plans: [{ ...plannedPlan, status: "expired" }]
      }).reason
    ).toContain("is expired");

    expect(
      evaluateBatchExecutionPolicy({
        maxPlans: 5,
        plans: [{ ...plannedPlan, eligibleActions: 0 }]
      }).reason
    ).toContain("no eligible actions");
  });
});

describe("simulateAutonomyPolicy", () => {
  function createTrackedStatus(
    overrides: Partial<FleetTrackedRepositoryStatus> & {
      executable?: number;
      installationBacked?: boolean;
      stale?: boolean;
    } = {}
  ): FleetTrackedRepositoryStatus {
    const {
      executable = 2,
      installationBacked = true,
      stale = false,
      ...statusOverrides
    } = overrides;

    return {
      latestAnalysisJob: null,
      latestPlanId: "plan_one",
      latestPlanStatus: "planned",
      latestRun: null,
      patchPlanCounts: {
        blocked: 0,
        executable,
        stale: 0
      },
      stale,
      trackedRepository: {
        canonicalUrl: "https://github.com/openai/openai-node",
        createdAt: "2026-04-12T10:00:00.000Z",
        fullName: "openai/openai-node",
        githubInstallationId: installationBacked ? "inst_one" : null,
        id: "tr_one",
        installationRepositoryId: installationBacked ? "ir_one" : null,
        isActive: true,
        label: null,
        lastQueuedAt: null,
        owner: "openai",
        repo: "openai-node",
        updatedAt: "2026-04-12T10:00:00.000Z",
        workspaceId: "workspace_one"
      },
      ...statusOverrides
    };
  }

  it("classifies ready, manual-review, and blocked repositories in dry-run mode", () => {
    const openPullRequest: TrackedPullRequest = {
      branchName: "repo-guardian/harden",
      closedAt: null,
      createdAt: "2026-04-12T10:00:00.000Z",
      executionId: "exec_one",
      lifecycleStatus: "open",
      mergedAt: null,
      owner: "openai",
      planId: "plan_one",
      pullRequestNumber: 19,
      pullRequestUrl: "https://github.com/openai/openai-node/pull/19",
      repo: "openai-node",
      repositoryFullName: "openai/openai-node",
      title: "Harden workflow",
      trackedPullRequestId: "tpr_one",
      updatedAt: "2026-04-12T10:00:00.000Z"
    };

    const summary = simulateAutonomyPolicy({
      generatedAt: "2026-04-12T11:00:00.000Z",
      trackedPullRequests: [openPullRequest],
      trackedRepositories: [
        createTrackedStatus({
          trackedRepository: {
            ...createTrackedStatus().trackedRepository,
            fullName: "openai/ready-repo",
            id: "tr_ready",
            owner: "openai",
            repo: "ready-repo",
            canonicalUrl: "https://github.com/openai/ready-repo"
          }
        }),
        createTrackedStatus({
          trackedRepository: {
            ...createTrackedStatus().trackedRepository,
            fullName: "openai/openai-node",
            id: "tr_review"
          }
        }),
        createTrackedStatus({
          executable: 0,
          stale: true,
          trackedRepository: {
            ...createTrackedStatus().trackedRepository,
            fullName: "openai/blocked-repo",
            id: "tr_blocked",
            owner: "openai",
            repo: "blocked-repo",
            canonicalUrl: "https://github.com/openai/blocked-repo"
          }
        })
      ]
    });

    expect(summary.simulationMode).toBe("dry_run");
    expect(summary.comparison.simulatedAutonomousFlow.unattendedWrites).toBe(0);
    expect(
      summary.repositoryReadiness.find(
        (entry) => entry.repositoryFullName === "openai/ready-repo"
      )?.readiness
    ).toBe("ready");
    expect(
      summary.repositoryReadiness.find(
        (entry) => entry.repositoryFullName === "openai/openai-node"
      )?.readiness
    ).toBe("needs_review");
    expect(
      summary.repositoryReadiness.find(
        (entry) => entry.repositoryFullName === "openai/blocked-repo"
      )?.readiness
    ).toBe("blocked");
  });

  it("simulates plan-only sweep schedules without unattended writes", () => {
    const summary = simulateAutonomyPolicy({
      generatedAt: "2026-04-12T11:00:00.000Z",
      recentJobs: [
        {
          attemptCount: 1,
          completedAt: null,
          errorMessage: "rate limited",
          failedAt: "2026-04-12T10:30:00.000Z",
          jobId: "job_sweep_failed",
          jobKind: "run_scheduled_sweep",
          label: null,
          maxAttempts: 1,
          planId: null,
          queuedAt: "2026-04-12T10:20:00.000Z",
          repoInput: "[scheduled-sweep]",
          repositoryFullName: "[scheduled-sweep]",
          requestedByUserId: "usr_system",
          runId: null,
          scheduledSweepId: "sweep_review",
          startedAt: "2026-04-12T10:21:00.000Z",
          status: "failed",
          trackedRepositoryId: null,
          updatedAt: "2026-04-12T10:30:00.000Z"
        }
      ],
      sweepSchedules: [
        {
          cadence: "weekly",
          createdAt: "2026-04-12T10:00:00.000Z",
          isActive: true,
          label: "Ready sweep",
          lastTriggeredAt: null,
          nextRunAt: "2026-04-19T10:00:00.000Z",
          scheduleId: "sweep_ready",
          selectionStrategy: "all_executable_prs",
          updatedAt: "2026-04-12T10:00:00.000Z"
        },
        {
          cadence: "weekly",
          createdAt: "2026-04-12T10:00:00.000Z",
          isActive: false,
          label: "Inactive sweep",
          lastTriggeredAt: null,
          nextRunAt: "2026-04-19T10:00:00.000Z",
          scheduleId: "sweep_inactive",
          selectionStrategy: "all_executable_prs",
          updatedAt: "2026-04-12T10:00:00.000Z"
        },
        {
          cadence: "weekly",
          createdAt: "2026-04-12T10:00:00.000Z",
          isActive: true,
          label: "Failed sweep",
          lastTriggeredAt: "2026-04-12T10:20:00.000Z",
          nextRunAt: "2026-04-19T10:00:00.000Z",
          scheduleId: "sweep_review",
          selectionStrategy: "all_executable_prs",
          updatedAt: "2026-04-12T10:20:00.000Z"
        }
      ],
      trackedPullRequests: [],
      trackedRepositories: [createTrackedStatus()]
    });

    expect(summary.comparison.simulatedAutonomousFlow.unattendedWrites).toBe(0);
    expect(summary.sweepScheduleOutcomeCounts).toEqual({
      manualReview: 1,
      wouldAllow: 1,
      wouldBlock: 1
    });
    expect(
      summary.sweepSchedulePreviews.find(
        (preview) => preview.scheduleId === "sweep_ready"
      )
    ).toMatchObject({
      mode: "plan_only_dry_run",
      outcome: "would_allow"
    });
    expect(
      summary.sweepSchedulePreviews.find(
        (preview) => preview.scheduleId === "sweep_inactive"
      )?.outcome
    ).toBe("would_block");
    expect(
      summary.sweepSchedulePreviews.find(
        (preview) => preview.scheduleId === "sweep_review"
      )?.outcome
    ).toBe("manual_review");
    expect(
      summary.recommendations.some(
        (recommendation) =>
          recommendation.recommendationId === "keep-plan-only-sweep-schedules"
      )
    ).toBe(true);
  });

  it("adds richer readiness warnings for stale plans and inactive plan lifecycle", () => {
    const summary = simulateAutonomyPolicy({
      generatedAt: "2026-04-12T11:00:00.000Z",
      trackedPullRequests: [],
      trackedRepositories: [
        {
          ...createTrackedStatus(),
          latestPlanStatus: "expired",
          patchPlanCounts: {
            blocked: 0,
            executable: 2,
            stale: 3
          }
        }
      ]
    });

    expect(summary.repositoryReadiness[0]?.readiness).toBe("needs_review");
    expect(summary.repositoryReadiness[0]?.warnings).toEqual(
      expect.arrayContaining([
        "3 patch plans are stale.",
        "Latest execution plan is expired."
      ])
    );
    expect(summary.actionPreviews[0]?.evidence).toEqual(
      expect.arrayContaining([
        "stalePatchPlans=3",
        "blockedPatchPlans=0"
      ])
    );
  });
});
