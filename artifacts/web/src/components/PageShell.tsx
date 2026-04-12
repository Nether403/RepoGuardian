import type { PropsWithChildren, ReactNode } from "react";

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
    <div className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          <p className="summary">{summary}</p>
          {toolbar ? <div className="hero-toolbar">{toolbar}</div> : null}
        </div>
        {aside ? <div className="hero-aside">{aside}</div> : null}
      </header>
      <main className="content-grid">{children}</main>
    </div>
  );
}
