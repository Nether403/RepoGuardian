import type { IssueCandidate } from "@repo-guardian/shared-types";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type IssueCandidatesPanelProps = {
  candidates: IssueCandidate[];
  onToggleCandidate: (candidateId: string, selected: boolean) => void;
  selectedCandidateIds: string[];
};

function formatValue(value: string): string {
  return value.replace(/[-_]/gu, " ");
}

function getSeverityTone(severity: IssueCandidate["severity"]): "warning" | "muted" {
  return severity === "critical" || severity === "high" ? "warning" : "muted";
}

function getConfidenceTone(
  confidence: IssueCandidate["confidence"]
): "active" | "muted" | "warning" {
  if (confidence === "high") {
    return "active";
  }

  return confidence === "medium" ? "warning" : "muted";
}

export function IssueCandidatesPanel({
  candidates,
  onToggleCandidate,
  selectedCandidateIds
}: IssueCandidatesPanelProps) {
  const selectedIds = new Set(selectedCandidateIds);

  return (
    <Panel
      className="panel-wide"
      eyebrow="Action Selection"
      footer={
        <StatusBadge
          label={`${selectedIds.size} of ${candidates.length} selected`}
          tone={selectedIds.size > 0 ? "active" : "muted"}
        />
      }
      title="Issue candidates"
    >
      {candidates.length > 0 ? (
        <div className="candidate-selection-list">
          {candidates.map((candidate) => (
            <article className="candidate-selection-card" key={candidate.id}>
              <label className="candidate-selection-control">
                <input
                  checked={selectedIds.has(candidate.id)}
                  onChange={(event) =>
                    onToggleCandidate(candidate.id, event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Select issue candidate</span>
              </label>
              <div className="candidate-selection-content">
                <div className="candidate-selection-header">
                  <div>
                    <p className="subsection-label">{formatValue(candidate.candidateType)}</p>
                    <h3>{candidate.title}</h3>
                  </div>
                  <div className="badge-row">
                    <StatusBadge
                      label={formatValue(candidate.severity)}
                      tone={getSeverityTone(candidate.severity)}
                    />
                    <StatusBadge
                      label={formatValue(candidate.confidence)}
                      tone={getConfidenceTone(candidate.confidence)}
                    />
                    <StatusBadge label={formatValue(candidate.scope)} tone="muted" />
                  </div>
                </div>
                <p className="trace-copy">{candidate.summary}</p>
                <div className="trace-meta-grid">
                  <div>
                    <p className="subsection-label">Affected paths</p>
                    {candidate.affectedPaths.length > 0 ? (
                      <ul className="simple-list">
                        {candidate.affectedPaths.map((path) => (
                          <li key={`${candidate.id}:${path}`}>
                            <code>{path}</code>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="trace-copy">No file-level scope.</p>
                    )}
                  </div>
                  <div>
                    <p className="subsection-label">Affected packages</p>
                    {candidate.affectedPackages.length > 0 ? (
                      <ul className="simple-list">
                        {candidate.affectedPackages.map((pkg) => (
                          <li key={`${candidate.id}:${pkg}`}>
                            <code>{pkg}</code>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="trace-copy">No package-level scope.</p>
                    )}
                  </div>
                </div>
                <details className="trace-expander">
                  <summary>Issue candidate detail</summary>
                  <div className="trace-expander-content">
                    <div>
                      <p className="subsection-label">Why it matters</p>
                      <p className="trace-copy">{candidate.whyItMatters}</p>
                    </div>
                    <div>
                      <p className="subsection-label">Acceptance criteria</p>
                      <ul className="simple-list">
                        {candidate.acceptanceCriteria.map((criterion) => (
                          <li key={`${candidate.id}:${criterion}`}>{criterion}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="subsection-label">Candidate ID</p>
                      <code>{candidate.id}</code>
                    </div>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-copy">No issue candidates were generated.</p>
      )}
    </Panel>
  );
}
