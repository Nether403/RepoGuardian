import type {
  ExecutionPlanNotification,
  ExecutionPlanNotificationType
} from "../lib/notifications-client";
import { Icon, type IconName } from "./ui";

const STATUS_LABEL: Record<ExecutionPlanNotificationType, string> = {
  "plan.created": "New execution plan ready for review",
  "plan.claimed": "Execution claimed",
  "plan.completed": "Execution completed",
  "plan.failed": "Execution failed"
};

const STATUS_TONE_CLASS: Record<ExecutionPlanNotificationType, string> = {
  "plan.created": "execution-toast-tone-created",
  "plan.claimed": "execution-toast-tone-claimed",
  "plan.completed": "execution-toast-tone-completed",
  "plan.failed": "execution-toast-tone-failed"
};

const STATUS_ICON: Record<ExecutionPlanNotificationType, IconName> = {
  "plan.created": "spark",
  "plan.claimed": "activity",
  "plan.completed": "check",
  "plan.failed": "warning"
};

type Props = {
  notifications: ExecutionPlanNotification[];
  onDismiss(planId: string, status: ExecutionPlanNotificationType): void;
  onClearAll(): void;
  onOpenPlan?(planId: string): void;
};

export function ExecutionNotificationsToast({
  notifications,
  onDismiss,
  onClearAll,
  onOpenPlan
}: Props) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="execution-toast-container"
      data-testid="execution-notifications-toast"
      role="status"
    >
      {notifications.length > 1 ? (
        <button
          className="execution-toast-clear"
          data-testid="execution-notifications-clear"
          onClick={onClearAll}
          type="button"
        >
          <Icon name="close" />
          Clear all ({notifications.length})
        </button>
      ) : null}
      {notifications.map((notification) => (
        <article
          className={`execution-toast ${STATUS_TONE_CLASS[notification.status]}`}
          data-testid="execution-notification-card"
          key={`${notification.planId}:${notification.status}:${notification.createdAt}`}
        >
          <header className="execution-toast-header">
            <strong className="execution-toast-title">
              <Icon name={STATUS_ICON[notification.status]} />
              {STATUS_LABEL[notification.status]}
            </strong>
            <button
              aria-label="Dismiss notification"
              className="execution-toast-dismiss"
              onClick={() => onDismiss(notification.planId, notification.status)}
              type="button"
            >
              <Icon name="x" />
            </button>
          </header>
          <div className="execution-toast-meta">
            <code>{notification.repositoryFullName}</code>
          </div>
          <div className="execution-toast-meta">
            Plan <code>{notification.planId}</code>
            {notification.executionId ? (
              <>
                {" · "}
                <code>{notification.executionId}</code>
              </>
            ) : null}
          </div>
          {notification.reason ? (
            <div className="execution-toast-reason">{notification.reason}</div>
          ) : null}
          {onOpenPlan ? (
            <div className="execution-toast-actions">
              <button
                className="execution-toast-open"
                data-testid="execution-notification-open-plan"
                onClick={() => onOpenPlan(notification.planId)}
                type="button"
              >
                Open plan
                <Icon name="arrow-right" />
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
