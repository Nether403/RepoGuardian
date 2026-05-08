import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BatchExecutionPanel } from "../BatchExecutionPanel";

const baseProps = {
  approvalGranted: false,
  errorMessage: null,
  executeResult: null,
  isExecuting: false,
  isPreviewLoading: false,
  onApprovalChange: vi.fn(),
  onRequestExecute: vi.fn(),
  onRequestPreview: vi.fn(),
  onTogglePlan: vi.fn(),
  planOptions: [
    {
      eligibleActions: 1,
      planId: "plan_one",
      repositoryFullName: "openai/openai-node",
      totalActions: 1
    },
    {
      eligibleActions: 3,
      planId: "plan_two",
      repositoryFullName: "openai/another-repo",
      totalActions: 4
    }
  ],
  preview: null,
  selectedPlanIds: []
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BatchExecutionPanel", () => {
  it("shows selectable existing plans and requests a preview for selected plans", async () => {
    const user = userEvent.setup();
    const onTogglePlan = vi.fn();
    const onRequestPreview = vi.fn();

    const { rerender } = render(
      <BatchExecutionPanel
        {...baseProps}
        onRequestPreview={onRequestPreview}
        onTogglePlan={onTogglePlan}
      />
    );

    expect(screen.getByText("openai/openai-node")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create batch preview" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /openai\/openai-node/u }));
    expect(onTogglePlan).toHaveBeenCalledWith("plan_one");

    rerender(
      <BatchExecutionPanel
        {...baseProps}
        onRequestPreview={onRequestPreview}
        selectedPlanIds={["plan_one"]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Create batch preview" }));
    expect(onRequestPreview).toHaveBeenCalledTimes(1);
  });

  it("requires approval before executing a previewed batch", async () => {
    const user = userEvent.setup();
    const onApprovalChange = vi.fn();
    const onRequestExecute = vi.fn();

    render(
      <BatchExecutionPanel
        {...baseProps}
        onApprovalChange={onApprovalChange}
        onRequestExecute={onRequestExecute}
        preview={{
          approval: {
            confirmationText: "I approve this supervised batch execution.",
            required: true
          },
          approvalToken: "token",
          batchHash: "sha256:batch",
          batchId: "batch_one",
          batchLimits: {
            maxPlans: 5,
            requestedPlans: 1
          },
          expiresAt: "2026-05-08T12:00:00.000Z",
          plans: [],
          summary: {
            approvalRequiredActions: 1,
            blockedActions: 0,
            eligibleActions: 1,
            planCount: 1,
            repositories: 1,
            skippedActions: 0,
            totalActions: 1
          }
        }}
        selectedPlanIds={["plan_one"]}
      />
    );

    expect(screen.getByRole("button", { name: "Execute approved batch" })).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "I approve this supervised batch execution."
      })
    );
    expect(onApprovalChange).toHaveBeenCalledWith(true);
    expect(onRequestExecute).not.toHaveBeenCalled();
  });
});
