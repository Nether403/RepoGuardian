import type { PropsWithChildren, ReactNode } from "react";
import { Icon } from "./ui";

type PageShellProps = PropsWithChildren<{
  eyebrow: string;
  heading: string;
  summary: string;
  aside?: ReactNode;
  toolbar?: ReactNode;
}>;

export function PageShell({
  aside,
  children,
  eyebrow,
  heading,
  summary,
  toolbar
}: PageShellProps) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-brand">
          <span aria-hidden="true" className="app-brand-mark">
            <Icon name="shield" />
          </span>
          <span className="app-brand-name">
            <strong>Repo Guardian</strong>
            <span>Supervised Triage</span>
          </span>
        </div>
        {toolbar ? <div className="app-topbar-toolbar">{toolbar}</div> : null}
        <div className="app-topbar-meta" aria-label="System status">
          <span className="app-topbar-dot" aria-hidden="true" />
          <span>All systems nominal</span>
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
