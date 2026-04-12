import type { ExecutionPlanLifecycleStatus } from "@repo-guardian/shared-types";

const allowedTransitions: Record<
  ExecutionPlanLifecycleStatus,
  ExecutionPlanLifecycleStatus[]
> = {
  planned: ["executing", "expired", "cancelled"],
  executing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  expired: [],
  cancelled: []
};

export function canTransitionExecutionPlanStatus(
  from: ExecutionPlanLifecycleStatus,
  to: ExecutionPlanLifecycleStatus
): boolean {
  return allowedTransitions[from].includes(to);
}

export function resolveExpiredPlannedStatus(input: {
  expiresAt: string;
  now?: Date;
  status: ExecutionPlanLifecycleStatus;
}): ExecutionPlanLifecycleStatus {
  if (input.status !== "planned") {
    return input.status;
  }

  const now = input.now ?? new Date();
  return new Date(input.expiresAt) < now ? "expired" : "planned";
}
