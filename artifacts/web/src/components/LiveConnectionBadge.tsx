import type { UseExecutionNotificationsResult } from "../hooks/useExecutionNotifications";

export type LiveConnectionState = UseExecutionNotificationsResult["connectionState"];

type LiveConnectionBadgeProps = {
  state: LiveConnectionState;
  className?: string;
  /**
   * When true (default) the badge is rendered as an `aria-live` region so
   * assistive tech announces transitions between Live / Reconnecting /
   * Offline. Set to false on secondary instances (e.g. when another badge
   * for the same connection state is already announcing) to avoid
   * duplicate screen-reader announcements.
   */
  announce?: boolean;
  "data-testid"?: string;
};

type Descriptor = {
  label: string;
  variant: "live" | "reconnecting" | "offline";
  description: string;
};

const STATE_DESCRIPTOR: Record<LiveConnectionState, Descriptor> = {
  open: {
    label: "Live",
    variant: "live",
    description: "Live updates are connected."
  },
  connecting: {
    label: "Reconnecting",
    variant: "reconnecting",
    description: "Reconnecting to the live update channel."
  },
  error: {
    label: "Reconnecting",
    variant: "reconnecting",
    description:
      "Live update channel dropped. Retrying with exponential backoff."
  },
  closed: {
    label: "Offline",
    variant: "offline",
    description: "Live updates are not active."
  },
  idle: {
    label: "Offline",
    variant: "offline",
    description: "Live updates are not active."
  }
};

export function LiveConnectionBadge({
  state,
  className,
  announce = true,
  "data-testid": testId = "live-connection-badge"
}: LiveConnectionBadgeProps) {
  const descriptor = STATE_DESCRIPTOR[state];
  const composedClassName = [
    "live-connection-badge",
    `live-connection-badge-${descriptor.variant}`,
    className
  ]
    .filter(Boolean)
    .join(" ");
  const liveProps = announce
    ? ({ "aria-live": "polite", role: "status" } as const)
    : ({ "aria-label": descriptor.description } as const);
  return (
    <span
      {...liveProps}
      className={composedClassName}
      data-announce={announce ? "true" : "false"}
      data-state={state}
      data-testid={testId}
      data-variant={descriptor.variant}
      title={descriptor.description}
    >
      <span aria-hidden="true" className="live-connection-badge-dot" />
      <span className="live-connection-badge-label">{descriptor.label}</span>
      {announce ? (
        <span className="live-connection-badge-sr">{descriptor.description}</span>
      ) : null}
    </span>
  );
}
