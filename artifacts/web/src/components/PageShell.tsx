import type { PropsWithChildren, ReactNode } from "react";

type PageShellProps = PropsWithChildren<{
  eyebrow: string;
  heading: string;
  summary: string;
  aside?: ReactNode;
}>;

export function PageShell({
  aside,
  children,
  eyebrow,
  heading,
  summary
}: PageShellProps) {
  return (
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
  );
}
