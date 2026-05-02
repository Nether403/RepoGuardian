import type { CSSProperties } from "react";
import type {
  ExecutionPlanNotification,
  ExecutionPlanNotificationType
} from "../lib/notifications-client";

const STATUS_LABEL: Record<ExecutionPlanNotificationType, string> = {
  "plan.created": "New execution plan ready for review",
  "plan.claimed": "Execution claimed",
  "plan.completed": "Execution completed",
  "plan.failed": "Execution failed"
};

const STATUS_TONE: Record<ExecutionPlanNotificationType, string> = {
  "plan.created": "#1d4ed8",
  "plan.claimed": "#7c3aed",
  "plan.completed": "#15803d",
  "plan.failed": "#b91c1c"
};

type Props = {
  notifications: ExecutionPlanNotification[];
  onDismiss(planId: string, status: ExecutionPlanNotificationType): void;
  onClearAll(): void;
};

const containerStyle: CSSProperties = {
  bottom: 24,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxWidth: 360,
  pointerEvents: "none",
  position: "fixed",
  right: 24,
  zIndex: 50
};

const cardStyle: CSSProperties = {
  background: "#0f172a",
  borderRadius: 8,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.35)",
  color: "#f8fafc",
  fontSize: 13,
  padding: "10px 12px",
  pointerEvents: "auto"
};

export function ExecutionNotificationsToast({
  notifications,
  onDismiss,
  onClearAll
}: Props) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      data-testid="execution-notifications-toast"
      role="status"
      style={containerStyle}
    >
      {notifications.length > 1 ? (
        <button
          data-testid="execution-notifications-clear"
          onClick={onClearAll}
          style={{
            alignSelf: "flex-end",
            background: "transparent",
            border: "1px solid rgba(248, 250, 252, 0.3)",
            borderRadius: 4,
            color: "#cbd5f5",
            cursor: "pointer",
            fontSize: 11,
            padding: "2px 8px",
            pointerEvents: "auto"
          }}
          type="button"
        >
          Clear all ({notifications.length})
        </button>
      ) : null}
      {notifications.map((notification) => (
        <article
          data-testid="execution-notification-card"
          key={`${notification.planId}:${notification.status}:${notification.createdAt}`}
          style={{
            ...cardStyle,
            borderLeft: `4px solid ${STATUS_TONE[notification.status]}`
          }}
        >
          <header
            style={{
              alignItems: "center",
              display: "flex",
              gap: 8,
              justifyContent: "space-between",
              marginBottom: 4
            }}
          >
            <strong style={{ fontSize: 12, letterSpacing: 0.2 }}>
              {STATUS_LABEL[notification.status]}
            </strong>
            <button
              aria-label="Dismiss notification"
              onClick={() => onDismiss(notification.planId, notification.status)}
              style={{
                background: "transparent",
                border: "none",
                color: "#cbd5f5",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 0
              }}
              type="button"
            >
              ×
            </button>
          </header>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {notification.repositoryFullName}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            Plan {notification.planId}
            {notification.executionId ? ` · ${notification.executionId}` : ""}
          </div>
          {notification.reason ? (
            <div style={{ color: "#fca5a5", fontSize: 11, marginTop: 6 }}>
              {notification.reason}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
