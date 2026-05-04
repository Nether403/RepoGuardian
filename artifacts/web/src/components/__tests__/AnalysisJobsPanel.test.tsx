import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisJob } from "@repo-guardian/shared-types";
import { AnalysisJobsPanel } from "../AnalysisJobsPanel";
import { dedupeQueueNotifications } from "../queue-activity";
import type {
  ExecutionPlanNotification,
  ExecutionPlanNotificationType
} from "../../lib/notifications-client";

function makeJob(overrides: Partial<AnalysisJob> = {}): AnalysisJob {
  return {
    attemptCount: 0,
    completedAt: null,
    errorMessage: null,
    failedAt: null,
    githubInstallationId: null,
    jobId: "job_a",
    jobKind: "analyze_repository",
    label: null,
    maxAttempts: 3,
    planId: null,
    queuedAt: "2026-05-01T10:00:00.000Z",
    repoInput: "octo/repo",
    repositoryFullName: "octo/repo",
    requestedByUserId: null,
    runId: null,
    scheduledSweepId: null,
    startedAt: null,
    status: "queued",
    trackedRepositoryId: null,
    updatedAt: "2026-05-01T10:00:00.000Z",
    workspaceId: "workspace_a",
    ...overrides
  } satisfies AnalysisJob;
}

let analysisJobsTestNotificationId = 0;

function makeNotification(
  planId: string,
  status: ExecutionPlanNotificationType = "plan.created",
  overrides: Partial<ExecutionPlanNotification> = {}
): ExecutionPlanNotification {
  analysisJobsTestNotificationId += 1;
  return {
    createdAt: "2026-05-01T11:00:00.000Z",
    executionId: null,
    id: analysisJobsTestNotificationId,
    planId,
    reason: null,
    repositoryFullName: "octo/repo",
    status,
    workspaceId: "workspace_a",
    ...overrides
  };
}

const baseHandlers = {
  onCancelJob: vi.fn(),
  onOpenJobDetails: vi.fn(),
  onOpenPlanDetails: vi.fn(),
  onOpenRunDetails: vi.fn(),
  onRefresh: vi.fn(),
  onRetryJob: vi.fn()
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("dedupeQueueNotifications", () => {
  it("keeps the latest notification per (planId, status) pair", () => {
    const older = makeNotification("plan_a", "plan.created", {
      createdAt: "2026-05-01T11:00:00.000Z"
    });
    const newer = makeNotification("plan_a", "plan.created", {
      createdAt: "2026-05-01T11:05:00.000Z"
    });
    const unrelated = makeNotification("plan_b", "plan.failed", {
      createdAt: "2026-05-01T11:02:00.000Z"
    });

    const result = dedupeQueueNotifications([older, newer, unrelated], []);

    expect(result).toHaveLength(2);
    expect(result[0]?.planId).toBe("plan_a");
    expect(result[0]?.createdAt).toBe("2026-05-01T11:05:00.000Z");
    expect(result[1]?.planId).toBe("plan_b");
  });

  it("drops notifications already represented by a terminal job state", () => {
    const completedNotification = makeNotification("plan_done", "plan.completed");
    const failedNotification = makeNotification("plan_bad", "plan.failed");
    const stillRelevant = makeNotification("plan_done", "plan.created");

    const jobs: AnalysisJob[] = [
      makeJob({ jobId: "job_done", planId: "plan_done", status: "completed" }),
      makeJob({ jobId: "job_bad", planId: "plan_bad", status: "failed" })
    ];

    const result = dedupeQueueNotifications(
      [completedNotification, failedNotification, stillRelevant],
      jobs
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.planId).toBe("plan_done");
    expect(result[0]?.status).toBe("plan.created");
  });

  it("returns events ordered newest-first", () => {
    const a = makeNotification("plan_a", "plan.created", {
      createdAt: "2026-05-01T11:00:00.000Z"
    });
    const b = makeNotification("plan_b", "plan.completed", {
      createdAt: "2026-05-01T12:00:00.000Z"
    });
    const c = makeNotification("plan_c", "plan.claimed", {
      createdAt: "2026-05-01T11:30:00.000Z"
    });

    const result = dedupeQueueNotifications([a, b, c], []);

    expect(result.map((entry) => entry.planId)).toEqual([
      "plan_b",
      "plan_c",
      "plan_a"
    ]);
  });
});

describe("AnalysisJobsPanel live activity", () => {
  it("renders an empty state for the live activity timeline when no events have arrived", () => {
    render(
      <AnalysisJobsPanel
        {...baseHandlers}
        errorMessage={null}
        isLoading={false}
        jobs={[]}
        notifications={[]}
        pendingJobId={null}
      />
    );

    expect(screen.getByTestId("queue-activity")).toBeInTheDocument();
    expect(screen.queryAllByTestId("queue-activity-item")).toHaveLength(0);
    expect(
      screen.getByText(/Live plan lifecycle events will appear here/i)
    ).toBeInTheDocument();
  });

  it("renders deduplicated notifications and forwards open-plan / dismiss handlers", async () => {
    const user = userEvent.setup();
    const onDismissNotification = vi.fn();
    const onOpenPlanDetails = vi.fn();
    const onClearNotifications = vi.fn();

    const notifications: ExecutionPlanNotification[] = [
      makeNotification("plan_a", "plan.created", {
        createdAt: "2026-05-01T11:00:00.000Z"
      }),
      makeNotification("plan_a", "plan.created", {
        createdAt: "2026-05-01T11:30:00.000Z",
        executionId: "exec_1"
      }),
      makeNotification("plan_b", "plan.failed", {
        createdAt: "2026-05-01T11:15:00.000Z",
        reason: "boom"
      }),
      // Should be filtered out — superseded by a completed job below.
      makeNotification("plan_old", "plan.completed", {
        createdAt: "2026-05-01T10:00:00.000Z"
      })
    ];

    const jobs: AnalysisJob[] = [
      makeJob({
        jobId: "job_old",
        planId: "plan_old",
        status: "completed",
        completedAt: "2026-05-01T09:00:00.000Z"
      })
    ];

    render(
      <AnalysisJobsPanel
        {...baseHandlers}
        errorMessage={null}
        isLoading={false}
        jobs={jobs}
        notifications={notifications}
        onClearNotifications={onClearNotifications}
        onDismissNotification={onDismissNotification}
        onOpenPlanDetails={onOpenPlanDetails}
        pendingJobId={null}
      />
    );

    const items = screen.getAllByTestId("queue-activity-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("plan_a");
    expect(items[0]).toHaveTextContent("exec_1");
    expect(items[1]).toHaveTextContent("plan_b");
    expect(items[1]).toHaveTextContent("boom");
    for (const item of items) {
      expect(item).not.toHaveTextContent("plan_old");
    }

    const openButtons = screen.getAllByTestId("queue-activity-open-plan");
    await user.click(openButtons[0]!);
    expect(onOpenPlanDetails).toHaveBeenCalledWith("plan_a");
    expect(onDismissNotification).toHaveBeenCalledWith("plan_a", "plan.created");

    const dismissButtons = screen.getAllByTestId("queue-activity-dismiss");
    await user.click(dismissButtons[1]!);
    expect(onDismissNotification).toHaveBeenLastCalledWith(
      "plan_b",
      "plan.failed"
    );

    await user.click(screen.getByTestId("queue-activity-clear"));
    expect(onClearNotifications).toHaveBeenCalledTimes(1);
  });

  it("renders the live connection badge in the activity header when a state is supplied", () => {
    const { rerender } = render(
      <AnalysisJobsPanel
        {...baseHandlers}
        errorMessage={null}
        isLoading={false}
        jobs={[]}
        liveConnectionState="open"
        notifications={[]}
        pendingJobId={null}
      />
    );

    const liveBadge = screen.getByTestId("queue-activity-live-connection-badge");
    expect(liveBadge).toHaveTextContent("Live");
    expect(liveBadge).toHaveAttribute("data-variant", "live");

    rerender(
      <AnalysisJobsPanel
        {...baseHandlers}
        errorMessage={null}
        isLoading={false}
        jobs={[]}
        liveConnectionState="error"
        notifications={[]}
        pendingJobId={null}
      />
    );

    const reconnectingBadge = screen.getByTestId(
      "queue-activity-live-connection-badge"
    );
    expect(reconnectingBadge).toHaveTextContent("Reconnecting");
    expect(reconnectingBadge).toHaveAttribute("data-variant", "reconnecting");

    rerender(
      <AnalysisJobsPanel
        {...baseHandlers}
        errorMessage={null}
        isLoading={false}
        jobs={[]}
        liveConnectionState="idle"
        notifications={[]}
        pendingJobId={null}
      />
    );

    const offlineBadge = screen.getByTestId(
      "queue-activity-live-connection-badge"
    );
    expect(offlineBadge).toHaveTextContent("Offline");
    expect(offlineBadge).toHaveAttribute("data-variant", "offline");
  });

  it("omits the live connection badge from the activity header when no state is supplied", () => {
    render(
      <AnalysisJobsPanel
        {...baseHandlers}
        errorMessage={null}
        isLoading={false}
        jobs={[]}
        notifications={[]}
        pendingJobId={null}
      />
    );

    expect(
      screen.queryByTestId("queue-activity-live-connection-badge")
    ).not.toBeInTheDocument();
  });

  it("hides clear/dismiss controls when no dismissal handlers are wired", () => {
    render(
      <AnalysisJobsPanel
        {...baseHandlers}
        errorMessage={null}
        isLoading={false}
        jobs={[]}
        notifications={[makeNotification("plan_a")]}
        pendingJobId={null}
      />
    );

    expect(screen.getAllByTestId("queue-activity-item")).toHaveLength(1);
    expect(screen.queryByTestId("queue-activity-clear")).not.toBeInTheDocument();
    expect(screen.queryByTestId("queue-activity-dismiss")).not.toBeInTheDocument();
  });
});
