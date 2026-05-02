import type { AnalysisJob } from "@repo-guardian/shared-types";
import type {
  ExecutionPlanNotification,
  ExecutionPlanNotificationType
} from "../lib/notifications-client";

const JOB_STATUSES_SUPERSEDING_NOTIFICATION: Record<
  ExecutionPlanNotificationType,
  ReadonlyArray<AnalysisJob["status"]>
> = {
  "plan.created": [],
  "plan.claimed": [],
  "plan.completed": ["completed"],
  "plan.failed": ["failed"]
};

export function dedupeQueueNotifications(
  notifications: ReadonlyArray<ExecutionPlanNotification>,
  jobs: ReadonlyArray<AnalysisJob>
): ExecutionPlanNotification[] {
  const supersededPlanIds = new Map<
    ExecutionPlanNotificationType,
    Set<string>
  >();

  for (const status of Object.keys(
    JOB_STATUSES_SUPERSEDING_NOTIFICATION
  ) as ExecutionPlanNotificationType[]) {
    const planIds = new Set<string>();
    const matchingStatuses = JOB_STATUSES_SUPERSEDING_NOTIFICATION[status];
    if (matchingStatuses.length > 0) {
      for (const job of jobs) {
        if (job.planId && matchingStatuses.includes(job.status)) {
          planIds.add(job.planId);
        }
      }
    }
    supersededPlanIds.set(status, planIds);
  }

  const latestByKey = new Map<string, ExecutionPlanNotification>();
  for (const notification of notifications) {
    if (
      supersededPlanIds.get(notification.status)?.has(notification.planId)
    ) {
      continue;
    }
    const key = `${notification.planId}:${notification.status}`;
    const existing = latestByKey.get(key);
    if (!existing || existing.createdAt < notification.createdAt) {
      latestByKey.set(key, notification);
    }
  }

  return [...latestByKey.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export const NOTIFICATION_LABEL: Record<ExecutionPlanNotificationType, string> = {
  "plan.created": "Plan created",
  "plan.claimed": "Plan claimed",
  "plan.completed": "Plan completed",
  "plan.failed": "Plan failed"
};

export const NOTIFICATION_TONE: Record<
  ExecutionPlanNotificationType,
  "active" | "muted" | "up-next" | "warning"
> = {
  "plan.created": "up-next",
  "plan.claimed": "up-next",
  "plan.completed": "active",
  "plan.failed": "warning"
};
