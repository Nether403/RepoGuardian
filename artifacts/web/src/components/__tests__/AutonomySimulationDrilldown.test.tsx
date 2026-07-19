import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { AutonomySimulationSummary } from "@repo-guardian/shared-types";
import { afterEach, describe, expect, it } from "vitest";
import { AutonomySimulationDrilldown } from "../AutonomySimulationDrilldown";

const simulation: AutonomySimulationSummary = {
  actionPreviews: [
    {
      actionType: "open_pull_request",
      candidateActionCount: 2,
      evidence: ["installationBacked=true", "stalePatchPlans=1"],
      outcome: "manual_review",
      reasons: ["1 patch plans are stale."],
      repositoryFullName: "openai/openai-node",
      trackedRepositoryId: "tracked_one"
    }
  ],
  comparison: {
    currentManualFlow: {
      candidateActions: 2,
      requiresApproval: true
    },
    simulatedAutonomousFlow: {
      manualReviewActions: 2,
      pullRequestsOpened: 0,
      unattendedWrites: 0
    }
  },
  generatedAt: "2026-04-12T10:05:00.000Z",
  outcomeCounts: {
    manualReview: 2,
    wouldAllow: 0,
    wouldBlock: 0
  },
  policyProfile: "proposed_low_risk_pr_opening",
  recommendations: [
    {
      blastRadius: {
        candidateActions: 2,
        repositoriesAffected: 1
      },
      evidence: ["openai/openai-node", "1 patch plans are stale."],
      expectedActionCounts: {
        manualReview: 2,
        wouldAllow: 0,
        wouldBlock: 0
      },
      rationale: "Keep supervised review while readiness gaps remain.",
      recommendationId: "keep-review-for-risk-signals",
      title: "Keep manual review for repositories with readiness gaps"
    }
  ],
  repositoryReadiness: [
    {
      blockedPatchPlans: 0,
      blockers: [],
      executablePatchPlans: 2,
      installationBacked: true,
      openPullRequests: 0,
      readiness: "needs_review",
      repositoryFullName: "openai/openai-node",
      stalePatchPlans: 1,
      trackedRepositoryId: "tracked_one",
      warnings: ["1 patch plans are stale."]
    }
  ],
  simulationMode: "dry_run",
  sweepScheduleOutcomeCounts: {
    manualReview: 0,
    wouldAllow: 1,
    wouldBlock: 0
  },
  sweepSchedulePreviews: [
    {
      cadence: "weekly",
      candidateRepositoryCount: 1,
      evidence: ["cadence=weekly"],
      isActive: true,
      label: "Weekly dependency review",
      mode: "plan_only_dry_run",
      outcome: "would_allow",
      reasons: [
        "Plan-only sweep would enqueue analysis and execution-plan generation without unattended writes."
      ],
      scheduleId: "sweep_one",
      selectionStrategy: "all_executable_prs"
    }
  ]
};

afterEach(() => {
  cleanup();
});

describe("AutonomySimulationDrilldown", () => {
  it("renders comparison, readiness, recommendations, and sweep dry-run details", () => {
    render(<AutonomySimulationDrilldown simulation={simulation} />);

    expect(screen.getByText(/Manual vs simulated flow/i)).toBeInTheDocument();
    const readiness = within(screen.getByLabelText("Repository readiness"));
    expect(readiness.getByText("openai/openai-node")).toBeInTheDocument();
    expect(readiness.getByText("1 patch plans are stale.")).toBeInTheDocument();
    expect(screen.getByText("stalePatchPlans=1")).toBeInTheDocument();
    expect(
      screen.getByText("Keep manual review for repositories with readiness gaps")
    ).toBeInTheDocument();
    expect(screen.getByText(/Blast radius:/i)).toHaveTextContent("2 candidate");
    const sweeps = within(screen.getByLabelText("Sweep schedule dry-run"));
    expect(sweeps.getByText("Weekly dependency review")).toBeInTheDocument();
    expect(sweeps.getByText(/plan only dry run/i)).toBeInTheDocument();
    expect(
      sweeps.getByText(
        "Plan-only sweep would enqueue analysis and execution-plan generation without unattended writes."
      )
    ).toBeInTheDocument();
  });
});
