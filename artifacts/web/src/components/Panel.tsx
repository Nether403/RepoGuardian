import type { PropsWithChildren, ReactNode } from "react";

type PanelProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
}>;

export function Panel({ children, eyebrow, footer, title }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        {eyebrow ? <p className="panel-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      <div className="panel-body">{children}</div>
      {footer ? <div className="panel-footer">{footer}</div> : null}
    </section>
  );
}
