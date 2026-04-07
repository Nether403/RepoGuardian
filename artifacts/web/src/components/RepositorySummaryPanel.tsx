import type { AnalyzeRepoResponse } from "@repo-guardian/shared-types";
import { formatTimestamp } from "../features/analysis/view-model";
import { Panel } from "./Panel";

type RepositorySummaryPanelProps = {
  analysis: AnalyzeRepoResponse;
};

export function RepositorySummaryPanel({
  analysis
}: RepositorySummaryPanelProps) {
  return (
    <>
      <Panel className="panel-half" eyebrow="Repository" title="Repository summary">
        <dl className="meta-grid">
          <div>
            <dt>Full name</dt>
            <dd>{analysis.repository.fullName}</dd>
          </div>
          <div>
            <dt>Default branch</dt>
            <dd>{analysis.repository.defaultBranch}</dd>
          </div>
          <div>
            <dt>Primary language</dt>
            <dd>{analysis.repository.primaryLanguage ?? "Not reported"}</dd>
          </div>
          <div>
            <dt>Stars</dt>
            <dd>{analysis.repository.stars.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Forks</dt>
            <dd>{analysis.repository.forks.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Fetched at</dt>
            <dd>
              <time dateTime={analysis.fetchedAt}>
                {formatTimestamp(analysis.fetchedAt)}
              </time>
            </dd>
          </div>
        </dl>
        <p className="description-copy">
          {analysis.repository.description ??
            "GitHub did not provide a repository description."}
        </p>
        <p className="resource-link">
          <a href={analysis.repository.htmlUrl} rel="noreferrer" target="_blank">
            Open repository on GitHub
          </a>
        </p>
      </Panel>

      <Panel className="panel-half" eyebrow="Tree" title="Tree summary">
        <dl className="meta-grid">
          <div>
            <dt>Total files</dt>
            <dd>{analysis.treeSummary.totalFiles.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Total directories</dt>
            <dd>{analysis.treeSummary.totalDirectories.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Truncated by GitHub</dt>
            <dd>{analysis.treeSummary.truncated ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>{analysis.isPartial ? "Partial snapshot" : "Complete snapshot"}</dd>
          </div>
        </dl>
        <div className="stack-list">
          <div>
            <p className="subsection-label">Sample notable paths</p>
            <ul className="simple-list">
              {analysis.treeSummary.samplePaths.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </>
  );
}
