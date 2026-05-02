import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";
import type { IconName } from "./Icon";

export type CardProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  id?: string;
  children: ReactNode;
};

export function Card({
  title,
  eyebrow,
  icon,
  actions,
  footer,
  className,
  id,
  children
}: CardProps) {
  const composedClassName = ["panel", className].filter(Boolean).join(" ");
  return (
    <section className={composedClassName} id={id}>
      <SectionHeader
        actions={actions}
        eyebrow={eyebrow}
        icon={icon}
        title={title}
      />
      <div className="panel-body">{children}</div>
      {footer ? <div className="panel-footer">{footer}</div> : null}
    </section>
  );
}
