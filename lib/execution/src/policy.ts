import type {
  AnalysisJob,
  AutonomyPolicyRecommendation,
  AutonomyRepositoryReadiness,
  AutonomySimulationActionPreview,
  AutonomySimulationOutcome,
  AutonomySimulationSummary,
  AutonomySweepSchedulePreview,
  AsyncPlanSelectionStrategy,
  ExecutionActionPlan,
  ExecutionPlanLifecycleStatus,
  FleetTrackedRepositoryStatus,
  PolicyDecision,
  SweepSchedule,
  TrackedPullRequest
} from "@repo-guardian/shared-types";

type ExecutionWritePolicyAction = Pick<
  ExecutionActionPlan,
  "actionType" | "eligibility"
>;

export type ExecutionWritePolicyDecision = {
  decision: PolicyDecision;
  details: Record<string, unknown>;
  reason: string;
};

export type EvaluateExecutionWritePolicyInput = {
  actions: ExecutionWritePolicyAction[];
  planHashMatches: boolean;
  planStatus: ExecutionPlanLifecycleStatus;
};

export type EvaluateExecutionPlanPolicyInput = {
  selectionStrategy?: AsyncPlanSelectionStrategy;
  selectedIssueCandidateIds: string[];
  selectedPRCandidateIds: string[];
};

export type EvaluateBatchExecutionPolicyInput = {
  maxPlans: number;
  plans: Array<{
    eligibleActions: number;
    planId: string;
    status: ExecutionPlanLifecycleStatus;
    totalActions: number;
  }>;
};

export type EvaluateAnalysisPolicyInput = {
  repositoryFullName: string;
};

export type EvaluateSweepSchedulePolicyInput = {
  cadence: string;
  selectionStrategy: string;
};

export type SimulateAutonomyPolicyInput = {
  generatedAt: string;
  recentJobs?: AnalysisJob[];
  sweepSchedules?: SweepSchedule[];
  trackedPullRequests: TrackedPullRequest[];
  trackedRepositories: FleetTrackedRepositoryStatus[];
};

function isWriteAction(actionType: ExecutionActionPlan["actionType"]): boolean {
  return (
    actionType === "create_issue" ||
    actionType === "create_branch" ||
    actionType === "commit_patch" ||
    actionType === "create_pr"
  );
}

export function evaluateAnalysisPolicy(
  input: EvaluateAnalysisPolicyInput
): ExecutionWritePolicyDecision {
  return {
    decision: "allowed",
    details: {
      policyRecordId: "default:workspace:supervised-analysis",
      repositoryFullName: input.repositoryFullName
    },
    reason: "Supervised repository analysis may proceed."
  };
}

export function evaluateExecutionWritePolicy(
  input: EvaluateExecutionWritePolicyInput
): ExecutionWritePolicyDecision {
  const writeActions = input.actions.filter((action) => isWriteAction(action.actionType));
  const eligibleWriteActions = writeActions.filter(
    (action) => action.eligibility === "eligible"
  );
  const details = {
    eligibleWriteActions: eligibleWriteActions.length,
    planHashMatches: input.planHashMatches,
    planStatus: input.planStatus,
    totalActions: input.actions.length,
    writeActions: writeActions.length
  };

  if (!input.planHashMatches) {
    return {
      decision: "denied",
      details,
      reason:
        "Execution is denied because the approved plan hash does not match the persisted plan."
    };
  }

  if (input.planStatus !== "planned") {
    return {
      decision: "denied",
      details,
      reason: `Execution is denied because the plan status is ${input.planStatus}.`
    };
  }

  return {
    decision: "allowed",
    details,
    reason: "Approved write execution may proceed."
  };
}

export function evaluateExecutionPlanPolicy(
  input: EvaluateExecutionPlanPolicyInput
): ExecutionWritePolicyDecision {
  const details = {
    issueSelections: input.selectedIssueCandidateIds.length,
    policyRecordId: "default:repository:deterministic-pr-candidates",
    prSelections: input.selectedPRCandidateIds.length,
    selectionStrategy: input.selectionStrategy ?? "provided_candidates",
    totalSelections:
      input.selectedIssueCandidateIds.length + input.selectedPRCandidateIds.length
  };

  if (input.selectionStrategy === "all_executable_prs") {
    return {
      decision: "allowed",
      details,
      reason: "Execution plan generation may proceed for executable PR candidates."
    };
  }

  if (details.totalSelections === 0) {
    return {
      decision: "denied",
      details,
      reason: "Execution plan generation is denied because no candidates were selected."
    };
  }

  return {
    decision: "allowed",
    details,
    reason: "Execution plan generation may proceed for selected candidates."
  };
}

export function evaluateBatchExecutionPolicy(
  input: EvaluateBatchExecutionPolicyInput
): ExecutionWritePolicyDecision {
  const details = {
    eligibleActions: input.plans.reduce(
      (sum, plan) => sum + plan.eligibleActions,
      0
    ),
    maxPlans: input.maxPlans,
    planIds: input.plans.map((plan) => plan.planId),
    plannedPlans: input.plans.filter((plan) => plan.status === "planned").length,
    totalActions: input.plans.reduce((sum, plan) => sum + plan.totalActions, 0),
    totalPlans: input.plans.length
  };

  if (input.plans.length === 0) {
    return {
      decision: "denied",
      details,
      reason: "Batch execution planning is denied because no plans were selected."
    };
  }

  if (input.plans.length > input.maxPlans) {
    return {
      decision: "denied",
      details,
      reason: `Batch execution planning is denied because at most ${input.maxPlans} plans may be selected.`
    };
  }

  const inactivePlan = input.plans.find((plan) => plan.status !== "planned");

  if (inactivePlan) {
    return {
      decision: "denied",
      details,
      reason: `Batch execution planning is denied because plan ${inactivePlan.planId} is ${inactivePlan.status}.`
    };
  }

  if (details.eligibleActions === 0) {
    return {
      decision: "denied",
      details,
      reason:
        "Batch execution planning is denied because no eligible actions are available."
    };
  }

  return {
    decision: "allowed",
    details,
    reason: "Supervised batch execution planning may proceed for selected plans."
  };
}

export function evaluateSweepSchedulePolicy(
  input: EvaluateSweepSchedulePolicyInput
): ExecutionWritePolicyDecision {
  return {
    decision: "allowed",
    details: {
      cadence: input.cadence,
      policyRecordId: "default:workspace:plan-only-sweeps",
      selectionStrategy: input.selectionStrategy
    },
    reason: "Plan-only sweep scheduling may proceed."
  };
}

function toOutcomeCount(
  outcomeCounts: AutonomySimulationSummary["outcomeCounts"],
  outcome: AutonomySimulationOutcome,
  candidateActionCount: number
): AutonomySimulationSummary["outcomeCounts"] {
  const increment = candidateActionCount > 0 ? candidateActionCount : 1;

  if (outcome === "would_allow") {
    return {
      ...outcomeCounts,
      wouldAllow: outcomeCounts.wouldAllow + increment
    };
  }

  if (outcome === "would_block") {
    return {
      ...outcomeCounts,
      wouldBlock: outcomeCounts.wouldBlock + increment
    };
  }

  return {
    ...outcomeCounts,
    manualReview: outcomeCounts.manualReview + increment
  };
}

function createRecommendation(input: {
  actionPreviews: AutonomySimulationActionPreview[];
  outcomeCounts: AutonomySimulationSummary["outcomeCounts"];
  readiness: AutonomyRepositoryReadiness[];
  sweepSchedulePreviews: AutonomySweepSchedulePreview[];
}): AutonomyPolicyRecommendation[] {
  const candidateActions = input.actionPreviews.reduce(
    (sum, preview) => sum + preview.candidateActionCount,
    0
  );
  const readyRepositories = input.readiness.filter(
    (entry) => entry.readiness === "ready"
  );
  const needsReviewRepositories = input.readiness.filter(
    (entry) => entry.readiness === "needs_review"
  );
  const blockedRepositories = input.readiness.filter(
    (entry) => entry.readiness === "blocked"
  );
  const recommendations: AutonomyPolicyRecommendation[] = [];

  if (readyRepositories.length > 0) {
    recommendations.push({
      blastRadius: {
        candidateActions: input.outcomeCounts.wouldAllow,
        repositoriesAffected: readyRepositories.length
      },
      evidence: readyRepositories.map((entry) => entry.repositoryFullName),
      expectedActionCounts: input.outcomeCounts,
      rationale:
        "These repositories have executable deterministic plans, installation-backed access, no open remediation PRs, and no blocking readiness signals.",
      recommendationId: "allow-ready-deterministic-prs",
      title: "Allow dry-run eligible deterministic PR openings"
    });
  }

  if (needsReviewRepositories.length > 0) {
    recommendations.push({
      blastRadius: {
        candidateActions: input.outcomeCounts.manualReview,
        repositoriesAffected: needsReviewRepositories.length
      },
      evidence: needsReviewRepositories.flatMap((entry) => [
        entry.repositoryFullName,
        ...entry.warnings
      ]),
      expectedActionCounts: input.outcomeCounts,
      rationale:
        "Repositories with installation gaps, open PRs, blocked plans, or recent failures should stay in supervised review before autonomy is expanded.",
      recommendationId: "keep-review-for-risk-signals",
      title: "Keep manual review for repositories with readiness gaps"
    });
  }

  if (blockedRepositories.length > 0 || candidateActions === 0) {
    recommendations.push({
      blastRadius: {
        candidateActions: input.outcomeCounts.wouldBlock,
        repositoriesAffected: blockedRepositories.length
      },
      evidence:
        blockedRepositories.length > 0
          ? blockedRepositories.flatMap((entry) => [
              entry.repositoryFullName,
              ...entry.blockers
            ])
          : ["No executable patch plans are available in the current fleet snapshot."],
      expectedActionCounts: input.outcomeCounts,
      rationale:
        "Autonomy should not proceed when repositories are stale or have no executable deterministic remediation actions.",
      recommendationId: "block-stale-or-empty-actions",
      title: "Block autonomy where no safe deterministic action exists"
    });
  }

  const allowSweepSchedules = input.sweepSchedulePreviews.filter(
    (preview) => preview.outcome === "would_allow"
  );

  if (allowSweepSchedules.length > 0) {
    recommendations.push({
      blastRadius: {
        candidateActions: allowSweepSchedules.reduce(
          (sum, preview) => sum + preview.candidateRepositoryCount,
          0
        ),
        repositoriesAffected: allowSweepSchedules.reduce(
          (sum, preview) => sum + preview.candidateRepositoryCount,
          0
        )
      },
      evidence: allowSweepSchedules.map(
        (preview) => `${preview.label} (${preview.scheduleId})`
      ),
      expectedActionCounts: {
        manualReview: 0,
        wouldAllow: allowSweepSchedules.length,
        wouldBlock: 0
      },
      rationale:
        "Active plan-only sweep schedules can continue enqueueing analysis and deterministic plan generation without unattended GitHub writes.",
      recommendationId: "keep-plan-only-sweep-schedules",
      title: "Keep plan-only sweep schedules in dry-run autonomy"
    });
  }

  return recommendations;
}

function simulateSweepSchedules(input: {
  recentJobs: AnalysisJob[];
  sweepSchedules: SweepSchedule[];
  trackedRepositories: FleetTrackedRepositoryStatus[];
}): {
  outcomeCounts: AutonomySimulationSummary["sweepScheduleOutcomeCounts"];
  previews: AutonomySweepSchedulePreview[];
} {
  let outcomeCounts: AutonomySimulationSummary["sweepScheduleOutcomeCounts"] = {
    manualReview: 0,
    wouldAllow: 0,
    wouldBlock: 0
  };
  const previews: AutonomySweepSchedulePreview[] = [];
  const executableRepositoryCount = input.trackedRepositories.filter(
    (status) =>
      status.trackedRepository.isActive && status.patchPlanCounts.executable > 0
  ).length;

  for (const schedule of input.sweepSchedules) {
    const reasons: string[] = [];
    const evidence = [
      `cadence=${schedule.cadence}`,
      `selectionStrategy=${schedule.selectionStrategy}`,
      `isActive=${schedule.isActive}`,
      `candidateRepositories=${executableRepositoryCount}`,
      `lastTriggeredAt=${schedule.lastTriggeredAt ?? "never"}`
    ];
    const failedSweepJobs = input.recentJobs.filter(
      (job) =>
        job.jobKind === "run_scheduled_sweep" &&
        job.scheduledSweepId === schedule.scheduleId &&
        job.status === "failed"
    );

    if (failedSweepJobs.length > 0) {
      evidence.push(`failedSweepJobs=${failedSweepJobs.length}`);
    }

    let outcome: AutonomySimulationOutcome;

    if (!schedule.isActive) {
      outcome = "would_block";
      reasons.push("Schedule is inactive.");
    } else if (executableRepositoryCount === 0) {
      outcome = "would_block";
      reasons.push(
        "No active tracked repositories have executable deterministic PR candidates."
      );
    } else if (failedSweepJobs.length > 0) {
      outcome = "manual_review";
      reasons.push("Most recent scheduled sweep job failed.");
    } else {
      outcome = "would_allow";
      reasons.push(
        "Plan-only sweep would enqueue analysis and execution-plan generation without unattended writes."
      );
    }

    previews.push({
      cadence: schedule.cadence,
      candidateRepositoryCount: executableRepositoryCount,
      evidence,
      isActive: schedule.isActive,
      label: schedule.label,
      mode: "plan_only_dry_run",
      outcome,
      reasons,
      scheduleId: schedule.scheduleId,
      selectionStrategy: schedule.selectionStrategy
    });
    outcomeCounts = toOutcomeCount(outcomeCounts, outcome, 1);
  }

  return {
    outcomeCounts,
    previews
  };
}

export function simulateAutonomyPolicy(
  input: SimulateAutonomyPolicyInput
): AutonomySimulationSummary {
  let outcomeCounts: AutonomySimulationSummary["outcomeCounts"] = {
    manualReview: 0,
    wouldAllow: 0,
    wouldBlock: 0
  };
  const repositoryReadiness: AutonomyRepositoryReadiness[] = [];
  const actionPreviews: AutonomySimulationActionPreview[] = [];

  for (const status of input.trackedRepositories) {
    const trackedRepository = status.trackedRepository;
    const repositoryFullName = trackedRepository.fullName;
    const openPullRequests = input.trackedPullRequests.filter(
      (pullRequest) =>
        pullRequest.repositoryFullName === repositoryFullName &&
        pullRequest.lifecycleStatus === "open"
    );
    const installationBacked = Boolean(
      trackedRepository.githubInstallationId ||
        trackedRepository.installationRepositoryId
    );
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (status.stale) {
      blockers.push("Latest analysis is stale.");
    }

    if (status.patchPlanCounts.executable === 0) {
      blockers.push("No executable deterministic PR candidates are available.");
    }

    if (!installationBacked) {
      warnings.push("Repository is not linked to a GitHub App installation.");
    }

    if (status.patchPlanCounts.blocked > 0) {
      warnings.push(`${status.patchPlanCounts.blocked} patch plans are blocked.`);
    }

    if (status.patchPlanCounts.stale > 0) {
      warnings.push(`${status.patchPlanCounts.stale} patch plans are stale.`);
    }

    if (
      status.latestPlanStatus === "expired" ||
      status.latestPlanStatus === "failed" ||
      status.latestPlanStatus === "cancelled"
    ) {
      warnings.push(`Latest execution plan is ${status.latestPlanStatus}.`);
    }

    if (status.latestAnalysisJob?.status === "failed") {
      warnings.push("Most recent analysis job failed.");
    }

    if (openPullRequests.length > 0) {
      warnings.push("Repository already has an open tracked remediation PR.");
    }

    const readiness =
      blockers.length > 0
        ? "blocked"
        : warnings.length > 0
          ? "needs_review"
          : "ready";
    const outcome: AutonomySimulationOutcome =
      readiness === "ready"
        ? "would_allow"
        : readiness === "blocked"
          ? "would_block"
          : "manual_review";

    repositoryReadiness.push({
      blockedPatchPlans: status.patchPlanCounts.blocked,
      blockers,
      executablePatchPlans: status.patchPlanCounts.executable,
      installationBacked,
      openPullRequests: openPullRequests.length,
      readiness,
      repositoryFullName,
      stalePatchPlans: status.patchPlanCounts.stale,
      trackedRepositoryId: trackedRepository.id,
      warnings
    });

    actionPreviews.push({
      actionType: "open_pull_request",
      candidateActionCount: status.patchPlanCounts.executable,
      evidence: [
        `latestPlanStatus=${status.latestPlanStatus ?? "none"}`,
        `installationBacked=${installationBacked}`,
        `openPullRequests=${openPullRequests.length}`,
        `stalePatchPlans=${status.patchPlanCounts.stale}`,
        `blockedPatchPlans=${status.patchPlanCounts.blocked}`
      ],
      outcome,
      reasons: [...blockers, ...warnings],
      repositoryFullName,
      trackedRepositoryId: trackedRepository.id
    });
    outcomeCounts = toOutcomeCount(
      outcomeCounts,
      outcome,
      status.patchPlanCounts.executable
    );
  }

  const sweepSimulation = simulateSweepSchedules({
    recentJobs: input.recentJobs ?? [],
    sweepSchedules: input.sweepSchedules ?? [],
    trackedRepositories: input.trackedRepositories
  });

  const candidateActions = actionPreviews.reduce(
    (sum, preview) => sum + preview.candidateActionCount,
    0
  );

  return {
    actionPreviews,
    comparison: {
      currentManualFlow: {
        candidateActions,
        requiresApproval: true
      },
      simulatedAutonomousFlow: {
        manualReviewActions: outcomeCounts.manualReview,
        pullRequestsOpened: outcomeCounts.wouldAllow,
        unattendedWrites: 0
      }
    },
    generatedAt: input.generatedAt,
    outcomeCounts,
    policyProfile: "proposed_low_risk_pr_opening",
    recommendations: createRecommendation({
      actionPreviews,
      outcomeCounts,
      readiness: repositoryReadiness,
      sweepSchedulePreviews: sweepSimulation.previews
    }),
    repositoryReadiness,
    simulationMode: "dry_run",
    sweepScheduleOutcomeCounts: sweepSimulation.outcomeCounts,
    sweepSchedulePreviews: sweepSimulation.previews
  };
}
