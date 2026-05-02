import {
  getLocalApiToken,
  getStoredActiveWorkspaceId
} from "./api-options";

export type ExecutionPlanNotificationType =
  | "plan.created"
  | "plan.claimed"
  | "plan.completed"
  | "plan.failed";

export type ExecutionPlanNotification = {
  createdAt: string;
  executionId: string | null;
  planId: string;
  reason: string | null;
  repositoryFullName: string;
  status: ExecutionPlanNotificationType;
  workspaceId: string;
};

export function buildNotificationStreamUrl(workspaceId: string): string {
  const params = new URLSearchParams({ workspaceId });
  const token = getLocalApiToken();

  if (token) {
    // EventSource cannot set custom headers in the browser, so we forward the
    // bearer token via query string when present. The server still validates it
    // through the standard requireAuth middleware.
    params.set("access_token", token);
  }

  return `/api/execution/notifications/stream?${params.toString()}`;
}

export function getActiveNotificationWorkspaceId(): string | null {
  return getStoredActiveWorkspaceId();
}
