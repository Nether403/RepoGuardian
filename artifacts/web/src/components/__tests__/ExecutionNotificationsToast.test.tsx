import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutionNotificationsToast } from "../ExecutionNotificationsToast";
import type {
  ExecutionPlanNotification,
  ExecutionPlanNotificationType
} from "../../lib/notifications-client";

let notificationIdCounter = 0;

function makeNotification(
  planId: string,
  status: ExecutionPlanNotificationType = "plan.created"
): ExecutionPlanNotification {
  notificationIdCounter += 1;
  return {
    createdAt: new Date().toISOString(),
    executionId: null,
    id: notificationIdCounter,
    planId,
    reason: null,
    repositoryFullName: "octo/repo",
    status,
    workspaceId: "workspace_a"
  };
}

afterEach(() => {
  cleanup();
});

describe("ExecutionNotificationsToast", () => {
  it("renders an Open plan button per card and invokes onOpenPlan with the plan id", async () => {
    const user = userEvent.setup();
    const onOpenPlan = vi.fn();
    const onDismiss = vi.fn();
    const onClearAll = vi.fn();

    render(
      <ExecutionNotificationsToast
        notifications={[
          makeNotification("plan_a", "plan.created"),
          makeNotification("plan_b", "plan.failed")
        ]}
        onClearAll={onClearAll}
        onDismiss={onDismiss}
        onOpenPlan={onOpenPlan}
      />
    );

    const openButtons = screen.getAllByTestId("execution-notification-open-plan");
    expect(openButtons).toHaveLength(2);
    expect(openButtons[0]).toHaveTextContent(/open plan/i);

    await user.click(openButtons[0]!);
    expect(onOpenPlan).toHaveBeenCalledTimes(1);
    expect(onOpenPlan).toHaveBeenLastCalledWith("plan_a");

    await user.click(openButtons[1]!);
    expect(onOpenPlan).toHaveBeenCalledTimes(2);
    expect(onOpenPlan).toHaveBeenLastCalledWith("plan_b");

    expect(onDismiss).not.toHaveBeenCalled();
    expect(onClearAll).not.toHaveBeenCalled();
  });

  it("omits the Open plan button when no onOpenPlan handler is provided", () => {
    render(
      <ExecutionNotificationsToast
        notifications={[makeNotification("plan_a")]}
        onClearAll={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(
      screen.queryByTestId("execution-notification-open-plan")
    ).not.toBeInTheDocument();
  });
});
