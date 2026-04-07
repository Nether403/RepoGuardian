import type { PropsWithChildren, ReactNode } from "react";

type PanelProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
  className?: string;
  id?: string;
}>;

export function Panel({
  children,
  className,
  eyebrow,
  footer,
  id,
  title
}: PanelProps) {
  return (
    <section className={className ? `panel ${className}` : "panel"} id={id}>
      <div className="panel-header">
        {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      <div className="panel-body">{children}</div>
      {footer ? <div className="panel-footer">{footer}</div> : null}
    </section>
  );
}
