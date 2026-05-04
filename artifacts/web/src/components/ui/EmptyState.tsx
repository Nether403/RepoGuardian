import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type EmptyStateProps = {
  icon?: IconName;
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  children,
  actions,
  className
}: EmptyStateProps) {
  const composedClassName = ["empty-state", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={composedClassName}>
      {icon ? (
        <span aria-hidden="true" className="empty-state-icon">
          <Icon name={icon} />
        </span>
      ) : null}
      {title ? <p className="empty-state-title">{title}</p> : null}
      <div className="empty-state-body">{children}</div>
      {actions ? <div className="empty-state-actions">{actions}</div> : null}
    </div>
  );
}
