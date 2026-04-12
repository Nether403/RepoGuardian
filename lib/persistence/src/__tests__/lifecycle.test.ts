import { describe, expect, it } from "vitest";
import {
  canTransitionExecutionPlanStatus,
  resolveExpiredPlannedStatus
} from "../lifecycle.js";

describe("execution plan lifecycle helpers", () => {
  it("allows only milestone 7A status transitions", () => {
    expect(canTransitionExecutionPlanStatus("planned", "executing")).toBe(true);
    expect(canTransitionExecutionPlanStatus("planned", "expired")).toBe(true);
    expect(canTransitionExecutionPlanStatus("executing", "completed")).toBe(true);
    expect(canTransitionExecutionPlanStatus("executing", "failed")).toBe(true);
    expect(canTransitionExecutionPlanStatus("completed", "planned")).toBe(false);
    expect(canTransitionExecutionPlanStatus("failed", "executing")).toBe(false);
    expect(canTransitionExecutionPlanStatus("expired", "completed")).toBe(false);
  });

  it("lazily expires planned rows once their expiry timestamp has passed", () => {
    expect(
      resolveExpiredPlannedStatus({
        expiresAt: "2026-04-12T09:59:59.000Z",
        now: new Date("2026-04-12T10:00:00.000Z"),
        status: "planned"
      })
    ).toBe("expired");
    expect(
      resolveExpiredPlannedStatus({
        expiresAt: "2026-04-12T10:00:01.000Z",
        now: new Date("2026-04-12T10:00:00.000Z"),
        status: "planned"
      })
    ).toBe("planned");
    expect(
      resolveExpiredPlannedStatus({
        expiresAt: "2026-04-12T09:59:59.000Z",
        now: new Date("2026-04-12T10:00:00.000Z"),
        status: "completed"
      })
    ).toBe("completed");
  });
});
