import type { PropsWithChildren, ReactNode } from "react";
import {
  LiveConnectionBadge,
  type LiveConnectionState
} from "./LiveConnectionBadge";
import { Badge, Icon, IconButton, type BadgeTone } from "./ui";

type PageShellProps = PropsWithChildren<{
  eyebrow: string;
  heading: string;
  summary: string;
  aside?: ReactNode;
  toolbar?: ReactNode;
  workspaceName?: string | null;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  statusLabel?: string;
  statusTone?: BadgeTone;
  liveConnectionState?: LiveConnectionState;
}>;

export function PageShell({
  aside,
  children,
  eyebrow,
  heading,
  liveConnectionState,
  notificationCount = 0,
  onOpenNotifications,
  statusLabel,
  statusTone = "active",
  summary,
  toolbar,
  workspaceName
}: PageShellProps) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-brand">
          <span aria-hidden="true" className="app-brand-mark">
            <img src="/RepoGuardianlogo.png" alt="" style={{ width: '1.05rem', height: '1.05rem', objectFit: 'contain' }} />
          </span>
          <span className="app-brand-name">
            <strong>Repo Guardian</strong>
            <span>Supervised Triage</span>
          </span>
        </div>
        {toolbar ? <div className="app-topbar-toolbar">{toolbar}</div> : null}
        <div className="app-topbar-meta">
          {workspaceName ? (
            <span
              aria-label={`Active workspace: ${workspaceName}`}
              className="app-topbar-workspace"
            >
              <Icon name="fleet" />
              <span className="app-topbar-workspace-label">{workspaceName}</span>
            </span>
          ) : null}
          {onOpenNotifications ? (
            <span className="app-topbar-notifications">
              <IconButton
                icon="bell"
                label={
                  notificationCount > 0
                    ? `Notifications, ${notificationCount} unread`
                    : "Notifications"
                }
                onClick={onOpenNotifications}
                variant="subtle"
              />
              {notificationCount > 0 ? (
                <span aria-hidden="true" className="app-topbar-notification-count">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              ) : null}
            </span>
          ) : null}
          {liveConnectionState ? (
            <LiveConnectionBadge
              data-testid="topbar-live-connection-badge"
              state={liveConnectionState}
            />
          ) : null}
          {statusLabel ? (
            <Badge tone={statusTone}>{statusLabel}</Badge>
          ) : (
            <span aria-label="System status" className="app-topbar-status">
              <span aria-hidden="true" className="app-topbar-dot" />
              <span>All systems nominal</span>
            </span>
          )}
        </div>
      </header>
      <div className="page-shell">
        <header className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{heading}</h1>
            <p className="summary">{summary}</p>
          </div>
          {aside ? <div className="hero-aside">{aside}</div> : null}
        </header>
        <main className="content-grid">{children}</main>
      </div>
    </div>
  );
}
