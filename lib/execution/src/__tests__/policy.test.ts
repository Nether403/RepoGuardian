import { describe, expect, it } from "vitest";
import { evaluateExecutionWritePolicy } from "../policy.js";

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
