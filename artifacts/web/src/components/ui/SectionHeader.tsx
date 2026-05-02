import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type SectionHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  level?: 2 | 3;
  className?: string;
};

export function SectionHeader({
  title,
  eyebrow,
  icon,
  actions,
  level = 2,
  className
}: SectionHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  const composedClassName = ["panel-header", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={composedClassName}>
      <div className="panel-header-text">
        {eyebrow ? (
          <p className="panel-eyebrow">
            {icon ? <Icon name={icon} /> : null}
            {eyebrow}
          </p>
        ) : null}
        <Heading>{title}</Heading>
      </div>
      {actions ? <div className="panel-header-actions">{actions}</div> : null}
    </div>
  );
}
