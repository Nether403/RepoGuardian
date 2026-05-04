import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type BadgeTone =
  | "active"
  | "muted"
  | "up-next"
  | "warning"
  | "success"
  | "danger"
  | "info"
  | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  active: "badge-active",
  muted: "badge-muted",
  "up-next": "badge-up-next",
  warning: "badge-warning",
  success: "badge-success",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral"
};

const TONE_ICON: Record<BadgeTone, IconName> = {
  active: "check",
  muted: "circle-dot",
  "up-next": "activity",
  warning: "warning",
  success: "check",
  danger: "alert",
  info: "info",
  neutral: "circle-dot"
};

export type BadgeProps = {
  tone?: BadgeTone;
  icon?: IconName | false;
  className?: string;
  children: ReactNode;
};

export function Badge({
  tone = "muted",
  icon,
  className,
  children
}: BadgeProps) {
  const resolvedIcon = icon === false ? null : (icon ?? TONE_ICON[tone]);
  const composedClassName = [
    "status-badge",
    TONE_CLASS[tone],
    className
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={composedClassName}>
      {resolvedIcon ? <Icon name={resolvedIcon} /> : null}
      <span className="status-badge-label">{children}</span>
    </span>
  );
}
