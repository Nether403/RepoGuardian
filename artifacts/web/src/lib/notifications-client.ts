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
  id: number;
  planId: string;
  reason: string | null;
  repositoryFullName: string;
  status: ExecutionPlanNotificationType;
  workspaceId: string;
};

export function buildNotificationStreamUrl(
  workspaceId: string,
  options: { lastEventId?: number | null } = {}
): string {
  const params = new URLSearchParams({ workspaceId });
  const token = getLocalApiToken();

  if (token) {
    // EventSource cannot set custom headers in the browser, so we forward the
    // bearer token via query string when present. The server still validates it
    // through the standard requireAuth middleware.
    params.set("access_token", token);
  }

  // EventSource only auto-attaches the standard `Last-Event-ID` header on its
  // own internal reconnect. Our hook tears down and recreates the source on
  // exponential backoff, so we forward the cursor via query string. The server
  // also accepts the header, so native EventSource reconnects keep working.
  if (
    typeof options.lastEventId === "number" &&
    Number.isFinite(options.lastEventId) &&
    options.lastEventId > 0
  ) {
    params.set("lastEventId", String(options.lastEventId));
  }

  return `/api/execution/notifications/stream?${params.toString()}`;
}

export function getActiveNotificationWorkspaceId(): string | null {
  return getStoredActiveWorkspaceId();
}
